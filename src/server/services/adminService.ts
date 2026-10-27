// ============================================================
// FairShift — Services: Admin Service
// Overview KPIs, SVG attendance charts, SLA queue, quit risk, feedback heatmap, kiosk QR
// ============================================================

import QRCode from 'qrcode';
import { getDatabase } from '../repos';
import { verifySecret } from '../auth/password';
import { signSession } from '../auth/session';
import { generateSiteQrCode } from '../domain/qrCode';
import { evaluateFatigue } from '../domain/fatigue';
import { calculateQuitRisk } from '../domain/quitRisk';
import { aggregateFeedback } from '../domain/anonymity';
import { calculateAttendanceDrop, teamSentimentAverage } from '../domain/workforceSignals';
import { istDateKey } from '../domain/time';
import { getRemainingSlaSeconds, formatSlaRemaining } from '../domain/hazardSla';
import { generateWeeklySafetySummary } from '../ai/gemini';
import type {
  Admin,
  OverviewKPIs,
  DailyAttendance,
  HazardReport,
  AggregatedFeedback,
  QuitRiskResult,
  Worker,
  Site,
  Shift,
  FeedbackSubmission,
} from '../../shared/types';

/** A worker as returned to clients: no PIN hash. */
export type PublicWorker = Omit<Worker, 'pinHash'>;
/** A site as returned to clients: the QR secret never leaves the server. */
export type PublicSite = Omit<Site, 'qrSecret'>;

function toPublicSite(site: Site): PublicSite {
  const { qrSecret: _qrSecret, ...rest } = site;
  return rest;
}

export class AdminService {
  private db = getDatabase();

  /**
   * Fatigue flags and quit-risk for one worker, from their own shifts and complaints
   * plus their team's anonymous sentiment. Shared by the overview and the risk table
   * so both always agree.
   */
  private assessWorker(
    worker: Worker,
    shifts: Shift[],
    hazards: HazardReport[],
    feedback: FeedbackSubmission[],
    now: Date
  ) {
    const weekAgoMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const workerShifts = shifts.filter((s) => s.workerId === worker.id);
    const flags = evaluateFatigue({
      shifts: workerShifts,
      windowStart: new Date(weekAgoMs).toISOString(),
      windowEnd: now.toISOString(),
    });

    const weeklyHours = workerShifts
      .filter((s) => s.checkOut && new Date(s.checkIn).getTime() >= weekAgoMs)
      .reduce(
        (sum, s) => sum + (new Date(s.checkOut!).getTime() - new Date(s.checkIn).getTime()) / 3600000,
        0
      );

    const unresolvedComplaints = hazards.filter(
      (h) => h.reporterId === worker.id && h.status !== 'resolved'
    ).length;

    const risk = calculateQuitRisk({
      weeklyHours: Math.round(weeklyHours),
      fatigueFlags: flags,
      attendanceDropPct: calculateAttendanceDrop(workerShifts, now),
      unresolvedComplaints,
      teamFeedbackTrend: teamSentimentAverage(feedback, worker.team),
    });

    return { flags, risk };
  }

