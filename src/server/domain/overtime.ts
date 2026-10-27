// ============================================================
// FairShift — Domain: Overtime Engine (Pure)
// Compliance: OSH Code 2020 (8h/day, 48h/week, 2x OT multiplier)
// ============================================================

import { calculateIsoWeek } from './anonymity';
import { istDateKey } from './time';
import type { DailyOvertimeInput, WeeklyOvertimeInput, OvertimeResult, Shift, OrgPolicy } from '../../shared/types';

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

/**
 * Computes overtime for a pay period of any length.
 * Hours are grouped by IST calendar day, and days by ISO week (Mon–Sun). In each
 * week the worker gets the larger of (a) the sum of daily overtime beyond the daily
 * limit and (b) the week's hours beyond the weekly limit. Weeks are then summed, so a
 * month of normal 8 h days never turns into "overtime".
 */
export function calculateShiftsOvertime(
  shifts: Shift[],
  hourlyRate: number,
  policy?: OrgPolicy
): OvertimeResult {
  const dailyLimit = policy?.dailyHoursLimit ?? DEFAULT_DAILY_HOURS_LIMIT;
  const weeklyLimit = policy?.weeklyHoursLimit ?? DEFAULT_WEEKLY_HOURS_LIMIT;
  const otMultiplier = policy?.otMultiplier ?? DEFAULT_OT_MULTIPLIER;

  const hoursByDate: Record<string, number> = {};
  for (const shift of shifts) {
    const hours = calculateShiftHours(shift.checkIn, shift.checkOut);
    if (hours > 0) {
      const dateKey = istDateKey(shift.checkIn);
      hoursByDate[dateKey] = (hoursByDate[dateKey] ?? 0) + hours;
    }
  }

  const weeks: Record<string, { total: number; dailyOvertime: number }> = {};
  for (const [date, dayHours] of Object.entries(hoursByDate)) {
    const week = calculateIsoWeek(date);
    const bucket = (weeks[week] ??= { total: 0, dailyOvertime: 0 });
    bucket.total += dayHours;
    bucket.dailyOvertime += Math.max(0, dayHours - dailyLimit);
  }

  let totalHours = 0;
  let overtimeHours = 0;
  for (const { total, dailyOvertime } of Object.values(weeks)) {
    totalHours += total;
    // Take the larger of the two rules in each week to protect worker rights.
    overtimeHours += Math.max(dailyOvertime, total - weeklyLimit, 0);
  }
  const regularHours = Math.max(0, totalHours - overtimeHours);

  const regularPay = Math.round(regularHours * hourlyRate * 100) / 100;
  const overtimePay = Math.round(overtimeHours * hourlyRate * otMultiplier * 100) / 100;

  return {
    regularHours: Math.round(regularHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    regularPay,
    overtimePay,
  };
}
