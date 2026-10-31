/**
 * Pay queries, closed with two keys like hazard reports. The employer answers (first key); the
 * worker says whether the money is now right (second key). "Not settled" reopens the query with a
 * shorter deadline, so an answer that only exists on paper cannot close it. Pure.
 */

import { HOUR_MS } from './time';
import { toPaise, toRupees } from '../../shared/money';
import type { PayQuery, PayQueryAnswer, PayQueryVerdict } from '../../shared/types';

/** The employer answers a new query within 2 days, a reopened one within 1. */
export const ANSWER_HOURS = 48;
export const REOPENED_ANSWER_HOURS = 24;

export const NOTE_MAX = 500;
export const ANSWER_MIN = 10;
export const ANSWER_MAX = 1000;

export type PayQueryState = 'open' | 'overdue' | 'awaiting_worker' | 'settled';

type StateFields = Pick<PayQuery, 'answers' | 'workerVerdict' | 'answerDueAt'>;

export function payQueryState(q: StateFields, now: Date = new Date()): PayQueryState {
  if (q.workerVerdict === 'settled') return 'settled';
  if (q.answers.length > 0 && q.workerVerdict === null) return 'awaiting_worker';
  return now.getTime() > Date.parse(q.answerDueAt) ? 'overdue' : 'open';
}

/** The employer may answer while the query waits for them. */
export function canAnswer(q: StateFields, now: Date = new Date()): boolean {
  const state = payQueryState(q, now);
  return state === 'open' || state === 'overdue';
}

/** Only the worker who raised it, and only while an answer waits for their reply. */
export function canGivePayVerdict(
  q: StateFields & Pick<PayQuery, 'workerId'>,
  workerId: string,
): boolean {
  return q.workerId === workerId && payQueryState(q) === 'awaiting_worker';
}

/** Rupees short by the worker's own count (positive means they got less), exact to the paisa, or null. */
export function payGap(q: Pick<PayQuery, 'payslipNet' | 'receivedAmount'>): number | null {
  return q.receivedAmount === null
    ? null
    : toRupees(toPaise(q.payslipNet) - toPaise(q.receivedAmount));
}

/**
 * The last day wages for a month may be paid: before the 7th of the next month (Code on Wages
 * 2019, s. 17(1)), returned as `YYYY-MM-07`.
 */
export function wagesDueBy(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  return `${next.y}-${String(next.m).padStart(2, '0')}-07`;
}

export type NewPayQuery = Omit<
  PayQuery,
  'raisedAt' | 'answerDueAt' | 'answers' | 'workerVerdict' | 'verdictAt' | 'reopenCount'
>;

export function openPayQuery(fields: NewPayQuery, now: Date = new Date()): PayQuery {
  return {
    ...fields,
    raisedAt: now.toISOString(),
    answerDueAt: new Date(now.getTime() + ANSWER_HOURS * HOUR_MS).toISOString(),
    answers: [],
    workerVerdict: null,
    verdictAt: null,
    reopenCount: 0,
  };
}

/** The employer's answer; the worker is asked again. */
export function answerPayQuery(q: PayQuery, answer: PayQueryAnswer): PayQuery {
  return { ...q, answers: [...q.answers, answer], workerVerdict: null, verdictAt: null };
}

export function applyPayVerdict(
  q: PayQuery,
  verdict: PayQueryVerdict,
  now: Date = new Date(),
): PayQuery {
  const at = now.toISOString();
  if (verdict === 'settled') return { ...q, workerVerdict: 'settled', verdictAt: at };
  return {
    ...q,
    workerVerdict: 'not_settled',
    verdictAt: at,
    reopenCount: q.reopenCount + 1,
    answerDueAt: new Date(now.getTime() + REOPENED_ANSWER_HOURS * HOUR_MS).toISOString(),
  };
}

/** Admin queue order: overdue first, then open, then waiting on the worker, then settled. */
const STATE_ORDER: Record<PayQueryState, number> = {
  overdue: 0,
  open: 1,
  awaiting_worker: 2,
  settled: 3,
};

export function sortPayQueries<T extends PayQuery>(queries: T[], now: Date = new Date()): T[] {
  return [...queries].sort(
    (a, b) =>
      STATE_ORDER[payQueryState(a, now)] - STATE_ORDER[payQueryState(b, now)] ||
      Date.parse(a.answerDueAt) - Date.parse(b.answerDueAt),
  );
}
