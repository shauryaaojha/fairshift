/**
 * Fatigue flags: more than 48 h in 7 days, a shift over 10 h, under 10 h rest between shifts, and
 * 7 days without a rest day. Pure.
 */

import { istDateKey } from './time';
import type { FatigueFlag, FatigueInput, Shift } from '../../shared/types';
import { calculateShiftHours } from './overtime';

export const MAX_SAFE_ROLLING_WEEK_HOURS = 48;
export const MAX_SAFE_SINGLE_SHIFT_HOURS = 10;
export const MIN_REQUIRED_REST_GAP_HOURS = 10;
export const MAX_CONSECUTIVE_DAYS_WITHOUT_REST = 6; // 7 or more triggers flag

/**
 * Calculates rest gap in hours between end of previous shift and start of next shift.
 */
export function calculateRestGapHours(
  prevCheckOutIso: string | null,
  nextCheckInIso: string,
): number | null {
  if (!prevCheckOutIso) return null;
  const prevEnd = new Date(prevCheckOutIso).getTime();
  const nextStart = new Date(nextCheckInIso).getTime();
  if (isNaN(prevEnd) || isNaN(nextStart) || nextStart < prevEnd) return null;
  const diffHours = (nextStart - prevEnd) / (1000 * 60 * 60);
  return Math.round(diffHours * 100) / 100;
}

/**
 * Checks for consecutive days worked without a full rest day (>= 24 hours off).
 */
export function countConsecutiveWorkingDays(shifts: Shift[]): number {
  if (shifts.length === 0) return 0;
  // Get sorted unique dates (YYYY-MM-DD)
  const sortedDates = Array.from(
    new Set(shifts.filter((s) => s.checkOut !== null).map((s) => istDateKey(s.checkIn))),
  ).sort();

  if (sortedDates.length === 0) return 0;

  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prevTime = new Date(sortedDates[i - 1]).getTime();
    const currTime = new Date(sortedDates[i]).getTime();
    const dayDiff = Math.round((currTime - prevTime) / (1000 * 60 * 60 * 24));

    if (dayDiff === 1) {
      currentStreak++;
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
      }
    } else if (dayDiff > 1) {
      currentStreak = 1;
    }
  }

  return maxStreak;
}

/**
 * Evaluates fatigue flags for a worker across a specified time window.
 */
export function evaluateFatigue(input: FatigueInput): FatigueFlag[] {
  const flags: FatigueFlag[] = [];
  const { shifts, windowStart, windowEnd } = input;

  const wStart = new Date(windowStart).getTime();
  const wEnd = new Date(windowEnd).getTime();

  // Filter shifts within or overlapping the window
  const relevantShifts = shifts
    .filter((s) => {
      const start = new Date(s.checkIn).getTime();
      return !isNaN(start) && start >= wStart && start <= wEnd;
    })
    .sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime());

  // 1. Total hours in rolling window (e.g. 7 days)
  let totalHours = 0;
  for (const shift of relevantShifts) {
    const duration = calculateShiftHours(shift.checkIn, shift.checkOut);
    totalHours += duration;

    // 2. Single shift longer than 10h
    if (duration > MAX_SAFE_SINGLE_SHIFT_HOURS) {
      flags.push({
        type: 'long_shift',
        messageKey: 'fatigue.long_shift',
        params: {
          hours: Math.round(duration * 10) / 10,
          shiftId: shift.id,
          date: istDateKey(shift.checkIn),
        },
      });
    }
  }

  if (totalHours > MAX_SAFE_ROLLING_WEEK_HOURS) {
    flags.push({
      type: 'weekly_hours_exceeded',
      messageKey: 'fatigue.weekly_hours_exceeded',
      params: {
        totalHours: Math.round(totalHours * 10) / 10,
        limit: MAX_SAFE_ROLLING_WEEK_HOURS,
      },
    });
  }

  // 3. Rest gap shorter than 10h between consecutive completed shifts
  for (let i = 1; i < relevantShifts.length; i++) {
    const prev = relevantShifts[i - 1];
    const curr = relevantShifts[i];
    const gap = calculateRestGapHours(prev.checkOut, curr.checkIn);
    if (gap !== null && gap < MIN_REQUIRED_REST_GAP_HOURS) {
      flags.push({
        type: 'short_rest',
        messageKey: 'fatigue.short_rest',
        params: {
          gapHours: Math.round(gap * 10) / 10,
          date: istDateKey(curr.checkIn),
          minGap: MIN_REQUIRED_REST_GAP_HOURS,
        },
      });
    }
  }

  // 4. Consecutive days without rest day
  const consecutiveDays = countConsecutiveWorkingDays(relevantShifts);
  if (consecutiveDays >= 7) {
    flags.push({
      type: 'no_rest_day',
      messageKey: 'fatigue.no_rest_day',
      params: {
        consecutiveDays,
      },
    });
  }

  return flags;
}
