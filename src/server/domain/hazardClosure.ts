/**
 * Two-key closure. A supervisor's "resolved" is the first key; the worker who reported the danger
 * holds the second. "Fixed" closes the report for good. "Not fixed" reopens it straight into
 * escalation, so a fix that exists only on paper cannot quietly close a report. Anonymous reports
 * have nobody to ask, so the supervisor's word closes them. Pure.
 */

import type { HazardReport, ReporterVerdict } from '../../shared/types';

export type ClosureState = 'open' | 'awaiting_reporter' | 'confirmed' | 'closed';

type ClosureFields = Pick<HazardReport, 'status' | 'reporterId' | 'reporterVerdict'>;

export function closureState(h: ClosureFields): ClosureState {
  if (h.status !== 'resolved') return 'open';
  if (h.reporterId === null) return 'closed';
  return h.reporterVerdict === 'fixed' ? 'confirmed' : 'awaiting_reporter';
}

/** Only the named reporter, and only while a resolved report waits for their answer. */
export function canGiveVerdict(h: ClosureFields, workerId: string): boolean {
  return h.reporterId === workerId && closureState(h) === 'awaiting_reporter';
}

export function applyReporterVerdict(
  h: HazardReport,
  verdict: ReporterVerdict,
  now: Date = new Date(),
): HazardReport {
  const at = now.toISOString();
  if (verdict === 'fixed') return { ...h, reporterVerdict: 'fixed', verdictAt: at };
  return {
    ...h,
    status: 'escalated',
    acknowledgedAt: null,
    resolvedAt: null,
    reporterVerdict: 'not_fixed',
    verdictAt: at,
    reopenedAt: at,
    reopenCount: (h.reopenCount ?? 0) + 1,
  };
}

/** What a supervisor's "resolve" does: closes the report and asks the reporter again. */
export function markResolved(h: HazardReport, now: Date = new Date()): HazardReport {
  return {
    ...h,
    status: 'resolved',
    resolvedAt: now.toISOString(),
    reporterVerdict: null,
    verdictAt: null,
  };
}
