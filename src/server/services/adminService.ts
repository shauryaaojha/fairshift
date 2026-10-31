/**
 * Admin service: orchestrates business use-cases, operations, and policy rules for admins.
 * Services handle business use-cases and domain rules; views shape and compose data specifically
 * for presentation and page rendering.
 */

import { cache } from 'react';
import { getDatabase } from '../repos';
import { verifySecret } from '../auth/password';
import { signSession } from '../auth/session';
import { evaluateFatigue } from '../domain/fatigue';
import { calculateQuitRisk } from '../domain/quitRisk';
import { aggregateFeedback } from '../domain/anonymity';
import { calculateAttendanceDrop, teamSentimentAverage } from '../domain/workforceSignals';
import { istDateKey, DAY_MS, WEEK_MS } from '../domain/time';
import {
  computeHazardStatus,
  getRemainingSlaSeconds,
  formatSlaRemaining,
} from '../domain/hazardSla';
import { markResolved } from '../domain/hazardClosure';
import { generateWeeklySafetySummary } from '../ai/gemini';
import { AppError } from '../../shared/errors';
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

/**
 * Pure helper to compute team feedback heatmap adhering to k >= 3 anonymity.
 * Submissions are grouped by team and only the most recent ISO week with data
 * for each team is aggregated.
 */
export function computeFeedbackHeatmap(
  feedbackList: FeedbackSubmission[],
  rosterNames: string[] = [],
): AggregatedFeedback[] {
  // Group by team
  const byTeam = new Map<string, FeedbackSubmission[]>();
  for (const f of feedbackList) {
    const list = byTeam.get(f.team) ?? [];
    list.push(f);
    byTeam.set(f.team, list);
  }

  const result: AggregatedFeedback[] = [];

  for (const [team, subs] of byTeam.entries()) {
    // Find all unique isoWeeks and sort descending so [0] is the most recent
    const uniqueWeeks = Array.from(new Set(subs.map((s) => s.isoWeek).filter(Boolean))).sort(
      (a, b) => b.localeCompare(a),
    );
    const mostRecentWeek = uniqueWeeks[0];
    if (!mostRecentWeek) continue;

    const recentSubs = subs.filter((s) => s.isoWeek === mostRecentWeek);
    const agg = aggregateFeedback(recentSubs, team, mostRecentWeek, 3, rosterNames);
    result.push(agg);
  }

  return result;
}

/** Everything the console reads for one organisation, or one site of it. */
interface Scope {
  workers: Worker[];
  shifts: Shift[];
  hazards: HazardReport[];
  feedback: FeedbackSubmission[];
}

/**
 * Loads a scope with one parallel round of queries. Wrapped in React `cache`, so the overview
 * page, which needs KPIs, risk, the trend and the heatmap, reads each collection once per
 * request instead of once per widget. Outside a request (tests, scripts) it simply runs.
 */
const loadScope = cache(async (orgId: string, siteId?: string): Promise<Scope> => {
  const db = getDatabase();
  const [workers, shifts, hazards, feedback] = await Promise.all([
    siteId ? db.workers.listBySite(siteId) : db.workers.listByOrg(orgId),
    siteId ? db.shifts.listBySite(siteId) : db.shifts.listByOrg(orgId),
    siteId ? db.hazards.listBySite(siteId) : db.hazards.listByOrg(orgId),
    siteId ? db.feedback.listBySite(siteId) : db.feedback.listByOrg(orgId),
  ]);
  return { workers, shifts, hazards, feedback };
});

export class AdminService {
  private db = getDatabase();

