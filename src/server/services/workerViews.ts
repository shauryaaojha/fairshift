/**
 * Worker views: shapes and composes domain and repository data for worker mobile screens.
 * Services handle business use-cases and domain rules; views shape and compose data specifically
 * for presentation and page rendering.
 */

import { cookies } from 'next/headers';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { workerService } from './workerService';
import { getDatabase } from '../repos';
import { SESSION_COOKIE_NAME, verifySession } from '../auth/session';
import { explainPayslip } from '../ai/gemini';
import {
  DEFAULT_DAILY_HOURS_LIMIT,
  calculateShiftHours,
  calculateShiftsOvertime,
} from '../domain/overtime';
import { DAY_MS, WEEK_MS, istDateKey } from '../domain/time';
import { receiptCode } from '../domain/shiftReceipt';
import {
  buildLabourLetter,
  canWriteLetter,
  letterPeriod,
  type LabourLetter,
} from '../domain/labourLetter';
import { shiftsInPeriod } from '../domain/registers';
import { signPeriod } from './receipts';
import QRCode from 'qrcode';
import { canGiveVerdict, closureState, type ClosureState } from '../domain/hazardClosure';
import { policyForDate } from '../domain/payRules';
import { payQueryState, wagesDueBy, type PayQueryState } from '../domain/payQuery';
import { payablePeriods, payslipForMonth, wageState, type WageState } from '../domain/wagePayment';
import { LOCALE_COOKIE, SPEECH_LANG, parseLocale, t } from '../../i18n';
import type {
  FatigueFlag,
  HazardReport,
  HazardStatus,
  Locale,
  OvertimeResult,
  PayQuery,
  PayslipResult,
  Shift,
  Site,
  WagePayment,
  Worker,
} from '../../shared/types';

export const IST = 'Asia/Kolkata';

// ── Pure helpers ────────────────────────────────────────────

/** hh:mm (24 h) in site time. */
export function formatClock(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '--:--';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: IST,
  }).format(d);
}

/** "27 Oct" style date for a locale. Accepts a full ISO time or a YYYY-MM-DD date. */
export function formatDay(isoOrDate: string, locale: Locale, withWeekday = false): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(isoOrDate);
  const d = new Date(dateOnly ? `${isoOrDate}T00:00:00Z` : isoOrDate);
  if (isNaN(d.getTime())) return isoOrDate;
  return new Intl.DateTimeFormat(SPEECH_LANG[locale], {
    day: 'numeric',
    month: 'short',
    ...(withWeekday ? { weekday: 'short' as const } : {}),
    timeZone: dateOnly ? 'UTC' : IST,
  }).format(d);
}

