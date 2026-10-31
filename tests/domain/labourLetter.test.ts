import { describe, expect, it } from 'vitest';
import { buildLabourLetter, canWriteLetter, letterPeriod } from '@/src/server/domain/labourLetter';
import { sealShift } from '@/src/server/domain/shiftReceipt';
import type { PayQuery, Shift } from '@/src/shared/types';

const now = new Date('2026-10-20T06:00:00Z');

const query = (over: Partial<PayQuery> = {}): PayQuery => ({
  id: 'q1',
  orgId: 'o',
  siteId: 's',
  workerId: 'w',
  reason: 'short_pay',
  period: '2026-09',
  payslipNet: 12000.5,
  receivedAmount: 10000,
  note: null,
  raisedAt: '2026-10-10T06:00:00Z',
  answerDueAt: '2026-10-12T06:00:00Z',
  answers: [],
  workerVerdict: null,
  verdictAt: null,
  reopenCount: 0,
  ...over,
});

const answer = {
  by: 'Site lead',
  at: '2026-10-11T06:00:00Z',
  text: 'We will check.',
  correctedNet: null,
};

describe('canWriteLetter', () => {
  it('waits while the employer still has time to answer', () => {
    expect(canWriteLetter(query({ answerDueAt: '2026-10-21T06:00:00Z' }), now)).toBe(false);
  });

  it('opens once the deadline passes with no answer', () => {
    expect(canWriteLetter(query(), now)).toBe(true);
  });

  it('opens after the worker said an answer did not settle it, even before the new deadline', () => {
    const reopened = query({
      answers: [answer],
      workerVerdict: 'not_settled',
      reopenCount: 1,
      answerDueAt: '2026-10-21T06:00:00Z',
    });
    expect(canWriteLetter(reopened, now)).toBe(true);
  });

  it('stays closed while an answer waits for the worker, and once settled', () => {
    expect(canWriteLetter(query({ answers: [answer] }), now)).toBe(false);
    expect(canWriteLetter(query({ answers: [answer], workerVerdict: 'settled' }), now)).toBe(false);
  });
});

describe('letterPeriod', () => {
  it('is the whole month for a past month', () => {
    expect(letterPeriod(query())).toEqual({ start: '2026-09-01', end: '2026-09-30' });
  });

  it('stops at the day raised for the current month (IST)', () => {
    expect(letterPeriod(query({ period: '2026-10', raisedAt: '2026-10-09T20:00:00Z' }))).toEqual({
      start: '2026-10-01',
      end: '2026-10-10',
    });
  });
});

describe('buildLabourLetter', () => {
  const shift = (day: string, out: string | null): Shift => ({
    id: day,
    workerId: 'w',
    siteId: 's',
    orgId: 'o',
    checkIn: `${day}T08:00:00+05:30`,
    checkOut: out && `${day}T${out}:00+05:30`,
    method: 'qr',
  });
  const shifts = [
    sealShift(shift('2026-09-02', '18:30'), 'k'),
    shift('2026-09-01', '16:00'),
    shift('2026-09-03', null),
  ];

  it('states days, hours, the gap and each shift with its receipt code, oldest first', () => {
    const letter = buildLabourLetter(query(), shifts, 2.5);
    expect(letter).toMatchObject({ days: 2, hours: 18.5, gap: 2000.5, wagesDueBy: '2026-10-07' });
    expect(letter.shifts.map((s) => s.hours)).toEqual([8, 10.5]);
    expect(letter.shifts[0].code).toBeNull();
    expect(letter.shifts[1].code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('cites overtime only when there was overtime or the query is about it', () => {
    expect(buildLabourLetter(query(), shifts, 0).laws).toEqual(['s17', 's45']);
    expect(buildLabourLetter(query(), shifts, 2.5).laws).toEqual(['s17', 's14', 's45']);
    expect(buildLabourLetter(query({ reason: 'unpaid_overtime' }), shifts, 0).laws).toContain(
      's14',
    );
  });

  it('quotes the employer’s latest answer', () => {
    const later = { ...answer, at: '2026-10-15T06:00:00Z', text: 'Paid in full.' };
    expect(buildLabourLetter(query({ answers: [answer, later] }), shifts, 0).lastAnswer).toEqual(
      later,
    );
    expect(buildLabourLetter(query(), shifts, 0).lastAnswer).toBeNull();
  });
});
