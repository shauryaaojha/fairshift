import { describe, it, expect } from 'vitest';
import { calculatePayslip, deriveHourlyRate } from '../../src/server/domain/payslip';
import type { Shift, Worker } from '../../src/shared/types';

describe('Domain: Payslip Engine', () => {
  describe('deriveHourlyRate', () => {
    it('derives hourly rate for daily wage (base / 8)', () => {
      expect(deriveHourlyRate(800, 'daily')).toBe(100);
    });

    it('derives hourly rate for monthly wage (base / 208)', () => {
      expect(deriveHourlyRate(20800, 'monthly')).toBe(100);
    });

    it('handles zero base pay gracefully', () => {
      expect(deriveHourlyRate(0, 'daily')).toBe(0);
    });
  });

  describe('calculatePayslip', () => {
    const mockWorkerDaily: Pick<Worker, 'basePay' | 'allowances' | 'payType'> = {
      basePay: 700,
      allowances: 300,
      payType: 'daily',
    };

    const mockShifts: Shift[] = [
      {
        id: 's1',
        workerId: 'w1',
        siteId: 'site1',
        orgId: 'org1',
        checkIn: '2026-10-20T08:00:00.000Z',
        checkOut: '2026-10-20T18:00:00.000Z', // 10h -> 8h reg + 2h OT
        method: 'qr',
      },
      {
        id: 's2',
        workerId: 'w1',
        siteId: 'site1',
        orgId: 'org1',
        checkIn: '2026-10-21T08:00:00.000Z',
        checkOut: '2026-10-21T16:00:00.000Z', // 8h reg
        method: 'qr',
      },
      {
        id: 's3',
        workerId: 'w1',
        siteId: 'site1',
        orgId: 'org1',
        checkIn: '2026-10-22T08:00:00.000Z',
        checkOut: null, // incomplete shift -> should be ignored for daily base pay
        method: 'qr',
      },
    ];

    it('calculates gross, statutory deductions (PF, ESI) and net for daily worker', () => {
      const payslip = calculatePayslip({
        worker: mockWorkerDaily,
        shifts: mockShifts,
        periodStart: '2026-10-20',
        periodEnd: '2026-10-26',
      });

      // 2 completed days worked * 700 = 1400 base
      // hourly rate = 700 / 8 = 87.5
      // 2h OT = 2 * 87.5 * 2 = 350
      // allowances = 300
      // Gross = 1400 + 350 + 300 = 2050
      expect(payslip.gross).toBe(2050);

      // PF = 12% of basic (1400 <= 15000) = 168
      // ESI = 0.75% of gross (2050 <= 21000) = round(2050 * 0.0075) = 15
      // Total deductions = 168 + 15 = 183
      expect(payslip.totalDeductions).toBe(183);
      expect(payslip.net).toBe(1867);

      // Verify line items exist with i18n keys
      const keys = payslip.lines.map((l) => l.key);
      expect(keys).toContain('payslip.basePay');
      expect(keys).toContain('payslip.overtime');
      expect(keys).toContain('payslip.allowances');
      expect(keys).toContain('payslip.gross');
      expect(keys).toContain('payslip.pf');
      expect(keys).toContain('payslip.esi');
      expect(keys).toContain('payslip.net');
    });

    it('handles zero allowances and zero overtime', () => {
      const simpleWorker: Pick<Worker, 'basePay' | 'allowances' | 'payType'> = {
        basePay: 500,
        allowances: 0,
        payType: 'daily',
      };
      const simpleShift: Shift[] = [
        {
          id: 's1',
          workerId: 'w1',
          siteId: 'site1',
          orgId: 'org1',
          checkIn: '2026-10-20T08:00:00.000Z',
          checkOut: '2026-10-20T16:00:00.000Z', // exactly 8h -> 0 OT
          method: 'qr',
        },
      ];
      const payslip = calculatePayslip({
        worker: simpleWorker,
        shifts: simpleShift,
        periodStart: '2026-10-20',
        periodEnd: '2026-10-26',
      });
      expect(payslip.gross).toBe(500);
      const keys = payslip.lines.map((l) => l.key);
      expect(keys).not.toContain('payslip.overtime');
      expect(keys).not.toContain('payslip.allowances');
    });

    it('caps PF deduction at ceiling (₹15,000)', () => {
      const highEarner: Pick<Worker, 'basePay' | 'allowances' | 'payType'> = {
        basePay: 40000,
        allowances: 5000,
        payType: 'monthly',
      };

      const payslip = calculatePayslip({
        worker: highEarner,
        shifts: [],
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
      });

      // Gross = 45000 (> 21000 so ESI is 0)
      // PF = 12% of 15000 ceiling = 1800
      expect(payslip.gross).toBe(45000);
      expect(payslip.totalDeductions).toBe(1800);
      expect(payslip.net).toBe(43200);

      const esiLine = payslip.lines.find((l) => l.key === 'payslip.esi');
      expect(esiLine).toBeUndefined();
    });
  });
});
