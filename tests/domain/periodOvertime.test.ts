import { describe, expect, it } from 'vitest';
import { calculateShiftsOvertime } from '../../src/server/domain/overtime';
import { istDateKey, istMonthStart } from '../../src/server/domain/time';
import type { Shift } from '../../src/shared/types';

/** A shift starting at 08:00 IST (02:30 UTC) on the given date, lasting `hours`. */
function shift(date: string, hours: number): Shift {
  const start = Date.parse(`${date}T02:30:00.000Z`);
  return {
    id: `s-${date}`,
    workerId: 'w1',
    siteId: 'site',
    orgId: 'org',
    checkIn: new Date(start).toISOString(),
    checkOut: new Date(start + hours * 3600 * 1000).toISOString(),
    method: 'qr',
  };
}

describe('calculateShiftsOvertime over a pay period', () => {
  it('pays no overtime for a month of normal 8 h days (regression: 88 h bug)', () => {
    // 17 working days across October 2026, 8 h each = 136 h, never > 48 in one week
    const days = [
      '01',
      '02',
      '03',
      '05',
      '06',
      '07',
      '08',
      '09',
      '12',
      '13',
      '14',
      '15',
      '16',
      '19',
      '20',
      '21',
      '22',
    ];
    const result = calculateShiftsOvertime(
      days.map((d) => shift(`2026-10-${d}`, 8)),
      100,
    );
    expect(result.overtimeHours).toBe(0);
    expect(result.regularHours).toBe(136);
    expect(result.overtimePay).toBe(0);
  });

  it('applies the weekly limit per ISO week', () => {
    // Mon 19 – Sat 24 Oct 2026: six 9 h days = 54 h. Daily OT 6 h, weekly OT 6 h -> 6 h.
    const week = ['19', '20', '21', '22', '23', '24'].map((d) => shift(`2026-10-${d}`, 9));
    const result = calculateShiftsOvertime(week, 100);
    expect(result.overtimeHours).toBe(6);
    expect(result.overtimePay).toBe(1200);
  });

  it('uses whichever rule pays more within the week', () => {
    // Mon–Sun, seven 7.5 h days = 52.5 h: no daily OT, weekly OT 4.5 h
    const week = ['19', '20', '21', '22', '23', '24', '25'].map((d) => shift(`2026-10-${d}`, 7.5));
    expect(calculateShiftsOvertime(week, 100).overtimeHours).toBe(4.5);
  });

  it('adds overtime from separate weeks instead of pooling the month', () => {
    const w1 = ['05', '06', '07', '08', '09', '10'].map((d) => shift(`2026-10-${d}`, 9)); // 6 h OT
    const w2 = ['12', '13'].map((d) => shift(`2026-10-${d}`, 8)); // 0 h OT
    expect(calculateShiftsOvertime([...w1, ...w2], 100).overtimeHours).toBe(6);
  });
});

describe('IST calendar helpers', () => {
  it('maps a late-UTC timestamp to the next IST day', () => {
    expect(istDateKey('2026-10-26T20:00:00.000Z')).toBe('2026-10-27'); // 01:30 IST
    expect(istDateKey('2026-10-27T18:29:00.000Z')).toBe('2026-10-27'); // 23:59 IST
  });

  it('gives the first day of the IST month', () => {
    expect(istMonthStart(new Date('2026-10-31T19:00:00.000Z'))).toBe('2026-11-01'); // already Nov in IST
    expect(istMonthStart(new Date('2026-10-15T10:00:00.000Z'))).toBe('2026-10-01');
  });
});
