/**
 * One number for how fairly a site treats its workers, out of 100, so a regional lead can compare
 * sites and see which one needs a visit. It is the plain average of five parts, each out of 100
 * and each from records the console already keeps, so every point can be traced to a count:
 * safety reports answered in time, hours within the legal limits, last month's wages paid by the
 * 7th, how workers rate their supervisor (anonymous), and how many are likely to leave. A part
 * with nothing to measure yet is left out rather than counted as perfect or as zero. Pure.
 */

export interface SiteScoreInput {
  workers: number;
  /** Workers over the daily or weekly hours, or short of rest. */
  fatigued: number;
  /** Workers whose quit risk is high. */
  likelyToLeave: number;
  /** Hazard reports at the site. */
  hazards: number;
  /** Reports past their response deadline with no response. */
  escalated: number;
  /** Average "my supervisor respects me" (1 to 5); null when too few answered to stay anonymous. */
  respect: number | null;
  /** Workers owed wages for last month. */
  wagesOwed: number;
  /** Of those, still unpaid after the 7th. */
  wagesOverdue: number;
}

export type ScorePartKey = 'safety' | 'hours' | 'wages' | 'respect' | 'retention';

export interface ScorePart {
  key: ScorePartKey;
  label: string;
  /** 0 to 100. */
  value: number;
  /** The count behind the value, in a sentence. */
  detail: string;
}

export type ScoreBand = 'good' | 'fair' | 'poor';

export interface SiteScore {
  /** 0 to 100, or null when no part could be measured. */
  score: number | null;
  band: ScoreBand | null;
  parts: ScorePart[];
  /** Parts left out because there was nothing to measure, with the reason. */
  missing: { key: ScorePartKey; label: string; reason: string }[];
}

const pct = (good: number, total: number) => Math.round((100 * Math.max(0, good)) / total);
const of = (n: number, total: number, noun: string) => `${n} of ${total} ${noun}`;

export function bandFor(score: number): ScoreBand {
  if (score >= 80) return 'good';
  if (score >= 60) return 'fair';
  return 'poor';
}

export function siteScore(input: SiteScoreInput): SiteScore {
  const parts: ScorePart[] = [];
  const missing: SiteScore['missing'] = [];

  if (input.hazards > 0) {
    parts.push({
      key: 'safety',
      label: 'Safety reports answered',
      value: pct(input.hazards - input.escalated, input.hazards),
      detail: `${of(input.escalated, input.hazards, 'reports')} are past their deadline with no response.`,
    });
  } else {
    missing.push({ key: 'safety', label: 'Safety reports answered', reason: 'No reports yet.' });
  }

  if (input.workers > 0) {
    parts.push({
      key: 'hours',
      label: 'Hours within the law',
      value: pct(input.workers - input.fatigued, input.workers),
      detail: `${of(input.fatigued, input.workers, 'workers')} are over the hours or short of rest.`,
    });
  } else {
    missing.push({ key: 'hours', label: 'Hours within the law', reason: 'No workers.' });
  }

  if (input.wagesOwed > 0) {
    parts.push({
      key: 'wages',
      label: 'Wages paid on time',
      value: pct(input.wagesOwed - input.wagesOverdue, input.wagesOwed),
      detail: `${of(input.wagesOverdue, input.wagesOwed, 'workers')} were not paid last month by the 7th.`,
    });
  } else {
    missing.push({
      key: 'wages',
      label: 'Wages paid on time',
      reason: 'Nobody was owed wages last month.',
    });
  }

  if (input.respect !== null) {
    const r = Math.min(5, Math.max(1, input.respect));
    parts.push({
      key: 'respect',
      label: 'Respect from supervisors',
      value: Math.round(((r - 1) / 4) * 100),
      detail: `Workers rate it ${r.toFixed(1)} out of 5 (anonymous).`,
    });
  } else {
    missing.push({
      key: 'respect',
      label: 'Respect from supervisors',
      reason: 'Too few answers yet to show without identifying anyone.',
    });
  }

  if (input.workers > 0) {
    parts.push({
      key: 'retention',
      label: 'Workers likely to stay',
      value: pct(input.workers - input.likelyToLeave, input.workers),
      detail: `${of(input.likelyToLeave, input.workers, 'workers')} are likely to leave.`,
    });
  } else {
    missing.push({ key: 'retention', label: 'Workers likely to stay', reason: 'No workers.' });
  }

  if (parts.length === 0) return { score: null, band: null, parts, missing };
  const score = Math.round(parts.reduce((sum, p) => sum + p.value, 0) / parts.length);
  return { score, band: bandFor(score), parts, missing };
}

/**
 * The average supervisor-respect rating across teams whose latest week has enough answers to
 * show, weighted by how many answered. Null when no team has.
 */
export function respectFrom(
  teams: { count: number; averages: { managerRespect: number } | null }[],
): number | null {
  const shown = teams.filter((t) => t.averages !== null && t.count > 0);
  const answers = shown.reduce((n, t) => n + t.count, 0);
  if (answers === 0) return null;
  return shown.reduce((sum, t) => sum + t.averages!.managerRespect * t.count, 0) / answers;
}
