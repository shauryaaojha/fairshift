import { describe, it, expect } from 'vitest';
import {
  evaluateFatigue,
  calculateRestGapHours,
  countConsecutiveWorkingDays,
} from '../../src/server/domain/fatigue';
import type { Shift } from '../../src/shared/types';

describe('Domain: Fatigue Flag Engine', () => {
  describe('calculateRestGapHours', () => {
    it('calculates rest gap between shifts', () => {
      const prevEnd = '2026-10-20T17:00:00.000Z';
      const nextStart = '2026-10-21T08:00:00.000Z'; // 15 hours
      expect(calculateRestGapHours(prevEnd, nextStart)).toBe(15);
    });

    it('returns null for missing or invalid dates', () => {
      expect(calculateRestGapHours(null, '2026-10-21T08:00:00.000Z')).toBeNull();
      expect(
        calculateRestGapHours('2026-10-21T18:00:00.000Z', '2026-10-21T08:00:00.000Z'),
      ).toBeNull();
    });
  });

  describe('countConsecutiveWorkingDays', () => {
    it('counts continuous working days without rest', () => {
      const shifts: Shift[] = [
        '2026-10-01',
        '2026-10-02',
        '2026-10-03',
        '2026-10-04',
        '2026-10-05',
        '2026-10-06',
        '2026-10-07',
      ].map((d, i) => ({
        id: `s${i}`,
        workerId: 'w1',
        siteId: 's1',
        orgId: 'o1',
        checkIn: `${d}T08:00:00.000Z`,
        checkOut: `${d}T17:00:00.000Z`,
        method: 'qr',
      }));

      expect(countConsecutiveWorkingDays(shifts)).toBe(7);
    });

    it('resets streak when rest day occurs', () => {
      const shifts: Shift[] = ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06'].map(
        (d, i) => ({
          id: `s${i}`,
          workerId: 'w1',
          siteId: 's1',
          orgId: 'o1',
          checkIn: `${d}T08:00:00.000Z`,
          checkOut: `${d}T17:00:00.000Z`,
          method: 'qr',
        }),
      );

      expect(countConsecutiveWorkingDays(shifts)).toBe(2);
    });

    it('handles empty shift array', () => {
      expect(countConsecutiveWorkingDays([])).toBe(0);
    });
  });

  describe('evaluateFatigue', () => {
    it('detects long shifts (>10h)', () => {
      const shifts: Shift[] = [
        {
          id: 's1',
          workerId: 'w1',
          siteId: 's1',
          orgId: 'o1',
          checkIn: '2026-10-20T07:00:00.000Z',
          checkOut: '2026-10-20T18:00:00.000Z', // 11 hours
          method: 'qr',
        },
      ];

      const flags = evaluateFatigue({
        shifts,
        windowStart: '2026-10-20T00:00:00.000Z',
        windowEnd: '2026-10-26T23:59:59.000Z',
      });

      expect(flags.some((f) => f.type === 'long_shift')).toBe(true);
    });

    it('detects short rest (<10h gap)', () => {
      const shifts: Shift[] = [
        {
          id: 's1',
          workerId: 'w1',
          siteId: 's1',
          orgId: 'o1',
          checkIn: '2026-10-20T08:00:00.000Z',
          checkOut: '2026-10-20T23:00:00.000Z',
          method: 'qr',
        },
        {
          id: 's2',
          workerId: 'w1',
          siteId: 's1',
          orgId: 'o1',
          checkIn: '2026-10-21T06:00:00.000Z', // only 7h gap
          checkOut: '2026-10-21T14:00:00.000Z',
          method: 'qr',
        },
      ];

      const flags = evaluateFatigue({
        shifts,
        windowStart: '2026-10-20T00:00:00.000Z',
        windowEnd: '2026-10-26T23:59:59.000Z',
      });

      expect(flags.some((f) => f.type === 'short_rest')).toBe(true);
    });

    it('detects weekly hours exceeded (>48h)', () => {
      const shifts: Shift[] = [1, 2, 3, 4, 5, 6].map((day) => ({
        id: `s${day}`,
        workerId: 'w1',
        siteId: 's1',
        orgId: 'o1',
        checkIn: `2026-10-${day < 10 ? '0' + day : day}T08:00:00.000Z`,
        checkOut: `2026-10-${day < 10 ? '0' + day : day}T17:00:00.000Z`, // 9h each * 6 = 54h
        method: 'qr' as const,
      }));

      const flags = evaluateFatigue({
        shifts,
        windowStart: '2026-10-01T00:00:00.000Z',
        windowEnd: '2026-10-07T23:59:59.000Z',
      });

      expect(flags.some((f) => f.type === 'weekly_hours_exceeded')).toBe(true);
    });
  });
});
