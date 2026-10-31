import { describe, expect, it } from 'vitest';
import {
  ANSWER_HOURS,
  REOPENED_ANSWER_HOURS,
  answerPayQuery,
  applyPayVerdict,
  canAnswer,
  canGivePayVerdict,
  openPayQuery,
  payGap,
  payQueryState,
  sortPayQueries,
  wagesDueBy,
} from '@/src/server/domain/payQuery';
import { HOUR_MS } from '@/src/server/domain/time';
import type { PayQuery } from '@/src/shared/types';

const RAISED = new Date('2026-10-20T06:00:00.000Z');
const hoursAfter = (h: number) => new Date(RAISED.getTime() + h * HOUR_MS);

function fresh(over: Partial<PayQuery> = {}): PayQuery {
  return {
    ...openPayQuery(
      {
        id: 'payq-t',
        orgId: 'org-construction',
        siteId: 'site-skyline-chennai',
        workerId: 'worker-a',
        reason: 'short_pay',
        period: '2026-10',
        payslipNet: 18000,
        receivedAmount: 16500,
        note: null,
      },
      RAISED,
    ),
    ...over,
  };
}

const answer = { text: 'Paid the balance today.', correctedNet: null, by: 'Supervisor', at: '' };

describe('pay query lifecycle', () => {
  it('opens with a 48 hour answer deadline and nothing answered', () => {
    const q = fresh();
    expect(Date.parse(q.answerDueAt) - RAISED.getTime()).toBe(ANSWER_HOURS * HOUR_MS);
    expect(q).toMatchObject({ answers: [], workerVerdict: null, verdictAt: null, reopenCount: 0 });
    expect(payQueryState(q, hoursAfter(1))).toBe('open');
    expect(canAnswer(q, hoursAfter(1))).toBe(true);
  });

  it('turns overdue once the deadline passes, and can still be answered', () => {
    const q = fresh();
    expect(payQueryState(q, hoursAfter(ANSWER_HOURS + 1))).toBe('overdue');
    expect(canAnswer(q, hoursAfter(ANSWER_HOURS + 1))).toBe(true);
  });

  it('waits for the worker after an answer; only that worker may reply', () => {
    const q = answerPayQuery(fresh(), answer);
    expect(payQueryState(q)).toBe('awaiting_worker');
    expect(canAnswer(q)).toBe(false);
    expect(canGivePayVerdict(q, 'worker-a')).toBe(true);
    expect(canGivePayVerdict(q, 'worker-b')).toBe(false);
    expect(canGivePayVerdict(fresh(), 'worker-a')).toBe(false);
  });

  it('closes only when the worker says it is settled', () => {
    const q = applyPayVerdict(answerPayQuery(fresh(), answer), 'settled', hoursAfter(5));
    expect(payQueryState(q)).toBe('settled');
    expect(q.verdictAt).toBe(hoursAfter(5).toISOString());
    expect(canAnswer(q)).toBe(false);
    expect(canGivePayVerdict(q, 'worker-a')).toBe(false);
  });

  it('reopens on "not settled" with a one-day deadline, then can be answered again', () => {
    const reopened = applyPayVerdict(answerPayQuery(fresh(), answer), 'not_settled', hoursAfter(5));
    expect(reopened.reopenCount).toBe(1);
    expect(Date.parse(reopened.answerDueAt)).toBe(
      hoursAfter(5).getTime() + REOPENED_ANSWER_HOURS * HOUR_MS,
    );
    expect(payQueryState(reopened, hoursAfter(6))).toBe('open');
    expect(payQueryState(reopened, hoursAfter(5 + REOPENED_ANSWER_HOURS + 1))).toBe('overdue');

    const second = answerPayQuery(reopened, { ...answer, correctedNet: 18000 });
    expect(second.answers).toHaveLength(2);
    expect(second.workerVerdict).toBeNull();
    expect(payQueryState(second)).toBe('awaiting_worker');
  });
});

describe('pay query figures', () => {
  it('measures the gap from the worker’s own count', () => {
    expect(payGap(fresh())).toBe(1500);
    expect(payGap(fresh({ receivedAmount: null }))).toBeNull();
    expect(payGap(fresh({ receivedAmount: 18200 }))).toBe(-200);
  });

  it('puts the legal pay day on the 7th of the next month, across the year end', () => {
    expect(wagesDueBy('2026-10')).toBe('2026-11-07');
    expect(wagesDueBy('2026-12')).toBe('2027-01-07');
  });

  it('sorts the console queue: overdue, open, waiting on the worker, settled', () => {
    const now = hoursAfter(ANSWER_HOURS + 2);
    const overdue = fresh({ id: 'overdue' });
    const open = fresh({ id: 'open', answerDueAt: hoursAfter(ANSWER_HOURS + 10).toISOString() });
    const waiting = answerPayQuery(fresh({ id: 'waiting' }), answer);
    const settled = applyPayVerdict(answerPayQuery(fresh({ id: 'settled' }), answer), 'settled');
    expect(sortPayQueries([settled, waiting, open, overdue], now).map((q) => q.id)).toEqual([
      'overdue',
      'open',
      'waiting',
      'settled',
    ]);
  });
});
