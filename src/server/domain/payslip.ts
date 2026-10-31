/**
 * Payslip lines from shifts: base pay, overtime, allowances, PF (12% of basic up to Rs 15,000) and
 * ESI (0.75% when gross is Rs 21,000 or less). Every sum is in whole paise; PF and ESI are rounded
 * to the rupee. Lines come out in rupees. Pure.
 */

import { istDateKey } from './time';
import type { PayslipInput, PayslipResult, PayslipLine } from '../../shared/types';
import { hoursOf, policyAt, shiftsOvertimeMinutes } from './overtime';
import { toPaise, toRupees } from '../../shared/money';

/** A share of an amount in paise, rounded to a whole rupee. */
const wholeRupees = (paise: number, rate: number) => Math.round((paise * rate) / 100) * 100;

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
  const { worker, shifts, periodStart, periodEnd } = input;
  const policy = policyAt(input.policy, periodEnd);
  const pfRate = policy?.pfRate ?? DEFAULT_PF_RATE;
  const pfCeiling = policy?.pfCeiling ?? DEFAULT_PF_CEILING;
  const esiRate = policy?.esiRate ?? DEFAULT_ESI_RATE;
  const esiCeiling = policy?.esiCeiling ?? DEFAULT_ESI_CEILING;

  const hourlyRate = deriveHourlyRate(worker.basePay, worker.payType);
  const ot = shiftsOvertimeMinutes(shifts, hourlyRate, input.policy);

  // Base pay for the period: a day's pay per day worked, or the month's pay.
  let basePaise = toPaise(worker.basePay);
  if (worker.payType === 'daily') {
    const uniqueDays = new Set(
      shifts.filter((s) => s.checkOut !== null).map((s) => istDateKey(s.checkIn)),
    );
    basePaise *= uniqueDays.size;
  }
  const overtimePaise = ot.overtimePaise;
  const allowancesPaise = toPaise(Math.max(0, worker.allowances));
  const grossPaise = basePaise + overtimePaise + allowancesPaise;

  // Statutory deductions. PF: 12% of basic wage up to the ₹15,000 ceiling.
  const pfPaise = wholeRupees(Math.min(basePaise, toPaise(pfCeiling)), pfRate);
  // ESI: 0.75% of gross, only when gross is ₹21,000 or less.
  const esiPaise =
    grossPaise > 0 && grossPaise <= toPaise(esiCeiling) ? wholeRupees(grossPaise, esiRate) : 0;

  const deductionsPaise = pfPaise + esiPaise;
  const netPaise = Math.max(0, grossPaise - deductionsPaise);

  const baseEarnings = toRupees(basePaise);
  const overtimeEarnings = toRupees(overtimePaise);
  const allowancesEarnings = toRupees(allowancesPaise);
  const gross = toRupees(grossPaise);
  const pfDeduction = toRupees(pfPaise);
  const esiDeduction = toRupees(esiPaise);
  const totalDeductions = toRupees(deductionsPaise);
  const net = toRupees(netPaise);

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
      label: `Overtime (${hoursOf(ot.overtimeMinutes)}h @ 2x)`,
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
