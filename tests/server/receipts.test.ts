import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { workerService } from '@/src/server/services/workerService';
import { verifyReceipt } from '@/src/server/services/receipts';
import { loadLabourLetter } from '@/src/server/services/workerViews';
import { getDatabase } from '@/src/server/repos';
import { generateSiteQrCode } from '@/src/server/domain/qrCode';
import { openPayQuery } from '@/src/server/domain/payQuery';
import { sealShift, sealState } from '@/src/server/domain/shiftReceipt';
import { receiptSecret } from '@/src/server/auth/receiptKey';
import type { Worker } from '@/src/shared/types';

const db = getDatabase();
let worker: Worker;

/** A copy of Ramesh with his own copies of Ramesh's shifts, each sealed as at its check-out. */
beforeEach(async () => {
  const ramesh = (await db.workers.getById('worker-ramesh'))!;
  worker = {
    ...ramesh,
    id: `worker-rcpt-${Math.random().toString(36).slice(2, 8)}`,
    phone: `9${Math.floor(Math.random() * 1e9)}`,
    name: 'Test Worker',
  };
  await db.workers.save(worker);
  for (const s of await db.shifts.listByWorker('worker-ramesh')) {
    if (s.checkOut === null) continue;
    const { receipt: _theirs, ...copy } = s;
    await db.shifts.create(
      sealShift({ ...copy, id: `${s.id}-${worker.id}`, workerId: worker.id }, receiptSecret()),
    );
  }
});

async function checkInAndOut() {
  const site = (await db.sites.get(worker.siteId))!;
  await workerService.checkIn(worker.id, {
    siteId: site.id,
    code: generateSiteQrCode(site.qrSecret).code,
  });
  return workerService.checkOut(worker.id);
}

describe('shift receipts', () => {
  it('every closed demo shift is sealed', async () => {
    const shifts = await db.shifts.listByWorker('worker-ramesh');
    const closed = shifts.filter((s) => s.checkOut !== null);
    expect(closed.length).toBeGreaterThan(5);
    for (const s of closed) expect(sealState(s, receiptSecret())).toBe('sealed');
  });

  it('check-out seals the shift, and the receipt checks out as unchanged', async () => {
    const shift = await checkInAndOut();
    expect(shift.receipt).toBeDefined();
    const view = await verifyReceipt(shift.receipt!);
    expect(view).toMatchObject({
      kind: 'shift',
      holder: 'Test',
      check: { status: 'unchanged' },
      now: null,
    });
  });

  it('shows a change made to the record after check-out, and the record as it stands', async () => {
    const shift = await checkInAndOut();
    const later = new Date(Date.parse(shift.checkOut!) + 3 * 3_600_000).toISOString();
    await db.shifts.update({ ...shift, checkOut: later });

    const view = await verifyReceipt(shift.receipt!);
    expect(view).toMatchObject({
      check: { status: 'changed', fields: ['checkOut'] },
      now: { checkOut: later },
    });
  });

  it('refuses a forged or garbled receipt', async () => {
    const shift = await checkInAndOut();
    const [payload] = shift.receipt!.split('.');
    expect(await verifyReceipt(`${payload}.${'0'.repeat(32)}`)).toBeNull();
    expect(await verifyReceipt('not-a-receipt')).toBeNull();
  });
});

describe('letter to the labour office', () => {
  const HOUR = 3_600_000;
  // A fixed month of work, so the letter's facts do not depend on today's date.
  const AUGUST = ['03', '04', '05', '06', '07', '10', '11'].map((d) => `2026-08-${d}`);

  beforeEach(async () => {
    for (const day of AUGUST) {
      await db.shifts.create(
        sealShift(
          {
            id: `aug-${day}-${worker.id}`,
            workerId: worker.id,
            siteId: worker.siteId,
            orgId: worker.orgId,
            checkIn: `${day}T08:00:00.000+05:30`,
            checkOut: `${day}T17:30:00.000+05:30`,
            method: 'qr',
          },
          receiptSecret(),
        ),
      );
    }
  });

  /** An August pay query raised some hours ago; the employer has 48 hours to answer. */
  async function query(raisedHoursAgo: number) {
    const q = openPayQuery(
      {
        id: `payq-rcpt-${Math.random().toString(36).slice(2, 8)}`,
        orgId: worker.orgId,
        siteId: worker.siteId,
        workerId: worker.id,
        reason: 'short_pay',
        period: '2026-08',
        payslipNet: 9000,
        receivedAmount: 7500,
        note: null,
      },
      new Date(Date.now() - raisedHoursAgo * HOUR),
    );
    return db.payQueries.create(q);
  }

  it('is not ready while the employer still has time to answer', async () => {
    const q = await query(1);
    expect(await loadLabourLetter(worker, q.id, 'https://fs.test')).toBe('not_ready');
  });

  it('is only for the worker who raised the query', async () => {
    const q = await query(72);
    const other = (await db.workers.getById('worker-ramesh'))!;
    expect(await loadLabourLetter(other, q.id, 'https://fs.test')).toBeNull();
  });

  it('carries the facts and a QR whose period receipt checks out', async () => {
    const q = await query(72);
    const view = await loadLabourLetter(worker, q.id, 'https://fs.test');
    if (view === null || view === 'not_ready') throw new Error('expected a letter');

    expect(view.letter).toMatchObject({ gap: 1500, payslipNet: 9000, lastAnswer: null });
    expect(view.letter).toMatchObject({ days: 7, hours: 66.5 });
    expect(view.letter.shifts.every((s) => s.code !== null)).toBe(true);
    expect(view.qrSvg).toMatch(/^<svg/);
    expect(view.verifyUrl).toMatch(/^https:\/\/fs\.test\/verify\//);

    const token = view.verifyUrl.slice('https://fs.test/verify/'.length);
    const check = await verifyReceipt(token);
    expect(check).toMatchObject({
      kind: 'period',
      check: { intact: true, then: { shifts: view.letter.shifts.length } },
    });

    // A shift removed after the letter was printed shows up when the QR is scanned.
    const shifts = await db.shifts.listByWorker(worker.id);
    const counted = shifts.find((s) => view.letter.shifts.some((l) => l.checkIn === s.checkIn))!;
    await db.shifts.update({ ...counted, workerId: 'someone-else' });
    expect(await verifyReceipt(token)).toMatchObject({ check: { intact: false } });
  });
});
