/**
 * Shift receipts: proof of hours the worker keeps.
 *
 * When a shift closes, the server seals what it recorded (who, where, check-in, check-out) into a
 * receipt signed with a server key. The receipt is stored with the shift and shown to the worker
 * as a short code and a link. Anyone with the link can check it later: the signature shows
 * FairShift issued it, and comparing it with the record as it stands shows whether the times were
 * changed after check-out. Nobody can make a valid receipt for different times without the key.
 *
 * A period receipt does the same for a whole month: it seals how many shifts and minutes a letter
 * or payslip counted, so a later check shows if shifts were added, removed or changed. Pure.
 *
 * Token: `<payload as base64url JSON>.<HMAC-SHA256 over it, first 128 bits as hex>`.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { shiftMinutes } from './overtime';
import type { Shift } from '../../shared/types';

export interface ShiftFacts {
  kind: 'shift';
  shiftId: string;
  workerId: string;
  siteId: string;
  checkIn: string;
  checkOut: string;
}

export interface PeriodFacts {
  kind: 'period';
  workerId: string;
  /** IST days, `YYYY-MM-DD`, inclusive. */
  from: string;
  to: string;
  /** Closed shifts counted, and their total minutes, rounded. */
  shifts: number;
  minutes: number;
}

export type ReceiptFacts = ShiftFacts | PeriodFacts;

const SIG_HEX = 32;

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`fairshift-receipt:v1.${payload}`)
    .digest('hex')
    .slice(0, SIG_HEX);
}

export function signReceipt(facts: ReceiptFacts, secret: string): string {
  const payload = Buffer.from(JSON.stringify(facts)).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

const isText = (v: unknown, max = 100): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function parseFacts(raw: unknown): ReceiptFacts | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const f = raw as Record<string, unknown>;
  if (
    f.kind === 'shift' &&
    isText(f.shiftId) &&
    isText(f.workerId) &&
    isText(f.siteId) &&
    isText(f.checkIn, 40) &&
    isText(f.checkOut, 40)
  ) {
    const { shiftId, workerId, siteId, checkIn, checkOut } = f;
    return { kind: 'shift', shiftId, workerId, siteId, checkIn, checkOut };
  }
  if (
    f.kind === 'period' &&
    isText(f.workerId) &&
    isText(f.from, 10) &&
    DAY.test(f.from) &&
    isText(f.to, 10) &&
    DAY.test(f.to) &&
    isCount(f.shifts) &&
    isCount(f.minutes)
  ) {
    const { workerId, from, to, shifts, minutes } = f;
    return { kind: 'period', workerId, from, to, shifts, minutes };
  }
  return null;
}

/** The facts in a receipt, or null when it was not signed with this key or is malformed. */
export function openReceipt(token: string, secret: string): ReceiptFacts | null {
  if (token.length > 2000) return null;
  const [payload, sig, ...rest] = token.split('.');
  if (!payload || !sig || rest.length > 0 || sig.length !== SIG_HEX) return null;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    return parseFacts(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')));
  } catch {
    return null;
  }
}

/** A short code to read out or write down, e.g. `4F2A-91C0`. It names a receipt; it is not one. */
export function receiptCode(token: string): string {
  const sig = token.slice(token.lastIndexOf('.') + 1, token.lastIndexOf('.') + 9).toUpperCase();
  return `${sig.slice(0, 4)}-${sig.slice(4)}`;
}

export function shiftFacts(shift: Shift & { checkOut: string }): ShiftFacts {
  return {
    kind: 'shift',
    shiftId: shift.id,
    workerId: shift.workerId,
    siteId: shift.siteId,
    checkIn: shift.checkIn,
    checkOut: shift.checkOut,
  };
}

/** A closed shift with its receipt; an open shift is returned as it is. */
export function sealShift(shift: Shift, secret: string): Shift {
  if (shift.checkOut === null) return shift;
  return {
    ...shift,
    receipt: signReceipt(shiftFacts({ ...shift, checkOut: shift.checkOut }), secret),
  };
}

const sameTime = (a: string, b: string | null) => b !== null && Date.parse(a) === Date.parse(b);

export type ShiftCheck =
  | { status: 'unchanged' }
  | { status: 'changed'; fields: ('worker' | 'site' | 'checkIn' | 'checkOut')[] }
  | { status: 'missing' };

/** Compares a shift receipt with the record as it stands now. */
export function checkShift(facts: ShiftFacts, now: Shift | null): ShiftCheck {
  if (!now) return { status: 'missing' };
  const fields: ('worker' | 'site' | 'checkIn' | 'checkOut')[] = [];
  if (now.workerId !== facts.workerId) fields.push('worker');
  if (now.siteId !== facts.siteId) fields.push('site');
  if (!sameTime(facts.checkIn, now.checkIn)) fields.push('checkIn');
  if (!sameTime(facts.checkOut, now.checkOut)) fields.push('checkOut');
  return fields.length === 0 ? { status: 'unchanged' } : { status: 'changed', fields };
}

/** How a stored shift compares with its own receipt. */
export type SealState = 'sealed' | 'changed' | 'unsealed';

export function sealState(shift: Shift, secret: string): SealState {
  const facts = shift.receipt ? openReceipt(shift.receipt, secret) : null;
  if (!facts || facts.kind !== 'shift' || facts.shiftId !== shift.id) return 'unsealed';
  return checkShift(facts, shift).status === 'unchanged' ? 'sealed' : 'changed';
}

/** Closed shifts and their total minutes, rounded, as a period receipt counts them. */
export function periodTotals(shifts: Shift[]): { shifts: number; minutes: number } {
  const closed = shifts.filter((s) => s.checkOut !== null);
  const minutes = closed.reduce((sum, s) => sum + shiftMinutes(s.checkIn, s.checkOut), 0);
  return { shifts: closed.length, minutes: Math.round(minutes) };
}

export interface PeriodCheck {
  /** Counts sealed in the receipt, and counted now. */
  then: { shifts: number; minutes: number };
  now: { shifts: number; minutes: number };
  /** Shifts whose own receipt no longer matches, or that have none. */
  changed: Shift[];
  unsealed: Shift[];
  /** True when the counts match and every shift still matches its own receipt. */
  intact: boolean;
}

/** Compares a period receipt with the worker's closed shifts in that period as they stand now. */
export function checkPeriod(facts: PeriodFacts, shiftsNow: Shift[], secret: string): PeriodCheck {
  const closed = shiftsNow.filter((s) => s.checkOut !== null);
  const now = periodTotals(closed);
  const changed = closed.filter((s) => sealState(s, secret) === 'changed');
  const unsealed = closed.filter((s) => sealState(s, secret) === 'unsealed');
  const then = { shifts: facts.shifts, minutes: facts.minutes };
  return {
    then,
    now,
    changed,
    unsealed,
    intact:
      changed.length === 0 &&
      unsealed.length === 0 &&
      then.shifts === now.shifts &&
      then.minutes === now.minutes,
  };
}
