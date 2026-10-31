/**
 * Pure shaping for the supervisor console: rows for tables, heatmap cells and the headline
 * sentence. No I/O, so every function here is unit-tested with plain data.
 */

import type { PublicWorker } from './adminService';
import {
  computeHazardStatus,
  getRemainingSlaSeconds,
  formatSlaRemaining,
} from '../domain/hazardSla';
import { istDateKey } from '../domain/time';
import { closureState, type ClosureState } from '../domain/hazardClosure';
import type {
  AggregatedFeedback,
  HazardReport,
  HazardStatus,
  OverviewKPIs,
  QuitRiskResult,
  Shift,
  Worker,
} from '../../shared/types';

// ── State sentence ──────────────────────────────────────────

export interface SentenceSegment {
  text: string;
  /** Present when the segment is a number that links to its rows */
  href?: string;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/**
 * "43 of 51 on site . 2 hazards escalated . 5 workers flagged for fatigue".
 * Each count is a link to the rows behind it.
 */
export function buildStateSegments(
  kpis: Pick<OverviewKPIs, 'onSiteNow' | 'totalWorkers' | 'escalatedHazards' | 'fatigueFlags'>,
): SentenceSegment[] {
  return [
    { text: `${kpis.onSiteNow} of ${kpis.totalWorkers}`, href: '/admin/attendance?status=on-site' },
    { text: ' on site · ' },
    {
      text: `${kpis.escalatedHazards} ${plural(kpis.escalatedHazards, 'hazard', 'hazards')}`,
      href: '/admin/safety?status=escalated',
    },
    { text: ' escalated · ' },
    {
      text: `${kpis.fatigueFlags} ${plural(kpis.fatigueFlags, 'worker', 'workers')}`,
      href: '/admin/risk?filter=fatigue',
    },
    { text: ' flagged for fatigue' },
  ];
}

// ── Feedback heatmap ────────────────────────────────────────

export const FEEDBACK_QUESTIONS = [
  { key: 'managerRespect', label: 'Manager respect' },
  { key: 'safetyRating', label: 'Safety' },
  { key: 'payFairness', label: 'Pay fairness' },
  { key: 'workloadRating', label: 'Workload' },
] as const;

export type FeedbackQuestionKey = (typeof FEEDBACK_QUESTIONS)[number]['key'];

export interface HeatmapCell {
  key: FeedbackQuestionKey;
  label: string;
  /** null = hidden because fewer than k people answered */
  value: number | null;
}

export interface HeatmapRow {
  team: string;
  count: number;
  hidden: boolean;
  cells: HeatmapCell[];
}

/**
 * Team x question grid. A team with fewer than k answers (or whose averages
 * the backend already suppressed) has every cell hidden: no numbers leave
 * this function for small groups.
 */
export function buildHeatmapRows(feedback: AggregatedFeedback[], k = 3): HeatmapRow[] {
  return [...feedback]
    .sort((a, b) => a.team.localeCompare(b.team))
    .map((f) => {
      const hidden = f.count < k || f.averages === null;
      return {
        team: f.team,
        count: f.count,
        hidden,
        cells: FEEDBACK_QUESTIONS.map((q) => ({
          key: q.key,
          label: q.label,
          value: hidden || !f.averages ? null : f.averages[q.key],
        })),
      };
    });
}

// ── Hazards ─────────────────────────────────────────────────

export interface HazardRow extends HazardReport {
  liveStatus: HazardStatus;
  closure: ClosureState;
  remainingSeconds: number;
  slaLabel: string;
}

const STATUS_ORDER: Record<HazardStatus, number> = {
  escalated: 0,
  reported: 1,
  acknowledged: 2,
  resolved: 3,
};

/** Adds live (computed-on-read) status and SLA text, most urgent first. */
export function toHazardRows(hazards: HazardReport[], now: Date = new Date()): HazardRow[] {
  return hazards
    .map((h) => {
      const liveStatus = computeHazardStatus(h, now);
      const remainingSeconds = getRemainingSlaSeconds(h, now);
      const slaLabel =
        liveStatus === 'resolved'
          ? 'Resolved'
          : h.acknowledgedAt
            ? 'Acknowledged'
            : formatSlaRemaining(remainingSeconds);
      return { ...h, liveStatus, closure: closureState(h), remainingSeconds, slaLabel };
    })
    .sort(
      (a, b) =>
        STATUS_ORDER[a.liveStatus] - STATUS_ORDER[b.liveStatus] ||
        a.remainingSeconds - b.remainingSeconds,
    );
}

export function filterHazards(rows: HazardRow[], status: string | undefined): HazardRow[] {
  if (!status || status === 'all') return rows;
  if (status === 'open') return rows.filter((r) => r.liveStatus !== 'resolved');
  return rows.filter((r) => r.liveStatus === status);
}

// ── Attendance rows ─────────────────────────────────────────

export interface AttendanceRow {
  shiftId: string;
  workerName: string;
  team: string;
  date: string;
  checkIn: string;
  checkOut: string | null;
  hours: number | null;
  method: Shift['method'];
  onSite: boolean;
}

export function buildAttendanceRows(
  shifts: Shift[],
  workers: Worker[],
  opts: { status?: string; team?: string; days?: number; today?: string } = {},
): AttendanceRow[] {
  const byId = new Map(workers.map((w) => [w.id, w]));
  const days = opts.days ?? 14;
  const latest = shifts.reduce((m, s) => (s.checkIn > m ? s.checkIn : m), '');
  const anchor = new Date(opts.today ?? (latest || new Date().toISOString())).getTime();
  const cutoff = anchor - days * 24 * 3600 * 1000;

  return shifts
    .filter((s) => new Date(s.checkIn).getTime() >= cutoff)
    .map((s): AttendanceRow | null => {
      const w = byId.get(s.workerId);
      if (!w) return null;
      const hours = s.checkOut
        ? Math.round(
            ((new Date(s.checkOut).getTime() - new Date(s.checkIn).getTime()) / 3600000) * 10,
          ) / 10
        : null;
      return {
        shiftId: s.id,
        workerName: w.name,
        team: w.team,
        date: istDateKey(s.checkIn),
        checkIn: s.checkIn,
        checkOut: s.checkOut,
        hours,
        method: s.method,
        onSite: s.checkOut === null,
      };
    })
    .filter((r): r is AttendanceRow => r !== null)
    .filter((r) =>
      opts.status === 'on-site' ? r.onSite : opts.status === 'over-8' ? (r.hours ?? 0) > 8 : true,
    )
    .filter((r) => !opts.team || opts.team === 'all' || r.team === opts.team)
    .sort((a, b) => b.checkIn.localeCompare(a.checkIn) || a.workerName.localeCompare(b.workerName));
}

// ── Risk rows ───────────────────────────────────────────────

export type RiskRow = PublicWorker & { risk: QuitRiskResult };

export function filterRiskRows(
  rows: RiskRow[],
  filter: string | undefined,
  team?: string,
): RiskRow[] {
  let out = rows;
  if (filter === 'high') out = out.filter((r) => r.risk.score > 50);
  if (filter === 'fatigue') {
    out = out.filter((r) =>
      r.risk.topReasons.some((t) => t.factor === 'fatigue_flags' || t.factor === 'ot_load'),
    );
  }
  if (team && team !== 'all') out = out.filter((r) => r.team === team);
  return out;
}

// ── Needs action (overview) ─────────────────────────────────

export interface ActionCounts {
  escalated: number;
  newHazards: number;
  payWaiting: number;
  payOverdue: number;
  wagesOverdue: number;
  fatigue: number;
  highRisk: number;
}

export interface ActionItem {
  key: string;
  count: number;
  label: string;
  detail: string;
  href: string;
  urgent: boolean;
}

/** What the supervisor should do next, most urgent first. Only items with something to do. */
export function buildNeedsAction(c: ActionCounts): ActionItem[] {
  const items: ActionItem[] = [
    {
      key: 'escalated',
      count: c.escalated,
      label: 'Hazards past their deadline',
      detail: 'Reported dangers that were not dealt with in time. Start here.',
      href: '/admin/safety?status=escalated',
      urgent: true,
    },
    {
      key: 'pay',
      count: c.payWaiting,
      label: 'Pay questions waiting for your answer',
      detail:
        c.payOverdue > 0
          ? `${c.payOverdue} past the 2-day deadline.`
          : 'Answer within 2 days of the question.',
      href: '/admin/pay',
      urgent: c.payOverdue > 0,
    },
    {
      key: 'wages',
      count: c.wagesOverdue,
      label: 'Workers whose wages are overdue',
      detail: 'Wages were due by the 7th. Pay by UPI and record the UTR.',
      href: '/admin/pay?tab=wages',
      urgent: true,
    },
    {
      key: 'reported',
      count: c.newHazards,
      label: 'New hazard reports to acknowledge',
      detail: 'Acknowledge each one before its deadline and record the fix.',
      href: '/admin/safety?status=reported',
      urgent: false,
    },
    {
      key: 'fatigue',
      count: c.fatigue,
      label: 'Workers over the hours limits',
      detail: 'Long shifts, short rests or more than 48 h in a week.',
      href: '/admin/risk?filter=fatigue',
      urgent: false,
    },
    {
      key: 'risk',
      count: c.highRisk,
      label: 'Workers likely to leave',
      detail: 'Quit-risk score above 50. See the reasons before they go.',
      href: '/admin/risk?filter=high',
      urgent: false,
    },
  ];
  return items.filter((i) => i.count > 0);
}
