/**
 * Worker use-cases: login, check-in and check-out, hazard reports, anonymous feedback, and the
 * reads behind the worker screens. Every method takes the worker id from the signed session (the
 * caller), never from client input, and re-checks that the site belongs to the worker's
 * organisation. Presentation shaping lives in workerViews.ts.
 */

import { getDatabase } from '../repos';
import { verifySecret } from '../auth/password';
import { deriveServerSecret, signSession } from '../auth/session';
import { receiptSecret } from '../auth/receiptKey';
import { sealShift } from '../domain/shiftReceipt';
import { ballotId } from '../domain/feedbackBallot';
import { verifySiteQrCode, verifySiteQrCodeAt } from '../domain/qrCode';
import { validateCapturedAt } from '../domain/offline';
import { verifyGeofence } from '../domain/geofence';
import { calculatePayslip } from '../domain/payslip';
import { shiftsInPeriod } from '../domain/registers';
import { policyForDate } from '../domain/payRules';
import { calculateShiftsOvertime } from '../domain/overtime';
import { istDateKey, istMonthStart, WEEK_MS } from '../domain/time';
import { evaluateFatigue } from '../domain/fatigue';
import { scrubPii, calculateIsoWeek } from '../domain/anonymity';
import { summarizeHazard } from '../ai/gemini';
import { applyReporterVerdict, canGiveVerdict } from '../domain/hazardClosure';
import { coarsenToHour, severityFloor } from '../domain/hazardSignals';
import {
  applyPayVerdict,
  canGivePayVerdict,
  openPayQuery,
  payQueryState,
} from '../domain/payQuery';
import { newRecordId } from '../ids';
import { AppError } from '../../shared/errors';
import type {
  FatigueFlag,
  FeedbackSubmission,
  HazardReport,
  HazardSeverity,
  OvertimeResult,
  PayQuery,
  PayQueryReason,
  PayQueryVerdict,
  PayslipResult,
  ReporterVerdict,
  Shift,
  Site,
  SkillRecord,
  Worker,
} from '../../shared/types';

/** An open shift older than 16 hours is treated as a missed check-out. */
export const STALE_OPEN_SHIFT_MS = 16 * 60 * 60 * 1000;

export type PublicWorker = Omit<Worker, 'pinHash'>;

/** Fields every offline-capable action carries. */
interface Replayable {
  /** When the worker performed the action (ISO), if it was queued offline. */
  capturedAt?: string;
  /** Idempotency key from the client outbox. */
  clientId?: string;
}

export interface CheckInInput extends Replayable {
  siteId: string;
  code?: string;
  lat?: number;
  lng?: number;
}

export interface CheckOutInput extends Replayable {
  /** Close this shift; without it, the worker's open shift is closed. */
  shiftId?: string;
}

export interface HazardInput extends Replayable {
  siteId: string;
  category: string;
  description: string;
  severity: HazardSeverity;
  anonymous: boolean;
}

export interface PayQueryInput {
  reason: PayQueryReason;
  receivedAmount: number | null;
  note: string | null;
  clientId?: string;
}

export interface FeedbackInput extends Replayable {
  siteId: string;
  managerRespect: number;
  safetyRating: number;
  payFairness: number;
  workloadRating: number;
  comment: string | null;
}

function toPublicWorker({ pinHash: _pinHash, ...rest }: Worker): PublicWorker {
  return rest;
}

/** The capture time to store: the validated offline time, or now. */
function resolveCapturedAt(capturedAt: string | undefined): string {
  if (!capturedAt) return new Date().toISOString();
  const check = validateCapturedAt(capturedAt);
  if (!check.valid) {
    throw new AppError('invalid_capture_time', `Invalid capture time: ${check.reason}`);
  }
  return capturedAt;
}

/** A replayed action returns the record it already created instead of writing a duplicate. */
function findReplay<T extends { clientId?: string }>(
  records: T[],
  clientId: string | undefined,
): T | undefined {
  return clientId ? records.find((r) => r.clientId === clientId) : undefined;
}

export class WorkerService {
  private db = getDatabase();

  private async requireWorker(workerId: string): Promise<Worker> {
    const worker = await this.db.workers.getById(workerId);
    if (!worker) throw new AppError('not_found', 'Worker not found');
    return worker;
  }

  /** A worker may only act at a site of their own organisation. */
  private async requireOwnSite(worker: Worker, siteId: string): Promise<Site> {
    const site = await this.db.sites.get(siteId);
    if (!site || site.orgId !== worker.orgId) throw new AppError('not_found', 'Site not found');
    return site;
  }