  /**
   * Admin login with email + password.
   */
  async login(email: string, password: string): Promise<{ admin: Omit<Admin, 'passwordHash'>; token: string }> {
    const admin = await this.db.admins.getByEmail(email);
    if (!admin) {
      throw new Error('Invalid email or password');
    }

    const isValid = await verifySecret(password, admin.passwordHash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    const token = signSession({
      userId: admin.id,
      orgId: admin.orgId,
      orgIds: admin.orgIds ?? [admin.orgId],
      role: 'admin',
    });

    const { passwordHash: _, ...adminData } = admin;
    return { admin: adminData, token };
  }

  /**
   * Retrieves high-level workforce KPIs for the admin dashboard.
   */
  async getOverviewKPIs(orgId: string, siteId?: string): Promise<OverviewKPIs> {
    const workers = siteId
      ? await this.db.workers.listBySite(siteId)
      : await this.db.workers.listByOrg(orgId);

    const shifts = siteId
      ? await this.db.shifts.listBySite(siteId)
      : await this.db.shifts.listByOrg(orgId);

    const hazards = siteId
      ? await this.db.hazards.listBySite(siteId)
      : await this.db.hazards.listByOrg(orgId);

    // Active workers currently on site (checkOut is null)
    const onSiteNow = shifts.filter((s) => s.checkOut === null).length;

    // Hazards
    const escalatedHazards = hazards.filter((h) => h.status === 'escalated').length;
    const openHazards = hazards.filter((h) => h.status !== 'resolved').length;

    // Fatigue & Quit Risk across active workers
    const now = new Date();
    let fatigueWorkersCount = 0;
    let highRiskCount = 0;

    const feedback = siteId
      ? await this.db.feedback.listBySite(siteId)
      : await this.db.feedback.listByOrg(orgId);

    for (const worker of workers) {
      const { flags, risk } = this.assessWorker(worker, shifts, hazards, feedback, now);

      if (flags.length > 0) {
        fatigueWorkersCount++;
      }

      if (risk.score > 50) {
        highRiskCount++;
      }
    }

    return {
      onSiteNow,
      totalWorkers: workers.length,
      escalatedHazards,
      openHazards,
      fatigueFlags: fatigueWorkersCount,
      highQuitRisk: highRiskCount,
    };
  }

  /**
   * Executive AI summary of workforce state.
   */
  async getAiSummary(orgId: string, siteId?: string): Promise<{ summary: string; isAi: boolean }> {
    const kpis = await this.getOverviewKPIs(orgId, siteId);
    return await generateWeeklySafetySummary(kpis);
  }

  /**
   * Hand-built SVG attendance trend for past N days (default 14 days).
   */
  async getAttendanceTrend(orgId: string, siteId?: string, days: number = 14): Promise<DailyAttendance[]> {
    const workers = siteId
      ? await this.db.workers.listBySite(siteId)
      : await this.db.workers.listByOrg(orgId);

    const shifts = siteId
      ? await this.db.shifts.listBySite(siteId)
      : await this.db.shifts.listByOrg(orgId);

    const totalWorkers = workers.length;
    const result: DailyAttendance[] = [];

    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = istDateKey(d);

      // Count unique workers present on this day
      const presentWorkers = new Set(
        shifts
          .filter((s) => istDateKey(s.checkIn) === dateStr)
          .map((s) => s.workerId)
      );

      result.push({
        date: dateStr,
        present: presentWorkers.size,
        total: totalWorkers,
      });
    }

    return result;
  }

  /**
   * Safety hazard triage queue with live SLA deadlines.
   */
  async getSafetyQueue(orgId: string, siteId?: string): Promise<
    (HazardReport & { remainingSeconds: number; slaFormatted: string })[]
  > {
    const hazards = siteId
      ? await this.db.hazards.listBySite(siteId)
      : await this.db.hazards.listByOrg(orgId);

    return hazards.map((h) => {
      const remainingSeconds = getRemainingSlaSeconds(h);
      return {
        ...h,
        remainingSeconds,
        slaFormatted: formatSlaRemaining(remainingSeconds),
      };
    });
  }

  /**
   * Acknowledge a hazard report.
   */
  async acknowledgeHazard(hazardId: string, allowedOrgIds: string[]): Promise<HazardReport> {
    const hazard = await this.db.hazards.getById(hazardId);
    if (!hazard || !allowedOrgIds.includes(hazard.orgId)) throw new Error('Hazard not found');

    hazard.acknowledgedAt = new Date().toISOString();
    hazard.status = 'acknowledged';
    return await this.db.hazards.update(hazard);
  }

  /**
   * Resolve a hazard report.
   */
  async resolveHazard(hazardId: string, allowedOrgIds: string[]): Promise<HazardReport> {
    const hazard = await this.db.hazards.getById(hazardId);
    if (!hazard || !allowedOrgIds.includes(hazard.orgId)) throw new Error('Hazard not found');

    hazard.resolvedAt = new Date().toISOString();
    hazard.status = 'resolved';
    return await this.db.hazards.update(hazard);
  }

