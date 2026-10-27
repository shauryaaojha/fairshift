import { describe, it, expect } from 'vitest';
import {
  calculateDailyOvertime,
  calculateWeeklyOvertime,
  calculateShiftHours,
  calculateShiftsOvertime,
} from '../../src/server/domain/overtime';
import type { Shift } from '../../src/shared/types';

describe('Domain: Overtime Engine', () => {
  describe('calculateDailyOvertime', () => {
    it('handles 8 hours or less without overtime', () => {
      const res = calculateDailyOvertime({
        totalHoursWorked: 8,
        hourlyRate: 100,
      });
      expect(res.regularHours).toBe(8);
      expect(res.overtimeHours).toBe(0);
      expect(res.regularPay).toBe(800);
      expect(res.overtimePay).toBe(0);
    });

    it('handles overtime with 2x multiplier for excess hours', () => {
      const res = calculateDailyOvertime({
        totalHoursWorked: 11,
        hourlyRate: 100,
      });
      expect(res.regularHours).toBe(8);
      expect(res.overtimeHours).toBe(3);
      expect(res.regularPay).toBe(800);
      expect(res.overtimePay).toBe(600); // 3h * 100 * 2
    });

    it('respects custom daily limits and multipliers', () => {
      const res = calculateDailyOvertime({
        totalHoursWorked: 10,
        hourlyRate: 50,
        dailyLimit: 6,
        otMultiplier: 1.5,
      });
      expect(res.regularHours).toBe(6);
      expect(res.overtimeHours).toBe(4);
      expect(res.regularPay).toBe(300);
      expect(res.overtimePay).toBe(300);
    });

    it('handles negative or zero hours gracefully', () => {
      const res = calculateDailyOvertime({
        totalHoursWorked: -5,
        hourlyRate: 100,
      });
      expect(res.regularHours).toBe(0);
      expect(res.overtimeHours).toBe(0);
    });
  });

  describe('calculateWeeklyOvertime', () => {
    it('calculates weekly overtime when total exceeds 48 hours', () => {
      const res = calculateWeeklyOvertime({
        dailyHours: [8, 8, 8, 8, 8, 8, 4], // 52 hours
        hourlyRate: 100,
      });
      expect(res.regularHours).toBe(48);
      expect(res.overtimeHours).toBe(4);
      expect(res.regularPay).toBe(4800);
      expect(res.overtimePay).toBe(800); // 4h * 100 * 2
    });

    it('returns zero overtime when weekly hours <= 48', () => {
      const res = calculateWeeklyOvertime({
        dailyHours: [8, 8, 8, 8, 8], // 40 hours
        hourlyRate: 100,
      });
      expect(res.regularHours).toBe(40);
      expect(res.overtimeHours).toBe(0);
      expect(res.regularPay).toBe(4000);
      expect(res.overtimePay).toBe(0);
    });
  });

  describe('calculateShiftHours', () => {
    it('calculates duration correctly between ISO timestamps', () => {
      const start = '2026-10-27T08:00:00.000Z';
      const end = '2026-10-27T17:30:00.000Z';
      expect(calculateShiftHours(start, end)).toBe(9.5);
    });

    it('returns 0 if checkout is null or invalid', () => {
      expect(calculateShiftHours('2026-10-27T08:00:00.000Z', null)).toBe(0);
      expect(calculateShiftHours('invalid', 'invalid')).toBe(0);
      expect(calculateShiftHours('2026-10-27T17:00:00.000Z', '2026-10-27T08:00:00.000Z')).toBe(0);
    });
  });

  describe('calculateShiftsOvertime', () => {
    it('aggregates daily and weekly overtime for a series of shifts', () => {
      const shifts: Shift[] = [
        {
          id: 's1',
          workerId: 'w1',
          siteId: 'site1',
          orgId: 'org1',
          checkIn: '2026-10-20T08:00:00.000Z',
          checkOut: '2026-10-20T18:00:00.000Z', // 10h (2h OT)
          method: 'qr',
        },
        {
          id: 's2',
          workerId: 'w1',
          siteId: 'site1',
          orgId: 'org1',
          checkIn: '2026-10-21T08:00:00.000Z',
          checkOut: '2026-10-21T17:00:00.000Z', // 9h (1h OT)
          method: 'qr',
        },
      ];

      const res = calculateShiftsOvertime(shifts, 100);
      expect(res.overtimeHours).toBe(3);
      expect(res.regularHours).toBe(16);
      expect(res.overtimePay).toBe(600);
      expect(res.regularPay).toBe(1600);
    });
  });
});
