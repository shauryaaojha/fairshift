/**
 * Calendar helpers in IST (Asia/Kolkata): day keys, month start, and time constants. Pure.
 */

/** Standard time duration constants in milliseconds. */
export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;

/** India Standard Time offset from UTC, in minutes (no daylight saving). */
export const IST_OFFSET_MINUTES = 330;

/** The IST calendar date (YYYY-MM-DD) of an ISO timestamp or Date. */
export function istDateKey(input: string | Date): string {
  const ms = typeof input === 'string' ? Date.parse(input) : input.getTime();
  return new Date(ms + IST_OFFSET_MINUTES * 60 * 1000).toISOString().slice(0, 10);
}

/** First day (YYYY-MM-01) of the IST month containing `now`. */
export function istMonthStart(now: Date): string {
  return `${istDateKey(now).slice(0, 7)}-01`;
}
