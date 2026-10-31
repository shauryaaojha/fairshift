/**
 * Overtime under the OSH Code 2020 defaults: beyond 8 h a day or 48 h per ISO week, paid at 2x,
 * with per-organisation overrides. Pure.
 */

import { calculateIsoWeek } from './anonymity';
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
  const otMultiplier = input.otMultiplier ?? DEFAULT_OT_MULTIPLIER;
  const totalHours = Math.max(0, input.totalHoursWorked);

  const regularHours = Math.min(totalHours, dailyLimit);
  const overtimeHours = Math.max(0, totalHours - dailyLimit);

  const regularPay = Math.round(regularHours * input.hourlyRate * 100) / 100;
  const overtimePay = Math.round(overtimeHours * input.hourlyRate * otMultiplier * 100) / 100;

  return {
    regularHours: Math.round(regularHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    regularPay,
    overtimePay,
  };
}

/**
 * Calculates overtime across a week given an array of daily hours.
 * If daily overtime exceeds statutory daily limits, or if total hours exceed weekly limit,
 * the worker receives the higher overtime benefit.
 */
export function calculateWeeklyOvertime(input: WeeklyOvertimeInput): OvertimeResult {
  const weeklyLimit = input.weeklyLimit ?? DEFAULT_WEEKLY_HOURS_LIMIT;
  const otMultiplier = input.otMultiplier ?? DEFAULT_OT_MULTIPLIER;

  const totalHours = input.dailyHours.reduce((sum, h) => sum + Math.max(0, h), 0);
  const regularHours = Math.min(totalHours, weeklyLimit);
  const overtimeHours = Math.max(0, totalHours - weeklyLimit);

  const regularPay = Math.round(regularHours * input.hourlyRate * 100) / 100;
  const overtimePay = Math.round(overtimeHours * input.hourlyRate * otMultiplier * 100) / 100;

  return {
    regularHours: Math.round(regularHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    regularPay,
    overtimePay,
  };
}

/**
 * Calculates duration in hours between two ISO timestamps.
 * Returns 0 if checkOut is missing or if checkOut is before checkIn.
 */
export function calculateShiftHours(checkInIso: string, checkOutIso: string | null): number {
  if (!checkOutIso) return 0;
  const start = new Date(checkInIso).getTime();
  const end = new Date(checkOutIso).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) return 0;
  const hours = (end - start) / (1000 * 60 * 60);
  return Math.round(hours * 100) / 100;
}

/** The rules in force on an IST day, from a fixed policy or a dated history. */
export function policyAt(source: PolicySource | undefined, dateKey: string): OrgPolicy | undefined {
  return typeof source === 'function' ? source(dateKey) : source;
}

/**
 * Computes overtime for a pay period of any length.
 * Hours are grouped by IST calendar day, and days by ISO week (Mon–Sun). In each
 * week the worker gets the larger of (a) the sum of daily overtime beyond the daily
 * limit and (b) the week's hours beyond the weekly limit. Weeks are then summed, so a
 * month of normal 8 h days never turns into "overtime". Each week uses the rules in force
 * that week; rule changes start on a Monday, so a week never mixes two sets of rules.
 */
export function calculateShiftsOvertime(
  shifts: Shift[],
  hourlyRate: number,
  policy?: PolicySource,
): OvertimeResult {
  const hoursByDate: Record<string, number> = {};
  for (const shift of shifts) {
    const hours = calculateShiftHours(shift.checkIn, shift.checkOut);
    if (hours > 0) {
      const dateKey = istDateKey(shift.checkIn);
      hoursByDate[dateKey] = (hoursByDate[dateKey] ?? 0) + hours;
    }
  }

  const weeks: Record<string, { total: number; days: [string, number][] }> = {};
  for (const [date, dayHours] of Object.entries(hoursByDate)) {
    const bucket = (weeks[calculateIsoWeek(date)] ??= { total: 0, days: [] });
    bucket.total += dayHours;
    bucket.days.push([date, dayHours]);
  }

  let totalHours = 0;
  // Overtime hours per multiplier, so a week at 2.5x is never paid at 2x.
  const overtimeByRate = new Map<number, number>();
  for (const { total, days } of Object.values(weeks)) {
    const rules = policyAt(policy, days[0][0]);
    const dailyLimit = rules?.dailyHoursLimit ?? DEFAULT_DAILY_HOURS_LIMIT;
    const weeklyLimit = rules?.weeklyHoursLimit ?? DEFAULT_WEEKLY_HOURS_LIMIT;
    const otMultiplier = rules?.otMultiplier ?? DEFAULT_OT_MULTIPLIER;
    const dailyOvertime = days.reduce((sum, [, h]) => sum + Math.max(0, h - dailyLimit), 0);
    totalHours += total;
    // Take the larger of the two rules in each week to protect worker rights.
    const weekOvertime = Math.max(dailyOvertime, total - weeklyLimit, 0);
    overtimeByRate.set(otMultiplier, (overtimeByRate.get(otMultiplier) ?? 0) + weekOvertime);
  }
  let overtimeHours = 0;
  let overtimePay = 0;
  for (const [multiplier, hours] of overtimeByRate) {
    overtimeHours += hours;
    overtimePay += Math.round(hours * hourlyRate * multiplier * 100) / 100;
  }
  const regularHours = Math.max(0, totalHours - overtimeHours);

  return {
    regularHours: Math.round(regularHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    regularPay: Math.round(regularHours * hourlyRate * 100) / 100,
    overtimePay: Math.round(overtimePay * 100) / 100,
  };
}
