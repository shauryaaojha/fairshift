/**
 * Statutory registers as CSV: an attendance register (muster roll) and a wage register for one IST
 * calendar month, built from the same shifts and the same payslip engine the worker sees, so the
 * employer's register and the worker's payslip cannot disagree. Pure.
 */

import type { PayslipResult, PolicySource, Shift, Worker } from '../../shared/types';
import { calculatePayslip, deriveHourlyRate } from './payslip';
import { calculateShiftHours, calculateShiftsOvertime } from './overtime';
import { istDateKey } from './time';

export type RegisterKind = 'attendance' | 'wages';

export interface RegisterPeriod {
  /** First IST day, YYYY-MM-DD. */
  start: string;
  /** Last IST day included: the month's end, or today for the current month. */
  end: string;
}

type RegisterWorker = Pick<
  Worker,
  'id' | 'name' | 'team' | 'role' | 'payType' | 'basePay' | 'allowances'
>;

/** The period for month `YYYY-MM`, cut at today. Null for a malformed or future month. */
export function monthPeriod(month: string, now: Date): RegisterPeriod | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!m) return null;
  const today = istDateKey(now);
  const start = `${month}-01`;
  if (start > today) return null;
  const lastDay = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
  const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`;
  return { start, end: monthEnd < today ? monthEnd : today };
}

/** Shifts that began on an IST day inside the period. The payslip uses the same rule. */
export function shiftsInPeriod(shifts: Shift[], period: RegisterPeriod): Shift[] {
  return shifts.filter((s) => {
    const day = istDateKey(s.checkIn);
    return day >= period.start && day <= period.end;
  });
}

function daysOf(period: RegisterPeriod): string[] {
  const days: string[] = [];
  for (let d = new Date(`${period.start}T00:00:00Z`); ; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    if (key > period.end) return days;
    days.push(key);
  }
}

const hours = (h: number) => (Math.round(h * 10) / 10).toFixed(1);
const rupees = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

function byName(a: RegisterWorker, b: RegisterWorker) {
  return a.name.localeCompare(b.name, 'en');
}

/**
 * One row per worker, one column per day: hours worked, `P` for a shift still open, `A` for no
 * shift. Then days present, total hours and overtime hours.
 */
export function attendanceRegister(
  workers: RegisterWorker[],
  shifts: Shift[],
  period: RegisterPeriod,
  policy?: PolicySource,
): string[][] {
  const days = daysOf(period);
  const inPeriod = shiftsInPeriod(shifts, period);
  const header = [
    'Sl. No.',
    'Worker ID',
    'Name',
    'Team',
    'Role',
    ...days.map((d) => d.slice(8)),
    'Days present',
    'Hours worked',
    'Overtime hours',
  ];
  const rows = [...workers].sort(byName).map((w, i) => {
    const mine = inPeriod.filter((s) => s.workerId === w.id);
    const cells = days.map((day) => {
      const today = mine.filter((s) => istDateKey(s.checkIn) === day);
      if (today.length === 0) return 'A';
      if (today.some((s) => s.checkOut === null)) return 'P';
      return hours(today.reduce((sum, s) => sum + calculateShiftHours(s.checkIn, s.checkOut), 0));
    });
    const total = mine.reduce((sum, s) => sum + calculateShiftHours(s.checkIn, s.checkOut), 0);
    const ot = calculateShiftsOvertime(mine, deriveHourlyRate(w.basePay, w.payType), policy);
    return [
      String(i + 1),
      w.id,
      w.name,
      w.team,
      w.role,
      ...cells,
      String(cells.filter((c) => c !== 'A').length),
      hours(total),
      hours(ot.overtimeHours),
    ];
  });
  return [header, ...rows];
}

function line(p: PayslipResult, key: string): number {
  return p.lines.find((l) => l.key === key)?.amount ?? 0;
}

/** One row per worker with the same figures as their payslip for the period. */
export function wageRegister(
  workers: RegisterWorker[],
  shifts: Shift[],
  period: RegisterPeriod,
  policy?: PolicySource,
): string[][] {
  const inPeriod = shiftsInPeriod(shifts, period);
  const header = [
    'Sl. No.',
    'Worker ID',
    'Name',
    'Role',
    'Pay type',
    'Rate (Rs)',
    'Days worked',
    'Overtime hours',
    'Basic (Rs)',
    'Overtime (Rs)',
    'Allowances (Rs)',
    'Gross (Rs)',
    'PF (Rs)',
    'ESI (Rs)',
    'Total deductions (Rs)',
    'Net pay (Rs)',
  ];
  const rows = [...workers].sort(byName).map((w, i) => {
    const mine = inPeriod.filter((s) => s.workerId === w.id);
    const payslip = calculatePayslip({
      worker: { basePay: w.basePay, allowances: w.allowances, payType: w.payType },
      shifts: mine,
      periodStart: period.start,
      periodEnd: period.end,
      policy,
    });
    const ot = calculateShiftsOvertime(mine, deriveHourlyRate(w.basePay, w.payType), policy);
    const daysWorked = new Set(
      mine.filter((s) => s.checkOut !== null).map((s) => istDateKey(s.checkIn)),
    ).size;
    return [
      String(i + 1),
      w.id,
      w.name,
      w.role,
      w.payType,
      rupees(w.basePay),
      String(daysWorked),
      hours(ot.overtimeHours),
      rupees(line(payslip, 'payslip.basePay')),
      rupees(line(payslip, 'payslip.overtime')),
      rupees(line(payslip, 'payslip.allowances')),
      rupees(payslip.gross),
      rupees(line(payslip, 'payslip.pf')),
      rupees(line(payslip, 'payslip.esi')),
      rupees(payslip.totalDeductions),
      rupees(payslip.net),
    ];
  });
  return [header, ...rows];
}

const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

/**
 * Text that a spreadsheet would run as a formula (`=`, `+`, `-`, `@`, tab, carriage return) gets a
 * leading apostrophe, so a worker named "=HYPERLINK(...)" cannot run anything on the HR laptop.
 * Plain numbers are left alone.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) && !PLAIN_NUMBER.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** RFC 4180 CSV with CRLF line ends and a UTF-8 BOM, so Excel shows Tamil and Hindi names. */
export function toCsv(rows: string[][]): string {
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