  /**
   * Fatigue flags and quit-risk for one worker, from their own shifts and complaints
   * plus their team's anonymous sentiment. Shared by the overview and the risk table
   * so both always agree.
   */
  private assessWorker(worker: Worker, { shifts, hazards, feedback }: Scope, now: Date) {
    const weekAgoMs = now.getTime() - WEEK_MS;
    const workerShifts = shifts.filter((s) => s.workerId === worker.id);
    const flags = evaluateFatigue({
      shifts: workerShifts,
      windowStart: new Date(weekAgoMs).toISOString(),
      windowEnd: now.toISOString(),
    });

    const weeklyHours = workerShifts
      .filter((s) => s.checkOut && new Date(s.checkIn).getTime() >= weekAgoMs)
      .reduce(
        (sum, s) =>
          sum + (new Date(s.checkOut!).getTime() - new Date(s.checkIn).getTime()) / 3600000,
        0,
      );

    const unresolvedComplaints = hazards.filter(
      (h) => h.reporterId === worker.id && h.status !== 'resolved',
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
  async login(
    email: string,
    password: string,
  ): Promise<{ admin: Omit<Admin, 'passwordHash'>; token: string }> {
    const admin = await this.db.admins.getByEmail(email);
    if (!admin) {
      throw new AppError('invalid_credentials', 'Invalid email or password');
    }

    const isValid = await verifySecret(password, admin.passwordHash);
    if (!isValid) {
      throw new AppError('invalid_credentials', 'Invalid email or password');
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
    const scope = await loadScope(orgId, siteId);
    const now = new Date();
    // Escalation is computed on read (deadline passed, not acknowledged), not taken from storage.
    const liveStatuses = scope.hazards.map((h) => computeHazardStatus(h, now));
    const assessments = scope.workers.map((w) => this.assessWorker(w, scope, now));

    return {
      onSiteNow: scope.shifts.filter((s) => s.checkOut === null).length,
      totalWorkers: scope.workers.length,
      escalatedHazards: liveStatuses.filter((st) => st === 'escalated').length,
      openHazards: liveStatuses.filter((st) => st !== 'resolved').length,
      fatigueFlags: assessments.filter((a) => a.flags.length > 0).length,
      highQuitRisk: assessments.filter((a) => a.risk.score > 50).length,
    };
  }

  /**
   * Executive AI summary of workforce state.
   */
  async getAiSummary(
    orgId: string,
    siteId?: string,
    kpis?: OverviewKPIs,
  ): Promise<{ summary: string; isAi: boolean }> {
    return generateWeeklySafetySummary(kpis ?? (await this.getOverviewKPIs(orgId, siteId)));
  }

  /**
   * Hand-built SVG attendance trend for past N days (default 14 days).
   */
  async getAttendanceTrend(
    orgId: string,
    siteId?: string,
    days: number = 14,
  ): Promise<DailyAttendance[]> {
    const { workers, shifts } = await loadScope(orgId, siteId);
    const totalWorkers = workers.length;
    const result: DailyAttendance[] = [];

    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * DAY_MS);
      const dateStr = istDateKey(d);

      // Count unique workers present on this day
      const presentWorkers = new Set(
        shifts.filter((s) => istDateKey(s.checkIn) === dateStr).map((s) => s.workerId),
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
  async getSafetyQueue(
    orgId: string,
    siteId?: string,
  ): Promise<(HazardReport & { remainingSeconds: number; slaFormatted: string })[]> {
    const { hazards } = await loadScope(orgId, siteId);
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
    if (!hazard || !allowedOrgIds.includes(hazard.orgId)) {
      throw new AppError('not_found', 'Hazard not found');
    }

    hazard.acknowledgedAt = new Date().toISOString();
    hazard.status = 'acknowledged';
    return await this.db.hazards.update(hazard);
  }

  /**
   * Resolve a hazard report. A named reporter is then asked to confirm the fix (two-key closure).
   */
  async resolveHazard(hazardId: string, allowedOrgIds: string[]): Promise<HazardReport> {
    const hazard = await this.db.hazards.getById(hazardId);
    if (!hazard || !allowedOrgIds.includes(hazard.orgId)) {
      throw new AppError('not_found', 'Hazard not found');
    }

    return await this.db.hazards.update(markResolved(hazard));
  }

  /**
   * Anonymous team feedback heatmap adhering to k >= 3 anonymity.
   */
  async getFeedbackHeatmap(orgId: string, siteId?: string): Promise<AggregatedFeedback[]> {
    const { feedback, workers } = await loadScope(orgId, siteId);
    return computeFeedbackHeatmap(
      feedback,
      workers.map((w) => w.name),
    );
  }

  /**
   * Workforce quit-risk assessment with ranked reasons.
   */
  async getWorkforceRisk(
    orgId: string,
    siteId?: string,
  ): Promise<(PublicWorker & { risk: QuitRiskResult })[]> {
    const scope = await loadScope(orgId, siteId);
    const now = new Date();
    const ranked = scope.workers.map((worker) => {
      const { risk } = this.assessWorker(worker, scope, now);
      // Never hand the PIN hash to a client, even an admin.
      const { pinHash: _pinHash, ...publicWorker } = worker;
      return { ...publicWorker, risk };
    });

    return ranked.sort((a, b) => b.risk.score - a.risk.score);
  }

  /**
   * Retrieve sites for an organisation.
   */
  async getSites(orgId: string): Promise<PublicSite[]> {
    return (await this.db.sites.listByOrg(orgId)).map(toPublicSite);
  }

  /**
   * Retrieve site by id.
   */
  async getSiteById(siteId: string): Promise<Site | null> {
    return await this.db.sites.get(siteId);
  }
}

export const adminService = new AdminService();
