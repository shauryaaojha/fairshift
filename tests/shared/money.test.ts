import { describe, expect, it } from 'vitest';
import { payForMinutes, toPaise, toRupees } from '@/src/shared/money';
import { calculatePayslip } from '@/src/server/domain/payslip';
import { calculateShiftsOvertime } from '@/src/server/domain/overtime';
import type { Shift } from '@/src/shared/types';

describe('money in paise', () => {
  it('converts rupees to whole paise without float error', () => {
    expect(toPaise(0.1 + 0.2)).toBe(30);
    expect(toPaise(1.005)).toBe(101);
    expect(toPaise(11015.5)).toBe(1101550);
    expect(toRupees(1101550)).toBe(11015.5);
  });

  it('prices minutes and rounds once', () => {
    // 20 minutes at ₹33/h at 2x is ₹22.00 exactly.
    expect(payForMinutes(20, 3300, 2)).toBe(2200);
    // 1 minute at ₹100.01/h: 166.68 paise, rounded once to 167.
    expect(payForMinutes(1, 10001)).toBe(167);
  });
});

const shift = (day: string, inTime: string, outTime: string): Shift => ({
  id: `${day}-${inTime}`,
  workerId: 'w',
  siteId: 's',
  orgId: 'o',
  checkIn: `${day}T${inTime}:00+05:30`,
  checkOut: `${day}T${outTime}:00+05:30`,
  method: 'qr',
});

describe('pay engine', () => {
  it('pays overtime for exact minutes, not hours rounded per shift', () => {
    // Three days of 8 h 20 min: 1 h of overtime in all, at 2x of ₹100/h.
    const days = ['2026-10-05', '2026-10-06', '2026-10-07'];
    const ot = calculateShiftsOvertime(
      days.map((d) => shift(d, '09:00', '17:20')),
      100,
    );
    expect(ot.overtimeHours).toBe(1);
    expect(ot.overtimePay).toBe(200);
  });

  it('keeps net + deductions equal to gross to the paisa, for awkward rates', () => {
    for (const basePay of [733.33, 801.17, 999.99, 18_333.33]) {
      for (const allowances of [0, 0.1, 250.55]) {
        const slip = calculatePayslip({
          worker: { basePay, allowances, payType: basePay > 5000 ? 'monthly' : 'daily' },
          shifts: [shift('2026-10-05', '08:00', '18:07'), shift('2026-10-06', '08:00', '17:13')],
          periodStart: '2026-10-01',
          periodEnd: '2026-10-31',
        });
        const earned = slip.lines.filter((l) => l.type === 'earning');
        expect(toPaise(slip.gross)).toBe(earned.reduce((sum, l) => sum + toPaise(l.amount), 0));
        expect(toPaise(slip.net) + toPaise(slip.totalDeductions)).toBe(toPaise(slip.gross));
        // Every line is a whole number of paise.
        for (const l of slip.lines) expect(l.amount * 100).toBeCloseTo(toPaise(l.amount), 6);
      }
    }
  });
});
