// ============================================================
// FairShift - Worker UI composition (owned by the worker app).
// Reads and view-model helpers on top of workerService, repos and domain.
// Pure helpers are exported on their own so they can be unit tested.
// ============================================================

import { cookies } from 'next/headers';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { workerService } from './workerService';
import { getDatabase } from '../repos';
import { SESSION_COOKIE_NAME, verifySession } from '../auth/session';
import { explainPayslip } from '../ai/gemini';
import { calculateShiftHours, calculateShiftsOvertime } from '../domain/overtime';
import { LOCALE_COOKIE, SPEECH_LANG, parseLocale, t } from '../../i18n';
import type {
  FatigueFlag,
  HazardReport,
  HazardStatus,
  Locale,
  OvertimeResult,
  PayslipResult,
  Shift,
  Site,
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

export function formatRupees(amount: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(amount);
}

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

export type TimelineKey = 'reported' | 'escalated' | 'acknowledged' | 'resolved';
export interface TimelineStep {
  key: TimelineKey;
  at: string | null;
  done: boolean;
}
export interface HazardTimeline {
  steps: TimelineStep[];
  /** Stamp to show for the current state. */
  stamp: { variant: 'hivis' | 'ink' | 'cleared' | 'escalated'; labelKey: string };
}

/** Reported -> Acknowledged -> Resolved, with an extra Escalated node when the SLA was missed. */
export function hazardTimeline(h: Pick<HazardReport, 'status' | 'reportedAt' | 'acknowledgedAt' | 'resolvedAt'>): HazardTimeline {
  const steps: TimelineStep[] = [{ key: 'reported', at: h.reportedAt, done: true }];
  if (h.status === 'escalated') steps.push({ key: 'escalated', at: null, done: true });
  steps.push({ key: 'acknowledged', at: h.acknowledgedAt, done: h.acknowledgedAt !== null });
  steps.push({ key: 'resolved', at: h.resolvedAt, done: h.resolvedAt !== null });

  const stampByStatus: Record<HazardStatus, HazardTimeline['stamp']> = {
    reported: { variant: 'hivis', labelKey: 'hazard.stamp.logged' },
    acknowledged: { variant: 'ink', labelKey: 'hazard.stamp.acknowledged' },
    resolved: { variant: 'cleared', labelKey: 'hazard.stamp.resolved' },
    escalated: { variant: 'escalated', labelKey: 'hazard.stamp.escalated' },
  };
  return { steps, stamp: stampByStatus[h.status] };
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

export type CheckinErrorCode = 'invalid_code' | 'outside' | 'generic';

/** Map the backend's English error messages to a translatable code. */
export function checkinErrorCode(message: string): CheckinErrorCode {
  const m = message.toLowerCase();
  if (m.includes('code')) return 'invalid_code';
  if (m.includes('geofence')) return 'outside';
  return 'generic';
}

export interface DayRow {
  id: string;
  date: string;
  checkIn: string;
  checkOut: string | null;
  hours: number;
  open: boolean;
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
  const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
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

export async function loadPay(workerId: string): Promise<PayslipResult> {
  return workerService.getMyPayslip(workerId);
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
  return { week: summarizeWeek(shifts, new Date(), org?.policy), fatigueFlags };
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
