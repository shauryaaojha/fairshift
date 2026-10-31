/**
 * Rules a hazard report goes through before anything else sees it, with or without AI:
 * danger words set a floor under the severity, and an anonymous report's time is kept only to the
 * hour. Pure.
 */

import { higherSeverity } from '../../shared/severity';
import { HOUR_MS, IST_OFFSET_MINUTES } from './time';
import type { HazardSeverity } from '../../shared/types';

/**
 * Words that signal danger to life, in English, Hindi and Tamil (as workers type or speak them).
 * Matching is deliberately conservative: it only ever raises a rating, and a supervisor confirms.
 */
const SEVERITY_SIGNALS: Array<{ severity: HazardSeverity; pattern: RegExp }> = [
  {
    severity: 'critical',
    pattern:
      /live wire|electrocut|shock|collapse|fell from|fall from|no harness|\bfire\b|gas (?:leak|smell)|smell of gas|unconscious|bijli|करंट|बिजली|गिर|आग|गैस|மின்|தீ|விழு/i,
  },
  {
    severity: 'high',
    pattern: /crack|loose scaffold|no helmet|exposed|sharp|bleed|चोट|दरार|हेलमेट|காயம்|விரிசல்/i,
  },
];

/** The severity the report's own words call for, or null when no danger word appears. */
export function suggestSeverityFromText(description: string): HazardSeverity | null {
  return SEVERITY_SIGNALS.find((s) => s.pattern.test(description))?.severity ?? null;
}

/**
 * The severity a report is filed at: the worker's choice, raised (never lowered) by danger words.
 * It runs before the AI, so a model that is off, rate-limited or talked round by the text cannot
 * leave "live wire, low" on a 72-hour clock. The supervisor can still lower it after looking,
 * until the report escalates.
 */
export function severityFloor(selected: HazardSeverity, description: string): HazardSeverity {
  const signal = suggestSeverityFromText(description);
  return signal ? higherSeverity(selected, signal) : selected;
}

/** India is UTC+5:30, so an IST hour starts at :30 UTC. */
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;

/**
 * An anonymous report keeps its time only to the hour (IST), so it cannot be matched against the
 * gate log or CCTV to find who stood there at 14:07. Rounding down makes the response deadline
 * earlier, so the clock only ever gets stricter.
 */
export function coarsenToHour(iso: string): string {
  const local = Date.parse(iso) + IST_OFFSET_MS;
  return new Date(Math.floor(local / HOUR_MS) * HOUR_MS - IST_OFFSET_MS).toISOString();
}