  /** Phone + 4-digit PIN. Every failure reads the same, so a phone number cannot be probed. */
  async login(phone: string, pin: string): Promise<{ worker: PublicWorker; token: string }> {
    const worker = await this.db.workers.getByPhone(phone);
    if (!worker || !worker.active || !(await verifySecret(pin, worker.pinHash))) {
      throw new AppError('invalid_credentials', 'Invalid phone number or PIN');
    }
    const token = signSession({ userId: worker.id, orgId: worker.orgId, role: 'worker' });
    return { worker: toPublicWorker(worker), token };
  }

  async getProfile(workerId: string): Promise<PublicWorker | null> {
    const worker = await this.db.workers.getById(workerId);
    return worker ? toPublicWorker(worker) : null;
  }

  /** Check in with the rotating gate QR code, or by GPS inside the site geofence. */
  async checkIn(workerId: string, input: CheckInInput): Promise<{ shift: Shift; message: string }> {
    const worker = await this.requireWorker(workerId);
    const replay = findReplay(await this.db.shifts.listByWorker(workerId), input.clientId);
    if (replay) return { shift: replay, message: 'Already checked in' };

    const site = await this.requireOwnSite(worker, input.siteId);
    const checkInAt = resolveCapturedAt(input.capturedAt);

    // An open shift from an earlier day means a missed check-out. Close it at its own start
    // (0 hours, so it cannot inflate pay or overtime) and let the worker check in again; the
    // supervisor can correct the record.
    let open = await this.db.shifts.getActiveForWorker(workerId);
    if (open && Date.now() - Date.parse(open.checkIn) > STALE_OPEN_SHIFT_MS) {
      await this.db.shifts.update(sealShift({ ...open, checkOut: open.checkIn }, receiptSecret()));
      open = null;
    }
    if (open) return { shift: open, message: 'Already checked in' };

    const method = this.verifyPresence(site, input);
    const shift = await this.db.shifts.create({
      id: newRecordId('shift'),
      workerId,
      siteId: site.id,
      orgId: worker.orgId,
      checkIn: checkInAt,
      checkOut: null,
      method,
      ...(input.clientId ? { clientId: input.clientId } : {}),
    });
    return { shift, message: 'Checked in successfully' };
  }

  /** Proof the worker is at the gate. An offline scan is checked against its capture time. */
  private verifyPresence(site: Site, input: CheckInInput): Shift['method'] {
    if (input.code) {
      const valid = input.capturedAt
        ? verifySiteQrCodeAt(input.code, site.qrSecret, Date.parse(input.capturedAt))
        : verifySiteQrCode(input.code, site.qrSecret);
      if (!valid) {
        throw new AppError('invalid_code', 'Invalid or expired 6-digit site check-in code');
      }
      return 'qr';
    }
    if (input.lat !== undefined && input.lng !== undefined) {
      const geo = verifyGeofence(input.lat, input.lng, site);
      if (!geo.withinRadius) {
        throw new AppError(
          'outside_geofence',
          `Outside site geofence (${geo.distanceMetres}m from site gate)`,
        );
      }
      return 'gps';
    }
    throw new AppError('no_checkin_method', 'Provide a valid QR code or GPS location to check in');
  }

  /**
   * Close a shift and seal its receipt. Idempotent: closing an already closed shift returns it
   * unchanged.
   */
  async checkOut(workerId: string, input: CheckOutInput = {}): Promise<Shift> {
    if (input.clientId) {
      const shifts = await this.db.shifts.listByWorker(workerId);
      const replay = shifts.find(
        (s) =>
          s.checkOutClientId === input.clientId ||
          (s.clientId === input.clientId && s.checkOut !== null),
      );
      if (replay) return replay;
    }

    const shift = input.shiftId
      ? await this.db.shifts.getById(input.shiftId)
      : await this.db.shifts.getActiveForWorker(workerId);
    if (!shift || shift.workerId !== workerId) {
      throw new AppError('not_found', 'Shift record not found');
    }

    const checkOutAt = resolveCapturedAt(input.capturedAt);
    if (Date.parse(checkOutAt) < Date.parse(shift.checkIn)) {
      throw new AppError('checkout_before_checkin', 'Check-out time must be after check-in time');
    }
    if (shift.checkOut !== null) return shift;

    return this.db.shifts.update(
      sealShift(
        {
          ...shift,
          checkOut: checkOutAt,
          ...(input.clientId ? { checkOutClientId: input.clientId } : {}),
        },
        receiptSecret(),
      ),
    );
  }

