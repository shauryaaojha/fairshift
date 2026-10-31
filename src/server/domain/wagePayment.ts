/**
 * Paying a month's wages by UPI and keeping the proof. The employer scans a UPI link whose amount
 * is the worker's payslip, computed on the server, so the amount can't be typed in wrong. After
 * paying, they record the bank's 12-digit reference (UTR). A month is paid once, and the worker
 * sees the date and UTR on their payslip, which they can take to their bank if the money never
 * arrived. Wages are due by the 7th of the next month (Code on Wages, 2019, s.17), so an unpaid
 * month after that is flagged. Pure.
 */

import { istDateKey } from './time';
import { wagesDueBy } from './payQuery';
import { calculatePayslip } from './payslip';
import { monthPeriod, shiftsInPeriod } from './registers';
import type { PayslipResult, PolicySource, Shift, WagePayment, Worker } from '../../shared/types';

/** A UPI ID: handle@bank, as NPCI allows. */
export const VPA_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{2,64}$/;
/** The 12-digit reference every UPI payment gets. */
export const UTR_PATTERN = /^\d{12}$/;

export type WageState = 'paid' | 'due' | 'overdue';

/** One id per worker and month, so the store refuses a second payment for the same month. */
export function wagePaymentId(workerId: string, period: string): string {
  return `wage_${workerId}_${period}`;
}

/** `YYYY-MM` of the IST month containing `now`. */
export function periodOf(now: Date): string {
  return istDateKey(now).slice(0, 7);
}

export function previousPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** The months the console may pay: last month and this one. */
export function payablePeriods(now: Date): string[] {
  const current = periodOf(now);
  return [previousPeriod(current), current];
}

/**
 * A worker's payslip for one month, worked out exactly as the worker's own payslip is (the whole
 * month once it is over, else up to today). Null for a malformed or future month, and for a month
 * with no attendance recorded: there is nothing to pay through the app for it.
 */
export function payslipForMonth(
  worker: Pick<Worker, 'id' | 'basePay' | 'allowances' | 'payType'>,
  shifts: Shift[],
  month: string,
  now: Date,
  policy: PolicySource,
): PayslipResult | null {
  const period = monthPeriod(month, now);
  if (!period) return null;
  const worked = shiftsInPeriod(
    shifts.filter((s) => s.workerId === worker.id),
    period,
  );
  if (worked.length === 0) return null;
  return calculatePayslip({
    worker: { basePay: worker.basePay, allowances: worker.allowances, payType: worker.payType },
    shifts: worked,
    periodStart: period.start,
    periodEnd: period.end,
    policy,
  });
}

export function wageState(period: string, payment: WagePayment | null, now: Date): WageState {
  if (payment) return 'paid';
  return istDateKey(now) > wagesDueBy(period) ? 'overdue' : 'due';
}

export interface UpiPayInput {
  vpa: string;
  payeeName: string;
  amount: number;
  note: string;
}

/**
 * A `upi://pay` link any UPI app opens with the payee and amount filled in (NPCI's deep-link
 * format). Returns null for a malformed UPI ID or a non-positive amount, so nothing half-filled is
 * ever shown to scan.
 */
export function upiPayUri({ vpa, payeeName, amount, note }: UpiPayInput): string | null {
  if (!VPA_PATTERN.test(vpa) || !Number.isFinite(amount) || amount <= 0) return null;
  const params = [
    ['pa', vpa],
    ['pn', payeeName.slice(0, 50)],
    ['am', amount.toFixed(2)],
    ['cu', 'INR'],
    ['tn', note.slice(0, 80)],
  ];
  return `upi://pay?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}