/** "October 2026" style month for a locale, from `YYYY-MM`. */
export function formatMonth(period: string, locale: Locale): string {
  const d = new Date(`${period}-01T00:00:00Z`);
  if (isNaN(d.getTime())) return period;
  return new Intl.DateTimeFormat(SPEECH_LANG[locale], {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

export function formatRupees(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** The stamp a pay query shows: who it is waiting for, or settled. */
export const PAY_QUERY_STAMP: Record<
  PayQueryState,
  { variant: 'hivis' | 'ink' | 'cleared' | 'escalated'; labelKey: string }
> = {
  open: { variant: 'ink', labelKey: 'payq.state.open' },
  overdue: { variant: 'escalated', labelKey: 'payq.state.overdue' },
  awaiting_worker: { variant: 'hivis', labelKey: 'payq.state.awaiting_worker' },
  settled: { variant: 'cleared', labelKey: 'payq.state.settled' },
};

export interface FatigueNote {
  type: FatigueFlag['type'];
  text: string;
}

/** Turn engine flags into plain sentences in the worker's language. */
export function describeFatigue(flags: FatigueFlag[], locale: Locale): FatigueNote[] {
  return flags.map((flag) => {
    const params = { ...flag.params };
    if (typeof params.date === 'string') params.date = formatDay(params.date, locale);
    return { type: flag.type, text: t(locale, flag.messageKey, params) };
  });
}

export type TimelineKey =
  'reported' | 'reopened' | 'escalated' | 'acknowledged' | 'resolved' | 'confirmed';
export interface TimelineStep {
  key: TimelineKey;
  at: string | null;
  done: boolean;
}
export interface HazardTimeline {
  steps: TimelineStep[];
  /** Stamp to show for the current state. */
  stamp: { variant: 'hivis' | 'ink' | 'cleared' | 'escalated'; labelKey: string };
  /** Where the two-key closure stands; `awaiting_reporter` means the worker should answer. */
  closure: ClosureState;
}

/**
 * Reported -> Acknowledged -> Resolved, then "Confirmed" for a named report (two-key closure).
 * A report the worker reopened shows a Reopened node; one that missed its SLA shows Escalated.
 */
export function hazardTimeline(
  h: Pick<
    HazardReport,
    | 'status'
    | 'reportedAt'
    | 'acknowledgedAt'
    | 'resolvedAt'
    | 'reporterId'
    | 'reporterVerdict'
    | 'verdictAt'
    | 'reopenedAt'
  >,
): HazardTimeline {
  const steps: TimelineStep[] = [{ key: 'reported', at: h.reportedAt, done: true }];
  if (h.reopenedAt) steps.push({ key: 'reopened', at: h.reopenedAt, done: true });
  else if (h.status === 'escalated') steps.push({ key: 'escalated', at: null, done: true });
  steps.push({ key: 'acknowledged', at: h.acknowledgedAt, done: h.acknowledgedAt !== null });
  steps.push({ key: 'resolved', at: h.resolvedAt, done: h.resolvedAt !== null });
  const closure = closureState(h);
  if (h.reporterId !== null) {
    const confirmed = closure === 'confirmed';
    steps.push({ key: 'confirmed', at: confirmed ? (h.verdictAt ?? null) : null, done: confirmed });
  }

  const stampByStatus: Record<HazardStatus, HazardTimeline['stamp']> = {
    reported: { variant: 'hivis', labelKey: 'hazard.stamp.logged' },
    acknowledged: { variant: 'ink', labelKey: 'hazard.stamp.acknowledged' },
    resolved: { variant: 'cleared', labelKey: 'hazard.stamp.resolved' },
    escalated: { variant: 'escalated', labelKey: 'hazard.stamp.escalated' },
  };
  const stamp =
    closure === 'confirmed'
      ? { variant: 'cleared' as const, labelKey: 'hazard.stamp.confirmed' }
      : stampByStatus[h.status];
  return { steps, stamp, closure };
}

/** Sentence read aloud for "Hear my payslip". Uses only numbers from the engine. */
export function buildPayslipSpeech(payslip: PayslipResult, locale: Locale): string {
  const parts = [
    t(locale, 'pay.spokenIntro', {
      start: formatDay(payslip.periodStart, locale),
      end: formatDay(payslip.periodEnd, locale),
    }),
  ];
  for (const line of payslip.lines) {
    if (line.key === 'payslip.net') continue;
    const label = t(locale, line.key);
    parts.push(
      t(locale, 'pay.spokenLine', {
        label: label === line.key ? line.label : label,
        amount: formatRupees(line.amount),
      }),
    );
  }
  parts.push(t(locale, 'pay.spokenNet', { amount: formatRupees(payslip.net) }));
  return parts.join(' ');
}

export interface DayRow {
  id: string;
  date: string;
  checkIn: string;
  checkOut: string | null;
  hours: number;
  open: boolean;
  /** The shift's receipt, sealed at check-out: a short code and the token for /verify. */
  receipt: { code: string; token: string } | null;
}
export interface WeekSummary {
  rows: DayRow[];
  totalHours: number;
  overtime: OvertimeResult;
}

/** Last 7 days of shifts, newest first, with totals. */
export function summarizeWeek(
  shifts: Shift[],
  now: Date,
  policy?: Parameters<typeof calculateShiftsOvertime>[2],
): WeekSummary {
  const cutoff = now.getTime() - WEEK_MS;
  const week = shifts
    .filter((s) => new Date(s.checkIn).getTime() >= cutoff)
    .sort((a, b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime());
  const rows: DayRow[] = week.map((s) => ({
    id: s.id,
    date: s.checkIn,
    checkIn: formatClock(s.checkIn),
    checkOut: s.checkOut ? formatClock(s.checkOut) : null,
    hours: Math.round(calculateShiftHours(s.checkIn, s.checkOut) * 10) / 10,
    open: s.checkOut === null,
    receipt: s.receipt ? { code: receiptCode(s.receipt), token: s.receipt } : null,
  }));
  const overtime = calculateShiftsOvertime(week, 0, policy);
  const totalHours = Math.round((overtime.regularHours + overtime.overtimeHours) * 10) / 10;
  return { rows, totalHours, overtime };
}

export function validateWorkerNext(next?: string | null): string {
  if (typeof next === 'string' && next.startsWith('/w/') && !next.startsWith('//')) {
    return next;
  }
  return '/w';
}

// ── Reads (server only) ─────────────────────────────────────

export async function getLocale(): Promise<Locale | null> {
  const jar = await cookies();
  return parseLocale(jar.get(LOCALE_COOKIE)?.value);
}

export interface WorkerContext {
  worker: Omit<Worker, 'pinHash'>;
  site: Site;
}

/** The signed-in worker and their site, or null. */
export async function getWorkerContext(): Promise<WorkerContext | null> {
  const jar = await cookies();
  // Worker screens are per-request (live shifts, SLA timers): never prerender them.
  await connection();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? verifySession(token) : null;
  if (!session || session.role !== 'worker') return null;
  const worker = await workerService.getProfile(session.userId);
  if (!worker || !worker.active) return null;
  const site = await getDatabase().sites.get(worker.siteId);
  if (!site) return null;
  return { worker, site };
}

/** Like getWorkerContext but redirects to the login page. */
export async function requireWorkerContext(): Promise<WorkerContext> {
  const ctx = await getWorkerContext();
  if (!ctx) redirect('/w/login');
  return ctx;
}

export async function loadHome(workerId: string) {
  const status = await workerService.getTodayStatus(workerId);
  return {
    activeShift: status.activeShift,
    fatigueFlags: status.fatigueFlags,
  };
}

/** One day of the home screen's muster strip, oldest first, ending today (IST). */
export interface MusterDay {
  date: string;
  hours: number;
  present: boolean;
  today: boolean;
}

/** The last seven IST days, each with the hours of the shifts that started on it. Pure. */
export function musterDays(rows: Pick<DayRow, 'date' | 'hours'>[], now: Date): MusterDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = istDateKey(new Date(now.getTime() - (6 - i) * DAY_MS));
    const worked = rows.filter((r) => istDateKey(r.date) === date);
    const hours = Math.round(worked.reduce((sum, r) => sum + r.hours, 0) * 10) / 10;
    return { date, hours, present: worked.length > 0, today: i === 6 };
  });
}

/** Something waiting on the worker, newest kind first. Each links to where it is answered. */
export type TodoItem =
  | { kind: 'letter_ready' | 'pay_answered' | 'hazard_fixed'; href: string }
  | { kind: 'wages_overdue'; href: string; period: string };

/** The home screen: the week at a glance, and whatever needs the worker's answer. */
export async function loadHomeBoard(worker: WorkerContext['worker'], now: Date = new Date()) {
  const [{ week }, hazards, queries, wages, org] = await Promise.all([
    loadHours(worker),
    listMyHazards(worker, 20),
    listMyPayQueries(worker.id),
    loadMyWages(worker, now),
    getDatabase().orgs.get(worker.orgId),
  ]);
  const rules = policyForDate(org)(istDateKey(now));
  const todo: TodoItem[] = [];
  for (const q of queries) {
    const href = `/w/pay/query/${encodeURIComponent(q.id)}`;
    if (canWriteLetter(q, now)) todo.push({ kind: 'letter_ready', href: `${href}/letter` });
    else if (payQueryState(q, now) === 'awaiting_worker') todo.push({ kind: 'pay_answered', href });
  }
  for (const h of hazards) {
    if (canGiveVerdict(h, worker.id)) {
      todo.push({ kind: 'hazard_fixed', href: `/w/hazard/${encodeURIComponent(h.id)}` });
    }
  }
  for (const w of wages) {
    if (w.state === 'overdue') {
      todo.push({ kind: 'wages_overdue', href: '/w/pay', period: w.period });
    }
  }
  return {
    days: musterDays(week.rows, now),
    totalHours: week.totalHours,
    overtimeHours: Math.round(week.overtime.overtimeHours * 10) / 10,
    dayHours: rules?.dailyHoursLimit ?? DEFAULT_DAILY_HOURS_LIMIT,
    todo,
  };
}

export async function loadPay(workerId: string): Promise<PayslipResult> {
  return workerService.getMyPayslip(workerId);
}

export interface MyWageMonth {
  period: string;
  state: WageState;
  dueBy: string;
  payment: WagePayment | null;
}

/**
 * Whether this month's and last month's wages were paid, with the UTR to show the bank. Last
 * month is left out when nothing was earned in it.
 */
export async function loadMyWages(
  worker: Pick<Worker, 'id' | 'orgId' | 'basePay' | 'allowances' | 'payType'>,
  now: Date = new Date(),
): Promise<MyWageMonth[]> {
  const db = getDatabase();
  const [previous, current] = payablePeriods(now);
  const [shifts, org, paidBefore, paidNow] = await Promise.all([
    db.shifts.listByWorker(worker.id),
    db.orgs.get(worker.orgId),
    db.wagePayments.get(worker.id, previous),
    db.wagePayments.get(worker.id, current),
  ]);
  const month = (period: string, payment: WagePayment | null): MyWageMonth => ({
    period,
    payment,
    state: wageState(period, payment, now),
    dueBy: wagesDueBy(period),
  });
  const earnedBefore =
    (payslipForMonth(worker, shifts, previous, now, policyForDate(org))?.net ?? 0) > 0;
  return paidBefore || earnedBefore
    ? [month(current, paidNow), month(previous, paidBefore)]
    : [month(current, paidNow)];
}

/** Plain-language explanation. AI first, deterministic fallback inside explainPayslip. */
export async function explainMyPayslip(
  workerId: string,
  locale: Locale,
): Promise<{ text: string; isAi: boolean }> {
  const payslip = await workerService.getMyPayslip(workerId);
  return explainPayslip(payslip, locale);
}

export async function loadHours(worker: Pick<Worker, 'id' | 'orgId'>) {
  const [{ shifts, fatigueFlags }, org] = await Promise.all([
    workerService.getMyHours(worker.id),
    getDatabase().orgs.get(worker.orgId),
  ]);
  return { week: summarizeWeek(shifts, new Date(), policyForDate(org)), fatigueFlags };
}

/** A hazard the worker may see: their own, or an anonymous one from their site. */
export async function loadHazard(worker: Pick<Worker, 'id' | 'siteId'>, hazardId: string) {
  const h = await getDatabase().hazards.getById(hazardId);
  if (!h || h.siteId !== worker.siteId) return null;
  if (h.reporterId !== null && h.reporterId !== worker.id) return null;
  return h;
}

/** The worker's own named reports, newest first. Anonymous ones are not linked to anyone. */
export async function listMyHazards(worker: Pick<Worker, 'id' | 'siteId'>, limit = 5) {
  const all = await getDatabase().hazards.listBySite(worker.siteId);
  return all
    .filter((h) => h.reporterId === worker.id)
    .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime())
    .slice(0, limit);
}

export async function loadSkills(workerId: string) {
  return workerService.getMySkills(workerId);
}

/** The worker's pay queries, newest first, with where each one stands. */
export async function listMyPayQueries(
  workerId: string,
): Promise<(PayQuery & { state: PayQueryState })[]> {
  const queries = await workerService.listMyPayQueries(workerId);
  return queries.map((q) => ({ ...q, state: payQueryState(q) }));
}

export async function loadPayQuery(
  workerId: string,
  queryId: string,
): Promise<(PayQuery & { state: PayQueryState }) | null> {
  const q = await workerService.getMyPayQuery(workerId, queryId);
  return q ? { ...q, state: payQueryState(q) } : null;
}

export interface LabourLetterView {
  letter: LabourLetter;
  worker: { name: string; phone: string };
  employer: string;
  site: string;
  /** The period receipt's link, and its QR as SVG, for the officer to check the hours. */
  verifyUrl: string;
  qrSvg: string;
}

/**
 * The letter to the labour office for one of the worker's own pay queries. Null when the query is
 * not theirs; `not_ready` while the employer still has time to answer, or the query is settled.
 */
export async function loadLabourLetter(
  worker: Pick<Worker, 'id' | 'orgId' | 'siteId' | 'name' | 'phone'>,
  queryId: string,
  origin: string,
): Promise<LabourLetterView | 'not_ready' | null> {
  const q = await workerService.getMyPayQuery(worker.id, queryId);
  if (!q) return null;
  if (!canWriteLetter(q)) return 'not_ready';

  const db = getDatabase();
  const [org, site, allShifts] = await Promise.all([
    db.orgs.get(worker.orgId),
    db.sites.get(q.siteId),
    db.shifts.listByWorker(worker.id),
  ]);
  const period = letterPeriod(q);
  const counted = shiftsInPeriod(allShifts, period);
  const { overtimeHours } = calculateShiftsOvertime(counted, 0, policyForDate(org));
  const verifyUrl = `${origin}/verify/${signPeriod(worker.id, period.start, period.end, allShifts)}`;
  const qrSvg = await QRCode.toString(verifyUrl, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#1C1D1A', light: '#FFFFFF' },
  });
  return {
    letter: buildLabourLetter(q, counted, overtimeHours),
    worker: { name: worker.name, phone: worker.phone },
    employer: org?.name ?? '',
    site: site?.name ?? '',
    verifyUrl,
    qrSvg,
  };
}
