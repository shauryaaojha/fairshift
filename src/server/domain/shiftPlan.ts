/**
 * "Plan a shift": before a supervisor gives a worker one more shift, say what it would do to them.
 * Runs the same fatigue rules the worker sees, once without the shift and once with it, and reports
 * only the warnings the new shift adds, any clash with shifts already worked, and the overtime it
 * would cost under the pay rules of that week. Pure.
 */

import { evaluateFatigue } from './fatigue';
import { calculateShiftHours, calculateShiftsOvertime } from './overtime';
import { calculateIsoWeek } from './anonymity';
import { DAY_MS, HOUR_MS, istDateKey } from './time';
import type { FatigueFlag, PolicySource, Shift } from '../../shared/types';
import { toPaise, toRupees } from '../../shared/money';

/** A planned shift may be at most this long; anything longer is a typing mistake. */
export const MAX_PLANNED_SHIFT_HOURS = 16;
/** How far ahead a shift can be planned. */
export const PLAN_AHEAD_DAYS = 14;

export interface PlannedShift {
  /** ISO datetime */
  start: string;
  /** ISO datetime, after `start` */
  end: string;
}

export interface ShiftPlanResult {
  hours: number;
  /** Shifts already on record that overlap the planned one. */
  clashes: Shift[];
  /** Fatigue warnings that appear only because of the planned shift. */
  newFlags: FatigueFlag[];
  /** Extra overtime hours and pay (₹) the shift adds to its week. */
  extraOvertimeHours: number;
  extraOvertimePay: number;
  verdict: 'ok' | 'risky' | 'clash';
}

/**
 * Turns an IST date and two "HH:MM" times into a planned shift. An end time at or before the start
 * means the shift runs past midnight. Returns null for anything unreadable.
 */
export function planFromLocal(date: string, start: string, end: string): PlannedShift | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) {
    return null;
  }
  const startMs = Date.parse(`${date}T${start}:00+05:30`);
  let endMs = Date.parse(`${date}T${end}:00+05:30`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;
  if (endMs <= startMs) endMs += DAY_MS;
  return { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() };
}

/** Same warning, same day: the planned shift did not add it. */
function flagKey(flag: FatigueFlag): string {
  const day = typeof flag.params.date === 'string' ? flag.params.date : '';
  return `${flag.type}:${day}`;
}

export function checkShiftPlan(
  existing: Shift[],
  plan: PlannedShift,
  hourlyRate: number,
  policy?: PolicySource,
): ShiftPlanResult {
  const startMs = Date.parse(plan.start);
  const endMs = Date.parse(plan.end);
  const hours = Math.round(((endMs - startMs) / HOUR_MS) * 100) / 100;

  const clashes = existing.filter((s) => {
    const sStart = Date.parse(s.checkIn);
    const sEnd = s.checkOut ? Date.parse(s.checkOut) : Number.POSITIVE_INFINITY;
    return sStart < endMs && startMs < sEnd;
  });

  const planned: Shift = {
    id: 'planned',
    workerId: '',
    siteId: '',
    orgId: '',
    checkIn: plan.start,
    checkOut: plan.end,
    method: 'manual',
  };
  // Only finished shifts count: an open shift has no end to measure rest or hours from.
  const finished = existing.filter((s) => s.checkOut !== null);
  const window = {
    windowStart: new Date(endMs - 7 * DAY_MS).toISOString(),
    windowEnd: plan.end,
  };
  const before = new Set(evaluateFatigue({ shifts: finished, ...window }).map(flagKey));
  const newFlags = evaluateFatigue({ shifts: [...finished, planned], ...window }).filter(
    (f) => !before.has(flagKey(f)),
  );

  const week = calculateIsoWeek(istDateKey(plan.start));
  const sameWeek = finished.filter((s) => calculateIsoWeek(istDateKey(s.checkIn)) === week);
  const without = calculateShiftsOvertime(sameWeek, hourlyRate, policy);
  const withPlan = calculateShiftsOvertime([...sameWeek, planned], hourlyRate, policy);

  return {
    hours,
    clashes,
    newFlags,
    extraOvertimeHours: Math.round((withPlan.overtimeHours - without.overtimeHours) * 100) / 100,
    extraOvertimePay: toRupees(toPaise(withPlan.overtimePay) - toPaise(without.overtimePay)),
    verdict: clashes.length > 0 ? 'clash' : newFlags.length > 0 ? 'risky' : 'ok',
  };
}

/** Why a planned shift cannot be checked at all, or null when it can. */
export function planProblem(plan: PlannedShift, now: Date): string | null {
  const hours = calculateShiftHours(plan.start, plan.end);
  if (hours > MAX_PLANNED_SHIFT_HOURS) {
    return `A shift can be at most ${MAX_PLANNED_SHIFT_HOURS} hours.`;
  }
  const today = istDateKey(now);
  const last = istDateKey(new Date(now.getTime() + PLAN_AHEAD_DAYS * DAY_MS));
  const day = istDateKey(plan.start);
  if (day < today || day > last) {
    return `Pick a day from today to ${PLAN_AHEAD_DAYS} days ahead.`;
  }
  return null;
}
