/**
 * Reading receipts back: the public /verify page for a shift or period receipt, and the period
 * receipt a labour-office letter carries. The page shows the facts in the receipt and how the
 * record stands now; it shows a first name, never pay or phone.
 */

import { getDatabase } from '../repos';
import { receiptSecret } from '../auth/receiptKey';
import { shiftsInPeriod } from '../domain/registers';
import {
  checkPeriod,
  checkShift,
  openReceipt,
  periodTotals,
  receiptCode,
  signReceipt,
  type PeriodCheck,
  type PeriodFacts,
  type ShiftCheck,
  type ShiftFacts,
} from '../domain/shiftReceipt';
import type { Shift } from '../../shared/types';

export type ReceiptView =
  | {
      kind: 'shift';
      code: string;
      facts: ShiftFacts;
      holder: string;
      site: string;
      check: ShiftCheck;
      /** The record as it stands, when it differs from the receipt. */
      now: Pick<Shift, 'checkIn' | 'checkOut'> | null;
    }
  | {
      kind: 'period';
      code: string;
      facts: PeriodFacts;
      holder: string;
      check: PeriodCheck;
    };

const firstName = (name: string | undefined) => name?.split(' ')[0] ?? 'Worker';

/** What a receipt says and whether the record still matches it; null for a forged or bad link. */
export async function verifyReceipt(token: string): Promise<ReceiptView | null> {
  const secret = receiptSecret();
  const facts = openReceipt(token, secret);
  if (!facts) return null;
  const db = getDatabase();
  const worker = await db.workers.getById(facts.workerId);
  const code = receiptCode(token);

  if (facts.kind === 'shift') {
    const [shift, site] = await Promise.all([
      db.shifts.getById(facts.shiftId),
      db.sites.get(facts.siteId),
    ]);
    const check = checkShift(facts, shift);
    return {
      kind: 'shift',
      code,
      facts,
      holder: firstName(worker?.name),
      site: site?.name ?? 'Unknown site',
      check,
      now:
        check.status === 'changed' && shift
          ? { checkIn: shift.checkIn, checkOut: shift.checkOut }
          : null,
    };
  }

  const shifts = shiftsInPeriod(await db.shifts.listByWorker(facts.workerId), {
    start: facts.from,
    end: facts.to,
  });
  return {
    kind: 'period',
    code,
    facts,
    holder: firstName(worker?.name),
    check: checkPeriod(facts, shifts, secret),
  };
}

/** A period receipt over a worker's closed shifts between two IST days, as they stand now. */
export function signPeriod(workerId: string, from: string, to: string, shifts: Shift[]): string {
  return signReceipt(
    {
      kind: 'period',
      workerId,
      from,
      to,
      ...periodTotals(shiftsInPeriod(shifts, { start: from, end: to })),
    },
    receiptSecret(),
  );
}
