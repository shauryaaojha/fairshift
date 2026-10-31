import { describe, expect, it } from 'vitest';
import {
  checkPeriod,
  checkShift,
  openReceipt,
  periodTotals,
  receiptCode,
  sealShift,
  sealState,
  signReceipt,
  type PeriodFacts,
} from '@/src/server/domain/shiftReceipt';
import type { Shift } from '@/src/shared/types';

const SECRET = 'test-receipt-secret';

const shift = (id: string, day: string, out: string | null = '17:30'): Shift => ({
  id,
  workerId: 'w1',
  siteId: 'site-1',
  orgId: 'org-1',
  checkIn: `${day}T09:00:00.000+05:30`,
  checkOut: out === null ? null : `${day}T${out}:00.000+05:30`,
  method: 'qr',
});

describe('shift receipts', () => {
  const sealed = sealShift(shift('s1', '2026-10-05'), SECRET);

  it('seals a closed shift and opens back to the same facts', () => {
    expect(sealed.receipt).toMatch(/^[\w-]+\.[0-9a-f]{32}$/);
    expect(openReceipt(sealed.receipt!, SECRET)).toEqual({
      kind: 'shift',
      shiftId: 's1',
      workerId: 'w1',
      siteId: 'site-1',
      checkIn: sealed.checkIn,
      checkOut: sealed.checkOut,
    });
  });

  it('leaves an open shift without a receipt', () => {
    expect(sealShift(shift('s2', '2026-10-05', null), SECRET).receipt).toBeUndefined();
  });

  it('refuses a receipt with edited times, another key, or a bad shape', () => {
    const [payload, sig] = sealed.receipt!.split('.');
    const facts = JSON.parse(Buffer.from(payload, 'base64url').toString());
    const later = Buffer.from(
      JSON.stringify({ ...facts, checkOut: '2026-10-05T21:30:00.000+05:30' }),
    ).toString('base64url');

    expect(openReceipt(`${later}.${sig}`, SECRET)).toBeNull();
    expect(openReceipt(sealed.receipt!, 'another-key')).toBeNull();
    expect(openReceipt(payload, SECRET)).toBeNull();
    expect(openReceipt(`${sealed.receipt}.x`, SECRET)).toBeNull();
    expect(openReceipt(`${payload}.${sig.slice(0, 31)}`, SECRET)).toBeNull();
    expect(openReceipt('x'.repeat(3000), SECRET)).toBeNull();
    // Signed, but not a receipt shape.
    expect(openReceipt(signReceipt({ kind: 'nope' } as never, SECRET), SECRET)).toBeNull();
  });

  it('gives a short code from the signature', () => {
    expect(receiptCode(sealed.receipt!)).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('shows whether the record still matches', () => {
    const facts = openReceipt(sealed.receipt!, SECRET);
    if (facts?.kind !== 'shift') throw new Error('expected a shift receipt');
    expect(checkShift(facts, sealed)).toEqual({ status: 'unchanged' });
    // The same instant written another way is not a change.
    expect(checkShift(facts, { ...sealed, checkOut: '2026-10-05T12:00:00.000Z' })).toEqual({
      status: 'unchanged',
    });
    expect(
      checkShift(facts, { ...sealed, checkOut: '2026-10-05T15:00:00.000Z', siteId: 'site-2' }),
    ).toEqual({ status: 'changed', fields: ['site', 'checkOut'] });
    expect(checkShift(facts, null)).toEqual({ status: 'missing' });
  });

  it('tells a sealed record from a changed or unsealed one', () => {
    expect(sealState(sealed, SECRET)).toBe('sealed');
    expect(sealState({ ...sealed, checkIn: '2026-10-05T02:00:00.000Z' }, SECRET)).toBe('changed');
    expect(sealState(shift('s3', '2026-10-06'), SECRET)).toBe('unsealed');
    // A receipt copied from another shift does not count.
    expect(sealState({ ...shift('s4', '2026-10-05'), receipt: sealed.receipt }, SECRET)).toBe(
      'unsealed',
    );
  });
});

describe('period receipts', () => {
  const month = [
    sealShift(shift('a', '2026-10-05'), SECRET),
    sealShift(shift('b', '2026-10-06', '18:00'), SECRET),
    shift('open', '2026-10-07', null),
  ];
  const facts: PeriodFacts = {
    kind: 'period',
    workerId: 'w1',
    from: '2026-10-01',
    to: '2026-10-31',
    ...periodTotals(month),
  };

  it('counts closed shifts and their minutes', () => {
    expect(periodTotals(month)).toEqual({ shifts: 2, minutes: 510 + 540 });
  });

  it('round-trips through a signed token', () => {
    expect(openReceipt(signReceipt(facts, SECRET), SECRET)).toEqual(facts);
  });

  it('is intact while nothing changed', () => {
    expect(checkPeriod(facts, month, SECRET)).toMatchObject({ intact: true, changed: [] });
  });

  it('catches a changed shift, a removed shift and an added shift', () => {
    const edited = [{ ...month[0], checkOut: '2026-10-05T10:00:00.000Z' }, month[1]];
    expect(checkPeriod(facts, edited, SECRET)).toMatchObject({
      intact: false,
      changed: [edited[0]],
    });

    expect(checkPeriod(facts, [month[0]], SECRET)).toMatchObject({
      intact: false,
      now: { shifts: 1 },
    });

    const added = [...month, shift('new', '2026-10-08')];
    const result = checkPeriod(facts, added, SECRET);
    expect(result.intact).toBe(false);
    expect(result.unsealed.map((s) => s.id)).toEqual(['new']);
  });
});
