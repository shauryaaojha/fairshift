/**
 * Money inside the pay engine is counted in whole paise (100 paise = 1 rupee), so sums and
 * differences are exact integers and never drift the way decimal rupees do in floating point
 * (0.1 + 0.2 !== 0.3). Rupees come in and go out at the edges, always with at most two decimals.
 */

/** Rupees to whole paise. `toPrecision` first, so 1.005 rupees is 101 paise, not 100. */
export function toPaise(rupees: number): number {
  return Math.round(Number((rupees * 100).toPrecision(15)));
}

/** Whole paise to rupees, exact to two decimals. */
export function toRupees(paise: number): number {
  return paise / 100;
}

/** Pay for some minutes at an hourly rate in paise, times a multiplier, rounded once to a paisa. */
export function payForMinutes(minutes: number, hourlyRatePaise: number, multiplier = 1): number {
  return Math.round((minutes * hourlyRatePaise * multiplier) / 60);
}