  /** The open shift, the latest shifts, and fatigue flags for the last 7 days. */
  async getTodayStatus(workerId: string): Promise<{
    activeShift: Shift | null;
    recentShifts: Shift[];
    fatigueFlags: FatigueFlag[];
  }> {
    const [activeShift, allShifts] = await Promise.all([
      this.db.shifts.getActiveForWorker(workerId),
      this.db.shifts.listByWorker(workerId),
    ]);
    const now = new Date();
    const fatigueFlags = evaluateFatigue({
      shifts: allShifts,
      windowStart: new Date(now.getTime() - WEEK_MS).toISOString(),
      windowEnd: now.toISOString(),
    });
    return { activeShift, recentShifts: allShifts.slice(0, 5), fatigueFlags };
  }

  /** Payslip for the current IST calendar month so far. */
  async getMyPayslip(workerId: string): Promise<PayslipResult> {
    const worker = await this.requireWorker(workerId);
    const [org, allShifts] = await Promise.all([
      this.db.orgs.get(worker.orgId),
      this.db.shifts.listByWorker(workerId),
    ]);
    const now = new Date();
    const period = { start: istMonthStart(now), end: istDateKey(now) };
    return calculatePayslip({
      worker: { basePay: worker.basePay, allowances: worker.allowances, payType: worker.payType },
      shifts: shiftsInPeriod(allShifts, period),
      periodStart: period.start,
      periodEnd: period.end,
      policy: policyForDate(org),
    });
  }

  /**
   * Stores a hazard report with an English summary. Danger words raise the severity before the AI
   * runs. An anonymous report keeps no reporter id, and its time only to the hour.
   */
  async reportHazard(workerId: string, input: HazardInput): Promise<HazardReport> {
    const worker = await this.requireWorker(workerId);
    const site = await this.requireOwnSite(worker, input.siteId);
    const replay = findReplay(await this.db.hazards.listBySite(site.id), input.clientId);
    if (replay) return replay;

    const capturedAt = resolveCapturedAt(input.capturedAt);
    const reportedAt = input.anonymous ? coarsenToHour(capturedAt) : capturedAt;
    const severity = severityFloor(input.severity, input.description);
    const ai = await summarizeHazard(input.category, input.description, severity);

    return this.db.hazards.create({
      id: newRecordId('hazard'),
      orgId: site.orgId,
      siteId: site.id,
      reporterId: input.anonymous ? null : workerId,
      category: input.category,
      description: input.description,
      severity,
      status: 'reported',
      reportedAt,
      acknowledgedAt: null,
      resolvedAt: null,
      aiSummary: ai.summary,
      aiSuggestedSeverity: ai.suggestedSeverity,
      anonymous: input.anonymous,
      ...(input.clientId ? { clientId: input.clientId } : {}),
    });
  }

  /**
   * The reporter's second key on a resolved report: "fixed" closes it, "not_fixed" reopens it as
   * escalated. Someone else's report looks the same as a missing one.
   */
  async giveHazardVerdict(
    workerId: string,
    hazardId: string,
    verdict: ReporterVerdict,
  ): Promise<HazardReport> {
    const hazard = await this.db.hazards.getById(hazardId);
    if (!hazard || hazard.reporterId !== workerId) {
      throw new AppError('not_found', 'Hazard not found');
    }
    if (!canGiveVerdict(hazard, workerId)) {
      throw new AppError('verdict_not_allowed', 'This report is not waiting for your answer');
    }
    return this.db.hazards.update(applyReporterVerdict(hazard, verdict));
  }

  /**
   * Raises a question about this month's pay. The payslip figure is taken from the payslip engine,
   * never from the client. A second query for the same month and reason, while the first is still
   * open, returns the first instead of opening a duplicate.
   */
  async raisePayQuery(
    workerId: string,
    input: PayQueryInput,
    now: Date = new Date(),
  ): Promise<{ query: PayQuery; already: boolean }> {
    const worker = await this.requireWorker(workerId);
    const mine = await this.db.payQueries.listByWorker(workerId);
    const replay = findReplay(mine, input.clientId);
    if (replay) return { query: replay, already: true };

    const period = istDateKey(now).slice(0, 7);
    const pending = mine.find(
      (q) =>
        q.period === period && q.reason === input.reason && payQueryState(q, now) !== 'settled',
    );
    if (pending) return { query: pending, already: true };

    const payslip = await this.getMyPayslip(workerId);
    const query = openPayQuery(
      {
        id: newRecordId('payq'),
        orgId: worker.orgId,
        siteId: worker.siteId,
        workerId,
        reason: input.reason,
        period,
        payslipNet: payslip.net,
        receivedAmount: input.receivedAmount,
        note: input.note,
        ...(input.clientId ? { clientId: input.clientId } : {}),
      },
      now,
    );
    return { query: await this.db.payQueries.create(query), already: false };
  }

