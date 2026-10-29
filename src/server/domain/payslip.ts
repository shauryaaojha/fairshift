/**
 * Payslip lines from shifts: base pay, overtime, allowances, PF (12% of basic up to Rs 15,000) and
 * ESI (0.75% when gross is Rs 21,000 or less). Pure.
 */

import { istDateKey } from './time';
import type { PayslipInput, PayslipResult, PayslipLine } from '../../shared/types';
import { calculateShiftsOvertime } from './overtime';

export const DEFAULT_PF_RATE = 0.12;
export const DEFAULT_PF_CEILING = 15000;
export const DEFAULT_ESI_RATE = 0.0075;
export const DEFAULT_ESI_CEILING = 21000;

/**
 * Calculates base earnings and hourly rate based on worker pay type.
 */
export function deriveHourlyRate(basePay: number, payType: 'daily' | 'monthly'): number {
  if (basePay <= 0) return 0;
  if (payType === 'daily') {
    // Standard 8h daily shift
    return Math.round((basePay / 8) * 100) / 100;
  } else {
    // 26 working days * 8 hours = 208 standard monthly hours
    return Math.round((basePay / 208) * 100) / 100;
  }
}

/**
 * Generates an itemized payslip.
 */
export function calculatePayslip(input: PayslipInput): PayslipResult {
  const { worker, shifts, periodStart, periodEnd, policy } = input;
  const pfRate = policy?.pfRate ?? DEFAULT_PF_RATE;
  const pfCeiling = policy?.pfCeiling ?? DEFAULT_PF_CEILING;
  const esiRate = policy?.esiRate ?? DEFAULT_ESI_RATE;
  const esiCeiling = policy?.esiCeiling ?? DEFAULT_ESI_CEILING;

  const hourlyRate = deriveHourlyRate(worker.basePay, worker.payType);
  const otResult = calculateShiftsOvertime(shifts, hourlyRate, policy);

  // Compute base pay for the period
  let baseEarnings = 0;
  if (worker.payType === 'daily') {
    // Count unique days or completed shifts
    const uniqueDays = new Set(
      shifts.filter((s) => s.checkOut !== null).map((s) => istDateKey(s.checkIn)),
    );
    baseEarnings = uniqueDays.size * worker.basePay;
  } else {
    baseEarnings = worker.basePay;
  }

  const overtimeEarnings = otResult.overtimePay;
  const allowancesEarnings = Math.max(0, worker.allowances);

  const gross = Math.round((baseEarnings + overtimeEarnings + allowancesEarnings) * 100) / 100;

  // Statutory Deductions
  // PF: 12% of basic wage capped at ₹15,000 ceiling
  const eligiblePfWage = Math.min(baseEarnings, pfCeiling);
  const pfDeduction = Math.round(eligiblePfWage * pfRate);

  // ESI: 0.75% of gross earnings if gross <= ₹21,000
  let esiDeduction = 0;
  if (gross > 0 && gross <= esiCeiling) {
    esiDeduction = Math.round(gross * esiRate);
  }

  const totalDeductions = pfDeduction + esiDeduction;
  const net = Math.max(0, Math.round((gross - totalDeductions) * 100) / 100);

  const lines: PayslipLine[] = [
    {
      key: 'payslip.basePay',
      label: 'Base Pay',
      amount: baseEarnings,
      type: 'earning',
    },
  ];

  if (overtimeEarnings > 0) {
    lines.push({
      key: 'payslip.overtime',
      label: `Overtime (${otResult.overtimeHours}h @ 2x)`,
      amount: overtimeEarnings,
      type: 'earning',
    });
  }

  if (allowancesEarnings > 0) {
    lines.push({
      key: 'payslip.allowances',
      label: 'Allowances & Welfare',
      amount: allowancesEarnings,
      type: 'earning',
    });
  }

  lines.push({
    key: 'payslip.gross',
    label: 'Gross Wages',
    amount: gross,
    type: 'total',
  });

  if (pfDeduction > 0) {
    lines.push({
      key: 'payslip.pf',
      label: 'Provident Fund (PF 12%)',
      amount: pfDeduction,
      type: 'deduction',
    });
  }

  if (esiDeduction > 0) {
    lines.push({
      key: 'payslip.esi',
      label: 'ESI Healthcare (0.75%)',
      amount: esiDeduction,
      type: 'deduction',
    });
  }

  lines.push({
    key: 'payslip.net',
    label: 'Net Take-Home Pay',
    amount: net,
    type: 'total',
  });

  return {
    lines,
    gross,
    totalDeductions,
    net,
    periodStart,
    periodEnd,
  };
}
