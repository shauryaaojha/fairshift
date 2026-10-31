import { describe, expect, it } from 'vitest';
import {
  MAX_PLANNED_SHIFT_HOURS,
  checkShiftPlan,
  planFromLocal,
  planProblem,
} from '@/src/server/domain/shiftPlan';
import type { Shift } from '@/src/shared/types';

/** A worked shift starting at `start` IST on `date`, `hours` long. */
function worked(date: string, start: string, hours: number, id = `s-${date}`): Shift {
  const from = Date.parse(`${date}T${start}:00+05:30`);
  return {
    id,
    workerId: 'w',
    siteId: 's',
    orgId: 'o',
    checkIn: new Date(from).toISOString(),
    checkOut: new Date(from + hours * 3600_000).toISOString(),
    method: 'qr',
  };
}

describe('reading the plan', () => {
  it('turns IST date and times into a shift, past midnight when the end is earlier', () => {
    expect(planFromLocal('2026-11-03', '09:00', '17:00')).toEqual({
      start: '2026-11-03T03:30:00.000Z',
      end: '2026-11-03T11:30:00.000Z',
    });
    expect(planFromLocal('2026-11-03', '22:00', '06:00')).toEqual({
      start: '2026-11-03T16:30:00.000Z',
      end: '2026-11-04T00:30:00.000Z',
    });
  });

  it('rejects anything unreadable', () => {
    expect(planFromLocal('03-11-2026', '09:00', '17:00')).toBeNull();
    expect(planFromLocal('2026-11-03', '9am', '17:00')).toBeNull();
    expect(planFromLocal('2026-11-03', '09:00', '24:30')).toBeNull();
    expect(planFromLocal('2026-13-45', '09:00', '17:00')).toBeNull();
  });

  it('allows today to two weeks ahead and at most 16 hours', () => {
    const now = new Date('2026-10-31T06:00:00.000Z');
    expect(planProblem(planFromLocal('2026-10-31', '18:00', '22:00')!, now)).toBeNull();
    expect(planProblem(planFromLocal('2026-10-30', '09:00', '17:00')!, now)).toMatch(/today/);
    expect(planProblem(planFromLocal('2026-11-20', '09:00', '17:00')!, now)).toMatch(/14 days/);
    expect(planProblem(planFromLocal('2026-11-02', '04:00', '22:00')!, now)).toContain(
      String(MAX_PLANNED_SHIFT_HOURS),
    );
  });
});

describe('what one more shift does', () => {
  it('is safe on a rested week, with no overtime', () => {
    const shifts = [worked('2026-11-02', '09:00', 8)];
    const result = checkShiftPlan(shifts, planFromLocal('2026-11-03', '09:00', '17:00')!, 100);
    expect(result).toMatchObject({
      hours: 8,
      verdict: 'ok',
      clashes: [],
      newFlags: [],
      extraOvertimeHours: 0,
      extraOvertimePay: 0,
    });
  });

  it('flags a short rest and the overtime it adds', () => {
    // Ends 22:00 on the 2nd; a 05:00 start on the 3rd leaves 7 h of rest.
    const shifts = [worked('2026-11-02', '12:00', 10)];
    const result = checkShiftPlan(shifts, planFromLocal('2026-11-03', '05:00', '15:00')!, 100);
    expect(result.verdict).toBe('risky');
    expect(result.newFlags.map((f) => f.type)).toEqual(['short_rest']);
    // 10 h day: 2 h beyond 8, at 2x on ₹100.
    expect(result.extraOvertimeHours).toBe(2);
    expect(result.extraOvertimePay).toBe(400);
  });

  it('reports only the warnings the planned shift adds', () => {
    // Six 9 h days already break 48 h in 7 days; a seventh day adds "no rest day" only.
    const shifts = ['02', '03', '04', '05', '06', '07'].map((d) =>
      worked(`2026-11-${d}`, '08:00', 9),
    );
    const result = checkShiftPlan(shifts, planFromLocal('2026-11-08', '08:00', '12:00')!, 100);
    expect(result.newFlags.map((f) => f.type)).toEqual(['no_rest_day']);
  });

  it('flags a shift longer than 10 hours', () => {
    const result = checkShiftPlan([], planFromLocal('2026-11-03', '06:00', '18:00')!, 100);
    expect(result.newFlags.map((f) => f.type)).toEqual(['long_shift']);
    expect(result.extraOvertimeHours).toBe(4);
  });

  it('calls out a clash with a shift on record, including one still open', () => {
    const open: Shift = { ...worked('2026-11-03', '07:00', 1, 'open'), checkOut: null };
    const result = checkShiftPlan(
      [worked('2026-11-02', '09:00', 8), open],
      planFromLocal('2026-11-03', '09:00', '17:00')!,
      100,
    );
    expect(result.verdict).toBe('clash');
    expect(result.clashes.map((s) => s.id)).toEqual(['open']);
  });

  it('prices overtime at the rules of the planned week', () => {
    const result = checkShiftPlan(
      [],
      planFromLocal('2026-11-03', '06:00', '16:00')!,
      100,
      (date) => (date >= '2026-11-02' ? { otMultiplier: 3 } : undefined),
    );
    expect(result.extraOvertimePay).toBe(2 * 100 * 3);
  });
});