  async listMyPayQueries(workerId: string): Promise<PayQuery[]> {
    return this.db.payQueries.listByWorker(workerId);
  }

  /** The worker's own query; anyone else's looks the same as a missing one. */
  async getMyPayQuery(workerId: string, queryId: string): Promise<PayQuery | null> {
    const query = await this.db.payQueries.getById(queryId);
    return query && query.workerId === workerId ? query : null;
  }

  /** The worker's second key: "settled" closes the query, "not settled" sends it back. */
  async givePayVerdict(
    workerId: string,
    queryId: string,
    verdict: PayQueryVerdict,
  ): Promise<PayQuery> {
    const query = await this.getMyPayQuery(workerId, queryId);
    if (!query) throw new AppError('not_found', 'Pay query not found');
    if (!canGivePayVerdict(query, workerId)) {
      throw new AppError('verdict_not_allowed', 'This pay query is not waiting for your answer');
    }
    return this.db.payQueries.update(applyPayVerdict(query, verdict));
  }

  /**
   * Stores anonymous feedback: no worker id, the team and ISO week only, and names on the site
   * roster (plus phones, emails and ID numbers) scrubbed from the comment. One answer per worker,
   * team and week (a ballot claimed first), so one person cannot open the team's comments alone.
   */
  async submitFeedback(workerId: string, input: FeedbackInput): Promise<FeedbackSubmission> {
    const worker = await this.requireWorker(workerId);
    const site = await this.requireOwnSite(worker, input.siteId);
    const replay = findReplay(await this.db.feedback.listBySite(site.id), input.clientId);
    if (replay) return replay;

    const isoWeek = calculateIsoWeek(new Date(resolveCapturedAt(input.capturedAt)));
    const claimed = await this.db.feedbackBallots.claim({
      id: feedbackBallotId(worker.id, worker.team, isoWeek),
      siteId: site.id,
      team: worker.team,
      isoWeek,
    });
    if (!claimed) {
      throw new AppError('feedback_already_given', 'Feedback already given this week');
    }
    const roster = (await this.db.workers.listBySite(site.id)).map((w) => w.name);

    return this.db.feedback.create({
      id: newRecordId('fb'),
      orgId: worker.orgId,
      siteId: site.id,
      team: worker.team,
      isoWeek,
      managerRespect: input.managerRespect,
      safetyRating: input.safetyRating,
      payFairness: input.payFairness,
      workloadRating: input.workloadRating,
      comment: input.comment ? scrubPii(input.comment, roster) : null,
      ...(input.clientId ? { clientId: input.clientId } : {}),
    });
  }

  /** Whether this worker has already answered for their team this week. */
  async hasGivenFeedback(workerId: string, at: Date = new Date()): Promise<boolean> {
    const worker = await this.requireWorker(workerId);
    return this.db.feedbackBallots.has(
      feedbackBallotId(worker.id, worker.team, calculateIsoWeek(at)),
    );
  }

  /** Shifts of the last 14 days with overtime, and fatigue flags for the last 7. */
  async getMyHours(workerId: string): Promise<{
    shifts: Shift[];
    otSummary: OvertimeResult;
    fatigueFlags: FatigueFlag[];
  }> {
    const worker = await this.requireWorker(workerId);
    const [org, allShifts] = await Promise.all([
      this.db.orgs.get(worker.orgId),
      this.db.shifts.listByWorker(workerId),
    ]);
    const now = Date.now();
    const shifts = allShifts.filter((s) => Date.parse(s.checkIn) >= now - 2 * WEEK_MS);
    // A monthly wage covers 26 working days of 8 hours (208 h).
    const hourlyRate = worker.payType === 'daily' ? worker.basePay / 8 : worker.basePay / 208;
    const otSummary = calculateShiftsOvertime(shifts, hourlyRate, policyForDate(org));
    // Fatigue limits are defined per 7 days, so evaluate the same window as Home does.
    const fatigueFlags = evaluateFatigue({
      shifts,
      windowStart: new Date(now - WEEK_MS).toISOString(),
      windowEnd: new Date(now).toISOString(),
    });
    return { shifts, otSummary, fatigueFlags };
  }

  async getMySkills(workerId: string): Promise<SkillRecord[]> {
    return this.db.skills.listByWorker(workerId);
  }
}

function feedbackBallotId(workerId: string, team: string, isoWeek: string): string {
  return ballotId(deriveServerSecret('feedback-ballot'), workerId, team, isoWeek);
}

export const workerService = new WorkerService();
