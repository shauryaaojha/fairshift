// ============================================================
// FairShift — Services: Worker Service
// Orchestrates worker use cases: auth, check-in, payslips, hazards, feedback
// ============================================================

import { getDatabase } from '../repos';
import { verifySecret } from '../auth/password';
import { signSession } from '../auth/session';
import { verifySiteQrCode } from '../domain/qrCode';
import { verifyGeofence } from '../domain/geofence';
import { calculatePayslip } from '../domain/payslip';
import { calculateShiftsOvertime } from '../domain/overtime';
import { istDateKey, istMonthStart } from '../domain/time';
import { evaluateFatigue } from '../domain/fatigue';
import { scrubPii, calculateIsoWeek } from '../domain/anonymity';
import { summarizeHazard } from '../ai/gemini';
import type {
  Worker,
  Shift,
  HazardReport,
  HazardSeverity,
  FeedbackSubmission,
  SkillRecord,
  PayslipResult,
  FatigueFlag,
  OvertimeResult,
} from '../../shared/types';

/** An open shift older than this is treated as a missed check-out. */
const STALE_OPEN_SHIFT_MS = 16 * 60 * 60 * 1000;

export class WorkerService {
  private db = getDatabase();

  /**
   * Worker login with phone + 4-digit PIN.
   */
  async login(phone: string, pin: string): Promise<{ worker: Omit<Worker, 'pinHash'>; token: string }> {
    const worker = await this.db.workers.getByPhone(phone);
    if (!worker || !worker.active) {
      throw new Error('Invalid phone number or inactive account');
    }

    const isValid = await verifySecret(pin, worker.pinHash);
    if (!isValid) {
      throw new Error('Invalid 4-digit PIN');
    }

    const token = signSession({
      userId: worker.id,
      orgId: worker.orgId,
      role: 'worker',
    });

    const { pinHash: _, ...workerData } = worker;
    return { worker: workerData, token };
  }

  /**
   * Get worker profile by ID.
   */
  async getProfile(workerId: string): Promise<Omit<Worker, 'pinHash'> | null> {
    const worker = await this.db.workers.getById(workerId);
    if (!worker) return null;
    const { pinHash: _, ...workerData } = worker;
    return workerData;
  }

  /**
   * Check in via rotating QR code or GPS geofence.
   */
  async checkIn(
    workerId: string,
    params: { siteId: string; code?: string; lat?: number; lng?: number }
  ): Promise<{ shift: Shift; message: string }> {
    const worker = await this.db.workers.getById(workerId);
    if (!worker) throw new Error('Worker not found');

    const site = await this.db.sites.get(params.siteId);
    // A worker can only check in at a site of their own organisation.
    if (!site || site.orgId !== worker.orgId) throw new Error('Site not found');

    // An open shift from an earlier day means a missed check-out. Close it at its
    // own start (0 hours, so it cannot inflate pay or overtime) and let the worker
    // check in again; the supervisor can correct the record.
    let existingActive = await this.db.shifts.getActiveForWorker(workerId);
    if (existingActive && Date.now() - Date.parse(existingActive.checkIn) > STALE_OPEN_SHIFT_MS) {
      await this.db.shifts.update({ ...existingActive, checkOut: existingActive.checkIn });
      existingActive = null;
    }
    if (existingActive) {
      return { shift: existingActive, message: 'Already checked in' };
    }

    let verifiedMethod: 'qr' | 'gps' = 'qr';

    if (params.code) {
      const isQrValid = verifySiteQrCode(params.code, site.qrSecret);
      if (!isQrValid) {
        throw new Error('Invalid or expired 6-digit site check-in code');
      }
      verifiedMethod = 'qr';
    } else if (params.lat !== undefined && params.lng !== undefined) {
      const geoResult = verifyGeofence(params.lat, params.lng, site);
      if (!geoResult.withinRadius) {
        throw new Error(`Outside site geofence (${geoResult.distanceMetres}m from site gate)`);
      }
      verifiedMethod = 'gps';
    } else {
      throw new Error('Provide a valid QR code or GPS location to check in');
    }

    const newShift: Shift = {
      id: `shift-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      workerId,
      siteId: site.id,
      orgId: worker.orgId,
      checkIn: new Date().toISOString(),
      checkOut: null,
      method: verifiedMethod,
    };

    const saved = await this.db.shifts.create(newShift);
    return { shift: saved, message: 'Checked in successfully' };
  }

  /**
   * Check out from active shift.
   */
  async checkOut(workerId: string, shiftId: string): Promise<Shift> {
    const shift = await this.db.shifts.getById(shiftId);
    if (!shift || shift.workerId !== workerId) {
      throw new Error('Shift record not found');
    }
    if (shift.checkOut !== null) {
      return shift;
    }

    shift.checkOut = new Date().toISOString();
    return await this.db.shifts.update(shift);
  }

  /**
   * Get today's active shift status.
   */
  async getTodayStatus(workerId: string): Promise<{
    activeShift: Shift | null;
    recentShifts: Shift[];
    fatigueFlags: FatigueFlag[];
  }> {
    const activeShift = await this.db.shifts.getActiveForWorker(workerId);
    const allShifts = await this.db.shifts.listByWorker(workerId);

    // Past 7 days window for fatigue check
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fatigueFlags = evaluateFatigue({
      shifts: allShifts,
      windowStart: weekAgo.toISOString(),
      windowEnd: now.toISOString(),
    });

    return {
      activeShift,
      recentShifts: allShifts.slice(0, 5),
      fatigueFlags,
    };
  }

  /**
   * Calculates payslip for the current period.
   */
  async getMyPayslip(workerId: string): Promise<PayslipResult> {
    const worker = await this.db.workers.getById(workerId);
    if (!worker) throw new Error('Worker not found');

    const org = await this.db.orgs.get(worker.orgId);
    const allShifts = await this.db.shifts.listByWorker(workerId);

    const now = new Date();
    const periodStart = istMonthStart(now);
    const periodEnd = istDateKey(now);

    const periodShifts = allShifts.filter((s) => {
      const d = istDateKey(s.checkIn);
      return d >= periodStart && d <= periodEnd;
    });

    return calculatePayslip({
      worker: {
        basePay: worker.basePay,
        allowances: worker.allowances,
        payType: worker.payType,
      },
      shifts: periodShifts,
      periodStart,
      periodEnd,
      policy: org?.policy,
    });
  }

  /**
   * Reports a workplace hazard.
   */
  async reportHazard(
    workerId: string,
    input: {
      siteId: string;
      category: string;
      description: string;
      severity: HazardSeverity;
      anonymous: boolean;
    }
  ): Promise<HazardReport> {
    // The reporter is always authenticated; anonymity only drops the id from the stored record.
    const worker = await this.db.workers.getById(workerId);
    if (!worker) throw new Error('Worker not found');
    const site = await this.db.sites.get(input.siteId);
    if (!site || site.orgId !== worker.orgId) throw new Error('Site not found');

    const summaryResult = await summarizeHazard(
      input.category,
      input.description,
      input.severity
    );

    const hazard: HazardReport = {
      id: `hazard-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      orgId: site.orgId,
      siteId: site.id,
      reporterId: input.anonymous ? null : workerId,
      category: input.category,
      description: input.description,
      severity: input.severity,
      status: 'reported',
      reportedAt: new Date().toISOString(),
      acknowledgedAt: null,
      resolvedAt: null,
      aiSummary: summaryResult.summary,
      aiSuggestedSeverity: summaryResult.suggestedSeverity,
      anonymous: input.anonymous,
    };

    return await this.db.hazards.create(hazard);
  }

