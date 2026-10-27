// ============================================================
// FairShift — Domain: Calendar helpers (Pure)
// Workers and sites are in India, so a "day" is an IST calendar day.
// ============================================================

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
