/**
 * Overtime under the OSH Code 2020 defaults: beyond 8 h a day or 48 h per ISO week, paid at 2x,
 * with per-organisation overrides. Time is counted in exact minutes and money in whole paise, so
 * each pay figure is rounded once, at the end. Pure.
 */

import { calculateIsoWeek } from './anonymity';
import { payForMinutes, toPaise, toRupees } from '../../shared/money';
import { istDateKey } from './time';
import type {
  DailyOvertimeInput,
  WeeklyOvertimeInput,
  OvertimeResult,
  Shift,
  OrgPolicy,
  PolicySource,
} from '../../shared/types';

export const DEFAULT_DAILY_HOURS_LIMIT = 8;
export const DEFAULT_WEEKLY_HOURS_LIMIT = 48;
export const DEFAULT_OT_MULTIPLIER = 2.0;

/**
 * Calculates overtime for a single day.
 */
export function calculateDailyOvertime(input: DailyOvertimeInput): OvertimeResult {
  const dailyLimit = input.dailyLimit ?? DEFAULT_DAILY_HOURS_LIMIT;
  const totalHours = Math.max(0, input.totalHoursWorked);
  return splitPay(
    Math.min(totalHours, dailyLimit) * 60,
    Math.max(0, totalHours - dailyLimit) * 60,
    input.hourlyRate,
    input.otMultiplier ?? DEFAULT_OT_MULTIPLIER,
  );
}

/**
 * Calculates overtime across a week given an array of daily hours.
 * If daily overtime exceeds statutory daily limits, or if total hours exceed weekly limit,
 * the worker receives the higher overtime benefit.
 */
export function calculateWeeklyOvertime(input: WeeklyOvertimeInput): OvertimeResult {
  const weeklyLimit = input.weeklyLimit ?? DEFAULT_WEEKLY_HOURS_LIMIT;
  const totalHours = input.dailyHours.reduce((sum, h) => sum + Math.max(0, h), 0);
  return splitPay(
    Math.min(totalHours, weeklyLimit) * 60,
    Math.max(0, totalHours - weeklyLimit) * 60,
    input.hourlyRate,
    input.otMultiplier ?? DEFAULT_OT_MULTIPLIER,
  );
}

/** Regular and overtime minutes priced at one multiplier, back in hours and rupees. */
function splitPay(
  regularMinutes: number,
  overtimeMinutes: number,
  hourlyRate: number,
  otMultiplier: number,
): OvertimeResult {
  const rate = toPaise(hourlyRate);
  return {
    regularHours: hoursOf(regularMinutes),
    overtimeHours: hoursOf(overtimeMinutes),
    regularPay: toRupees(payForMinutes(regularMinutes, rate)),
    overtimePay: toRupees(payForMinutes(overtimeMinutes, rate, otMultiplier)),
  };
}

/** Minutes as hours to two decimals, for display. */
export const hoursOf = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

/** Exact minutes between check-in and check-out; 0 while open or if the times are out of order. */
export function shiftMinutes(checkInIso: string, checkOutIso: string | null): number {
  if (!checkOutIso) return 0;
  const start = Date.parse(checkInIso);
  const end = Date.parse(checkOutIso);
  if (isNaN(start) || isNaN(end) || end <= start) return 0;
  return (end - start) / 60_000;
}

/**
 * Calculates duration in hours between two ISO timestamps.
 * Returns 0 if checkOut is missing or if checkOut is before checkIn.
 */
export function calculateShiftHours(checkInIso: string, checkOutIso: string | null): number {
  return hoursOf(shiftMinutes(checkInIso, checkOutIso));
}

/** The rules in force on an IST day, from a fixed policy or a dated history. */
export function policyAt(source: PolicySource | undefined, dateKey: string): OrgPolicy | undefined {
  return typeof source === 'function' ? source(dateKey) : source;
}

/** Overtime for a pay period, in exact minutes and whole paise. */
export interface OvertimeMinutes {
  regularMinutes: number;
  overtimeMinutes: number;
  regularPaise: number;
  overtimePaise: number;
}

/**
 * Computes overtime for a pay period of any length.
 * Time is grouped by IST calendar day, and days by ISO week (Mon–Sun). In each
 * week the worker gets the larger of (a) the sum of daily overtime beyond the daily
 * limit and (b) the week's time beyond the weekly limit. Weeks are then summed, so a
 * month of normal 8 h days never turns into "overtime". Each week uses the rules in force
 * that week; rule changes start on a Monday, so a week never mixes two sets of rules.
 */
export function shiftsOvertimeMinutes(
  shifts: Shift[],
  hourlyRate: number,
  policy?: PolicySource,
): OvertimeMinutes {
  const minutesByDate: Record<string, number> = {};
  for (const shift of shifts) {
    const minutes = shiftMinutes(shift.checkIn, shift.checkOut);
    if (minutes > 0) {
      const dateKey = istDateKey(shift.checkIn);
      minutesByDate[dateKey] = (minutesByDate[dateKey] ?? 0) + minutes;
    }
  }

  const weeks: Record<string, { total: number; days: [string, number][] }> = {};
  for (const [date, dayMinutes] of Object.entries(minutesByDate)) {
    const bucket = (weeks[calculateIsoWeek(date)] ??= { total: 0, days: [] });
    bucket.total += dayMinutes;
    bucket.days.push([date, dayMinutes]);
  }

  let totalMinutes = 0;
  // Overtime minutes per multiplier, so a week at 2.5x is never paid at 2x.
  const overtimeByRate = new Map<number, number>();
  for (const { total, days } of Object.values(weeks)) {
    const rules = policyAt(policy, days[0][0]);
    const dailyLimit = (rules?.dailyHoursLimit ?? DEFAULT_DAILY_HOURS_LIMIT) * 60;
    const weeklyLimit = (rules?.weeklyHoursLimit ?? DEFAULT_WEEKLY_HOURS_LIMIT) * 60;
    const otMultiplier = rules?.otMultiplier ?? DEFAULT_OT_MULTIPLIER;
    const dailyOvertime = days.reduce((sum, [, m]) => sum + Math.max(0, m - dailyLimit), 0);
    totalMinutes += total;
    // Take the larger of the two rules in each week to protect worker rights.
    const weekOvertime = Math.max(dailyOvertime, total - weeklyLimit, 0);
    overtimeByRate.set(otMultiplier, (overtimeByRate.get(otMultiplier) ?? 0) + weekOvertime);
  }

  const rate = toPaise(hourlyRate);
  let overtimeMinutes = 0;
  let overtimePaise = 0;
  for (const [multiplier, minutes] of overtimeByRate) {
    overtimeMinutes += minutes;
    overtimePaise += payForMinutes(minutes, rate, multiplier);
  }
  const regularMinutes = Math.max(0, totalMinutes - overtimeMinutes);
  return {
    regularMinutes,
    overtimeMinutes,
    regularPaise: payForMinutes(regularMinutes, rate),
    overtimePaise,
  };
}

/** The same, in hours to two decimals and rupees, for display. */
export function calculateShiftsOvertime(
  shifts: Shift[],
  hourlyRate: number,
  policy?: PolicySource,
): OvertimeResult {
  const ot = shiftsOvertimeMinutes(shifts, hourlyRate, policy);
  return {
    regularHours: hoursOf(ot.regularMinutes),
    overtimeHours: hoursOf(ot.overtimeMinutes),
    regularPay: toRupees(ot.regularPaise),
    overtimePay: toRupees(ot.overtimePaise),
  };
}