  /**
   * Anonymous team feedback heatmap adhering to k >= 3 anonymity.
   */
  async getFeedbackHeatmap(orgId: string, siteId?: string): Promise<AggregatedFeedback[]> {
    const feedbackList = siteId
      ? await this.db.feedback.listBySite(siteId)
      : await this.db.feedback.listByOrg(orgId);

    const workers = siteId
      ? await this.db.workers.listBySite(siteId)
      : await this.db.workers.listByOrg(orgId);

    const rosterNames = workers.map((w) => w.name);

    // Group by team
    const byTeam = new Map<string, typeof feedbackList>();
    for (const f of feedbackList) {
      const list = byTeam.get(f.team) ?? [];
      list.push(f);
      byTeam.set(f.team, list);
    }

    const currentWeek = feedbackList[0]?.isoWeek || '2026-W43';
    const result: AggregatedFeedback[] = [];

    for (const [team, subs] of byTeam.entries()) {
      const agg = aggregateFeedback(subs, team, currentWeek, 3, rosterNames);
      result.push(agg);
    }

    return result;
  }

  /**
   * Workforce quit-risk assessment with ranked reasons.
   */
  async getWorkforceRisk(
    orgId: string,
    siteId?: string
  ): Promise<(PublicWorker & { risk: QuitRiskResult })[]> {
    const workers = siteId
      ? await this.db.workers.listBySite(siteId)
      : await this.db.workers.listByOrg(orgId);

    const shifts = siteId
      ? await this.db.shifts.listBySite(siteId)
      : await this.db.shifts.listByOrg(orgId);

    const hazards = siteId
      ? await this.db.hazards.listBySite(siteId)
      : await this.db.hazards.listByOrg(orgId);

    const feedback = siteId
      ? await this.db.feedback.listBySite(siteId)
      : await this.db.feedback.listByOrg(orgId);

    const now = new Date();
    const ranked: (PublicWorker & { risk: QuitRiskResult })[] = [];

    for (const worker of workers) {
      const { risk } = this.assessWorker(worker, shifts, hazards, feedback, now);

      // Never hand the PIN hash to a client, even an admin.
      const { pinHash: _pinHash, ...publicWorker } = worker;
      ranked.push({
        ...publicWorker,
        risk,
      });
    }

    return ranked.sort((a, b) => b.risk.score - a.risk.score);
  }

  /**
   * Retrieve sites for an organisation.
   */
  async getSites(orgId: string): Promise<PublicSite[]> {
    return (await this.db.sites.listByOrg(orgId)).map(toPublicSite);
  }

  /**
   * Retrieve all sites across sectors.
   */
  async getAllSites(): Promise<PublicSite[]> {
    return (await this.db.sites.list()).map(toPublicSite);
  }

  /**
   * Retrieve site by id.
   */
  async getSiteById(siteId: string): Promise<Site | null> {
    return await this.db.sites.get(siteId);
  }

  /**
   * Kiosk display data: rotating QR code + SVG string.
   */
  async getKioskData(siteId: string, allowedOrgIds: string[], origin: string = ''): Promise<{
    site: PublicSite;
    code: string;
    validFrom: number;
    validUntil: number;
    qrSvg: string;
    checkInUrl: string;
  }> {
    const site = await this.db.sites.get(siteId);
    if (!site || !allowedOrgIds.includes(site.orgId)) throw new Error('Site not found');

    const qrResult = generateSiteQrCode(site.qrSecret);
    // Absolute when an origin is given, so a phone camera can open the scanned link.
    const checkInUrl = `${origin}/w/checkin?site=${encodeURIComponent(site.id)}&code=${qrResult.code}`;

    // Render clean server-side SVG
    const qrSvg = await QRCode.toString(checkInUrl, {
      type: 'svg',
      margin: 1,
      color: {
        dark: '#1C1D1A', // graphite
        light: '#FFFFFF',
      },
    });

    return {
      site: toPublicSite(site),
      code: qrResult.code,
      validFrom: qrResult.validFrom,
      validUntil: qrResult.validUntil,
      qrSvg,
      checkInUrl,
    };
  }
}

export const adminService = new AdminService();
