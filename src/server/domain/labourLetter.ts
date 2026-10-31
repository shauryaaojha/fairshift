/**
 * A letter to the labour office, for when the employer will not settle a pay query: it has missed
 * the deadline to answer, or the worker has said its answer did not settle it. Everything in the
 * letter comes from records the worker cannot edit: the shifts sealed at check-out, the payslip
 * the engine computed, and the query's own history. This module picks the facts and which sections
 * of the Code on Wages, 2019 apply; the page words them in the worker's language. Pure.
 */

import { payGap, payQueryState, wagesDueBy } from './payQuery';
import { hoursOf, shiftMinutes } from './overtime';
import { istDateKey } from './time';
import { receiptCode } from './shiftReceipt';
import type { PayQuery, PayQueryAnswer, Shift } from '../../shared/types';

/** The days a query's payslip counted: its month, up to the day it was raised. */
export function letterPeriod(q: Pick<PayQuery, 'period' | 'raisedAt'>): {
  start: string;
  end: string;
} {
  const [y, m] = q.period.split('-').map(Number);
  const monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const raised = istDateKey(q.raisedAt);
  return { start: `${q.period}-01`, end: raised < monthEnd ? raised : monthEnd };
}

/** Only once the employer has had its chance: past the deadline, or answered without settling. */
export function canWriteLetter(
  q: Pick<PayQuery, 'answers' | 'workerVerdict' | 'answerDueAt' | 'reopenCount'>,
  now: Date = new Date(),
): boolean {
  const state = payQueryState(q, now);
  return state === 'overdue' || (state !== 'settled' && q.reopenCount > 0);
}

/** Code on Wages, 2019: s. 17 time limit for payment, s. 14 overtime at twice the rate, s. 45 claims. */
export type LawRef = 's17' | 's14' | 's45';

export interface LetterShift {
  date: string;
  checkIn: string;
  checkOut: string;
  hours: number;
  /** Short receipt code, or null when the shift has no receipt. */
  code: string | null;
}

export interface LabourLetter {
  period: string;
  reason: PayQuery['reason'];
  /** The worker's own words on the query, if any. */
  note: string | null;
  days: number;
  hours: number;
  overtimeHours: number;
  payslipNet: number;
  received: number | null;
  /** Rupees short, when the worker typed what they got. */
  gap: number | null;
  wagesDueBy: string;
  raisedAt: string;
  answerDueAt: string;
  /** The employer's latest answer, or null when it never answered. */
  lastAnswer: PayQueryAnswer | null;
  laws: LawRef[];
  shifts: LetterShift[];
}

/**
 * The letter's facts. `shifts` are the worker's shifts the query's payslip counted: the month up to
 * the day it was raised. The money is the query's own, as the worker saw it that day.
 */
export function buildLabourLetter(
  q: PayQuery,
  shifts: Shift[],
  overtimeHours: number,
): LabourLetter {
  const closed = shifts
    .filter((s): s is Shift & { checkOut: string } => s.checkOut !== null)
    .sort((a, b) => Date.parse(a.checkIn) - Date.parse(b.checkIn));
  const minutes = closed.reduce((sum, s) => sum + shiftMinutes(s.checkIn, s.checkOut), 0);
  const laws: LawRef[] = ['s17'];
  if (overtimeHours > 0 || q.reason === 'unpaid_overtime') laws.push('s14');
  laws.push('s45');

  return {
    period: q.period,
    reason: q.reason,
    note: q.note,
    days: new Set(closed.map((s) => istDateKey(s.checkIn))).size,
    hours: hoursOf(minutes),
    overtimeHours,
    payslipNet: q.payslipNet,
    received: q.receivedAmount,
    gap: payGap(q),
    wagesDueBy: wagesDueBy(q.period),
    raisedAt: q.raisedAt,
    answerDueAt: q.answerDueAt,
    lastAnswer: q.answers.at(-1) ?? null,
    laws,
    shifts: closed.map((s) => ({
      date: s.checkIn,
      checkIn: s.checkIn,
      checkOut: s.checkOut,
      hours: hoursOf(shiftMinutes(s.checkIn, s.checkOut)),
      code: s.receipt ? receiptCode(s.receipt) : null,
    })),
  };
}
