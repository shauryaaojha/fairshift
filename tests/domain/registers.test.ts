import { describe, expect, it } from 'vitest';
import {
  attendanceRegister,
  csvCell,
  monthPeriod,
  shiftsInPeriod,
  toCsv,
  wageRegister,
} from '@/src/server/domain/registers';
import { calculatePayslip } from '@/src/server/domain/payslip';
import type { Shift } from '@/src/shared/types';

const NOW = new Date('2026-10-30T06:00:00Z'); // 30 Oct, 11:30 IST

const asha = {
  id: 'w-asha',
  name: 'Asha',
  team: 'Masonry',
  role: 'mason' as const,
  payType: 'daily' as const,
  basePay: 800,
  allowances: 200,
};
const bala = { ...asha, id: 'w-bala', name: 'Bala', payType: 'monthly' as const, basePay: 20000 };

/** IST 09:00 on `day`, for `hours`; null hours leaves the shift open. */
function shift(workerId: string, day: string, hours: number | null): Shift {
  const inMs = Date.parse(`${day}T03:30:00Z`);
  return {
    id: `${workerId}-${day}`,
    workerId,
    siteId: 'site',
    orgId: 'org',
    checkIn: new Date(inMs).toISOString(),
    checkOut: hours === null ? null : new Date(inMs + hours * 3_600_000).toISOString(),
    method: 'qr',
  };
}

describe('monthPeriod', () => {
  it('cuts the current month at today and keeps a past month whole', () => {
    expect(monthPeriod('2026-10', NOW)).toEqual({ start: '2026-10-01', end: '2026-10-30' });
    expect(monthPeriod('2026-02', NOW)).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthPeriod('2024-02', NOW)?.end).toBe('2024-02-29');
  });

  it('refuses a future or malformed month', () => {
    expect(monthPeriod('2026-11', NOW)).toBeNull();
    for (const bad of ['2026-13', '2026-1', 'oct', '']) expect(monthPeriod(bad, NOW)).toBeNull();
  });
});

describe('shiftsInPeriod', () => {
  it('uses the IST day the shift began', () => {
    // 23:00 IST on 30 Sep is 17:30 UTC: still September.
    const lateSep = { ...shift('w', '2026-09-30', 2), checkIn: '2026-09-30T17:30:00Z' };
    // 00:30 IST on 1 Oct is 19:00 UTC on 30 Sep: October.
    const earlyOct = { ...shift('w', '2026-10-01', 2), checkIn: '2026-09-30T19:00:00Z' };
    const period = monthPeriod('2026-10', NOW)!;
    expect(shiftsInPeriod([lateSep, earlyOct], period)).toEqual([earlyOct]);
  });
});

describe('attendanceRegister', () => {
  const period = { start: '2026-10-01', end: '2026-10-03' };
  const shifts = [
    shift('w-asha', '2026-10-01', 10),
    shift('w-asha', '2026-10-03', null),
    shift('w-bala', '2026-10-02', 8),
    shift('w-asha', '2026-09-28', 8), // outside the period
  ];

  it('marks hours, open shifts and absences per day, sorted by name', () => {
    const [header, a, b] = attendanceRegister([bala, asha], shifts, period);
    expect(header).toEqual([
      'Sl. No.',
      'Worker ID',
      'Name',
      'Team',
      'Role',
      '01',
      '02',
      '03',
      'Days present',
      'Hours worked',
      'Overtime hours',
    ]);
    expect(a).toEqual([
      '1',
      'w-asha',
      'Asha',
      'Masonry',
      'mason',
      '10.0',
      'A',
      'P',
      '2',
      '10.0',
      '2.0',
    ]);
    expect(b[2]).toBe('Bala');
    expect(b.slice(5)).toEqual(['A', '8.0', 'A', '1', '8.0', '0.0']);
  });
});

describe('wageRegister', () => {
  const period = { start: '2026-10-01', end: '2026-10-30' };

  it('has the same figures as the payslip the worker sees', () => {
    const shifts = [shift('w-asha', '2026-10-01', 10), shift('w-asha', '2026-10-02', 8)];
    const [header, row] = wageRegister([asha], shifts, period);
    const col = (name: string) => row[header.indexOf(name)];
    const payslip = calculatePayslip({
      worker: asha,
      shifts,
      periodStart: period.start,
      periodEnd: period.end,
    });
    expect(col('Days worked')).toBe('2');
    expect(col('Overtime hours')).toBe('2.0');
    expect(col('Gross (Rs)')).toBe(payslip.gross.toFixed(2));
    expect(col('Total deductions (Rs)')).toBe(payslip.totalDeductions.toFixed(2));
    expect(col('Net pay (Rs)')).toBe(payslip.net.toFixed(2));
  });

  it('lists a worker with no shifts with zero days', () => {
    const [header, row] = wageRegister([asha], [], period);
    expect(row[header.indexOf('Days worked')]).toBe('0');
  });
});

describe('CSV', () => {
  it('neutralises spreadsheet formulas but keeps negative numbers', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('+91 98765')).toBe("'+91 98765");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('-12.5')).toBe('-12.5');
    expect(csvCell('Kumar, Ramesh')).toBe('"Kumar, Ramesh"');
  });

  it('writes a BOM and CRLF rows so Excel opens Indian-script names', () => {
    const csv = toCsv([
      ['Name', 'Hours'],
      ['முருகன்', '8.0'],
    ]);
    expect(csv).toBe('﻿Name,Hours\r\nமுருகன்,8.0\r\n');
  });
});
