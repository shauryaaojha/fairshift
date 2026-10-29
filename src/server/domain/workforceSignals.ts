/**
 * Inputs to the quit-risk score derived from records: attendance drop and team sentiment. Pure.
 */

import { istDateKey, DAY_MS } from './time';
import type { FeedbackSubmission, Shift } from '../../shared/types';
import { DEFAULT_ANONYMITY_K } from './anonymity';

/**
 * Percentage drop in days attended: the last `windowDays` versus the
 * `windowDays` before that. Returns 0 when there is no earlier attendance
 * to compare against, or when attendance went up.
 */
export function calculateAttendanceDrop(
  shifts: Shift[],
  now: Date,
  windowDays: number = 7,
): number {
  const recentStart = now.getTime() - windowDays * DAY_MS;
  const previousStart = recentStart - windowDays * DAY_MS;

  const recentDays = new Set<string>();
  const previousDays = new Set<string>();

  for (const shift of shifts) {
    const t = new Date(shift.checkIn).getTime();
    const day = istDateKey(shift.checkIn);
    if (t >= recentStart && t < now.getTime()) recentDays.add(day);
    else if (t >= previousStart && t < recentStart) previousDays.add(day);
  }

  if (previousDays.size === 0) return 0;
  const drop = ((previousDays.size - recentDays.size) / previousDays.size) * 100;
  return drop > 0 ? Math.round(drop) : 0;
}

/**
 * Average of all four ratings for a team, on the 1–5 scale.
 * Returns 0 (no signal) when fewer than `minK` responses exist, so a small
 * team's feedback can never be traced back into an individual's risk score.
 */
export function teamSentimentAverage(
  submissions: FeedbackSubmission[],
  team: string,
  minK: number = DEFAULT_ANONYMITY_K,
): number {
  const teamSubs = submissions.filter((s) => s.team === team);
  if (teamSubs.length < minK) return 0;

  const total = teamSubs.reduce(
    (sum, s) => sum + s.managerRespect + s.safetyRating + s.payFairness + s.workloadRating,
    0,
  );
  return Math.round((total / (teamSubs.length * 4)) * 10) / 10;
}
