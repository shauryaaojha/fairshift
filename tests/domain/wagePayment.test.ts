import { describe, expect, it } from 'vitest';
import {
  payablePeriods,
  payslipForMonth,
  previousPeriod,
  upiPayUri,
  UTR_PATTERN,
  wagePaymentId,
  wageState,
} from '@/src/server/domain/wagePayment';
import type { Shift, WagePayment } from '@/src/shared/types';

const payment = { id: 'x' } as WagePayment;

describe('upiPayUri', () => {
  it('fills payee, amount in rupees and paise, currency and note, URL-encoded', () => {
    expect(
      upiPayUri({
        vpa: 'ramesh.kumar@okaxis',
        payeeName: 'Ramesh Kumar',
        amount: 18450.5,
        note: 'FairShift wages Oct 2026',
      }),
    ).toBe(
      'upi://pay?pa=ramesh.kumar%40okaxis&pn=Ramesh%20Kumar&am=18450.50&cu=INR&tn=FairShift%20wages%20Oct%202026',
    );
  });

  it.each([
    ['no handle', 'ramesh', 100],
    ['spaces', 'ram esh@okaxis', 100],
    ['an injected parameter', 'a@okaxis&am=1', 100],
    ['zero amount', 'ramesh@okaxis', 0],
    ['negative amount', 'ramesh@okaxis', -5],
    ['not a number', 'ramesh@okaxis', Number.NaN],
  ])('refuses %s', (_label, vpa, amount) => {
    expect(upiPayUri({ vpa, payeeName: 'R', amount, note: 'n' })).toBeNull();
  });
});

describe('UTR_PATTERN', () => {
  it.each([
    ['412345678901', true],
    ['41234567890', false],
    ['4123456789012', false],
    ['41234567890a', false],
  ])('%s -> %s', (utr, ok) => {
    expect(UTR_PATTERN.test(utr)).toBe(ok);
  });
});

describe('periods', () => {
  it('last month and this month are payable, across a year end', () => {
    expect(payablePeriods(new Date('2026-01-15T06:00:00Z'))).toEqual(['2025-12', '2026-01']);
    expect(previousPeriod('2026-10')).toBe('2026-09');
  });

  it('uses the IST month: 31 Oct 20:00 UTC is already November in India', () => {
    expect(payablePeriods(new Date('2026-10-31T20:00:00Z'))).toEqual(['2026-10', '2026-11']);
  });

  it('one payment id per worker and month', () => {
    expect(wagePaymentId('worker-ramesh', '2026-10')).toBe('wage_worker-ramesh_2026-10');
  });
});

describe('wageState', () => {
  it('is due until the end of the 7th (IST) of the next month, then overdue', () => {
    expect(wageState('2026-10', null, new Date('2026-11-07T18:00:00Z'))).toBe('due');
    expect(wageState('2026-10', null, new Date('2026-11-07T18:31:00Z'))).toBe('overdue');
  });

  it('is paid once a payment is recorded, even late', () => {
    expect(wageState('2026-10', payment, new Date('2026-12-01T00:00:00Z'))).toBe('paid');
  });
});

describe('payslipForMonth', () => {
  const worker = { id: 'w1', basePay: 800, allowances: 0, payType: 'daily' as const };
  const shift = (id: string, workerId: string, day: string): Shift =>
    ({
      id,
      workerId,
      checkIn: `${day}T03:00:00.000Z`,
      checkOut: `${day}T11:00:00.000Z`,
    }) as Shift;
  const shifts = [
    shift('a', 'w1', '2026-10-05'),
    shift('b', 'w1', '2026-10-06'),
    shift('c', 'w2', '2026-10-06'),
    shift('d', 'w1', '2026-09-30'),
  ];
  const now = new Date('2026-11-02T06:00:00Z');

  it('counts only the worker’s own days in that month', () => {
    const slip = payslipForMonth(worker, shifts, '2026-10', now, () => undefined)!;
    expect(slip.periodStart).toBe('2026-10-01');
    expect(slip.periodEnd).toBe('2026-10-31');
    expect(slip.gross).toBe(1600);
  });

  it('stops at today in the current month, and has nothing for a future month', () => {
    const withNov = [...shifts, shift('e', 'w1', '2026-11-01')];
    expect(payslipForMonth(worker, withNov, '2026-11', now, () => undefined)!.periodEnd).toBe(
      '2026-11-02',
    );
    expect(payslipForMonth(worker, shifts, '2026-12', now, () => undefined)).toBeNull();
  });

  it('has nothing for a month with no attendance, so allowances alone are never "owed"', () => {
    const monthly = { ...worker, payType: 'monthly' as const, allowances: 200 };
    expect(payslipForMonth(monthly, shifts, '2026-08', now, () => undefined)).toBeNull();
  });
});