  /**
   * Submits anonymous feedback with PII scrubbing.
   */
  async submitFeedback(
    workerId: string,
    input: {
      siteId: string;
      managerRespect: number;
      safetyRating: number;
      payFairness: number;
      workloadRating: number;
      comment: string | null;
    }
  ): Promise<FeedbackSubmission> {
    const worker = await this.db.workers.getById(workerId);
    if (!worker) throw new Error('Worker not found');

    const site = await this.db.sites.get(input.siteId);
    if (!site || site.orgId !== worker.orgId) throw new Error('Site not found');

    // Fetch team roster names for scrubbing
    const siteWorkers = await this.db.workers.listBySite(input.siteId);
    const rosterNames = siteWorkers.map((w) => w.name);

    const scrubbedComment = input.comment ? scrubPii(input.comment, rosterNames) : null;
    const isoWeek = calculateIsoWeek(new Date());

    const feedback: FeedbackSubmission = {
      id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      orgId: worker.orgId,
      siteId: site.id,
      team: worker.team,
      isoWeek,
      managerRespect: input.managerRespect,
      safetyRating: input.safetyRating,
      payFairness: input.payFairness,
      workloadRating: input.workloadRating,
      comment: scrubbedComment,
    };

    return await this.db.feedback.create(feedback);
  }

  /**
   * Get shifts and hours breakdown for past 2 weeks.
   */
  async getMyHours(workerId: string): Promise<{
    shifts: Shift[];
    otSummary: OvertimeResult;
    fatigueFlags: FatigueFlag[];
  }> {
    const worker = await this.db.workers.getById(workerId);
    if (!worker) throw new Error('Worker not found');

    const org = await this.db.orgs.get(worker.orgId);
    const allShifts = await this.db.shifts.listByWorker(workerId);

    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const recentShifts = allShifts.filter(
      (s) => new Date(s.checkIn).getTime() >= twoWeeksAgo.getTime()
    );

    const hourlyRate = worker.payType === 'daily' ? worker.basePay / 8 : worker.basePay / 208;
    const otSummary = calculateShiftsOvertime(recentShifts, hourlyRate, org?.policy);

    // Fatigue limits are defined per 7 days, so evaluate the same window as Home does.
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fatigueFlags = evaluateFatigue({
      shifts: recentShifts,
      windowStart: weekAgo.toISOString(),
      windowEnd: now.toISOString(),
    });

    return {
      shifts: recentShifts,
      otSummary,
      fatigueFlags,
    };
  }

  /**
   * Get verified skill passport credentials.
   */
  async getMySkills(workerId: string): Promise<SkillRecord[]> {
    return await this.db.skills.listByWorker(workerId);
  }
}

export const workerService = new WorkerService();
