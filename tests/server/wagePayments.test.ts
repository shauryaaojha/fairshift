import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { SECTORS } from '@/src/server/services/sectors';
import type { AdminContext } from '@/app/admin/_lib/context';

const ctx: AdminContext = {
  userId: 'admin-skyline',
  orgId: SECTORS.construction.orgId,
  sector: SECTORS.construction,
  allowedSectors: ['construction'],
};
vi.mock('@/app/admin/_lib/context', () => ({ getAdminContext: vi.fn(async () => ctx) }));

import { recordWagePaymentAction } from '@/app/admin/actions';
import { getWagesData } from '@/src/server/services/adminPay';
import { loadMyWages } from '@/src/server/services/workerViews';
import { workerService } from '@/src/server/services/workerService';
import { periodOf, previousPeriod } from '@/src/server/domain/wagePayment';
import { getDatabase } from '@/src/server/repos';
import { resetRateLimits } from '@/src/server/auth/rateLimit';

const INITIAL = { ok: false };
const UTR = '412345678901';

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

/** A copy of Ramesh with his shifts, so each test pays a month nobody else has touched. */
async function freshWorker(): Promise<string> {
  const db = getDatabase();
  const base = (await db.workers.getById('worker-ramesh'))!;
  const id = `worker-wage-${Math.random().toString(36).slice(2, 8)}`;
  await db.workers.save({ ...base, id, phone: `9${Math.floor(Math.random() * 1e9)}` });
  for (const s of await db.shifts.listByWorker('worker-ramesh')) {
    await db.shifts.create({ ...s, id: `${s.id}-${id}`, workerId: id });
  }
  return id;
}

beforeEach(() => resetRateLimits());

describe('console wages', () => {
  it('lists each worker’s payslip with a UPI link and QR for that exact amount', async () => {
    const months = await getWagesData('construction');
    const thisMonth = months.find((m) => m.period === periodOf(new Date()))!;
    const ramesh = thisMonth.rows.find((r) => r.workerId === 'worker-ramesh')!;
    const { net } = await workerService.getMyPayslip('worker-ramesh');

    expect(ramesh.net).toBe(net);
    expect(ramesh.state).not.toBe('paid');
    expect(ramesh.payUri).toContain('pa=ramesh.kumar%40fairshiftdemo');
    expect(ramesh.payUri).toContain(`am=${net.toFixed(2)}`);
    expect(ramesh.qrSvg).toMatch(/^<svg/);
  });

  it('records the server’s amount with the UTR, and the worker sees it', async () => {
    const workerId = await freshWorker();
    const period = periodOf(new Date());
    const { net } = await workerService.getMyPayslip(workerId);

    const state = await recordWagePaymentAction(
      INITIAL,
      form({ workerId, period, utr: '4123 4567 8901', amount: '1' }),
    );
    expect(state).toMatchObject({ ok: true });

    const stored = await getDatabase().wagePayments.get(workerId, period);
    expect(stored).toMatchObject({ amount: net, utr: UTR, paidBy: expect.any(String) });

    const worker = (await getDatabase().workers.getById(workerId))!;
    const [current] = await loadMyWages(worker);
    expect(current).toMatchObject({ period, state: 'paid', payment: { utr: UTR } });
  });

  it('refuses to pay the same month twice', async () => {
    const workerId = await freshWorker();
    const period = periodOf(new Date());
    await recordWagePaymentAction(INITIAL, form({ workerId, period, utr: UTR }));
    const again = await recordWagePaymentAction(
      INITIAL,
      form({ workerId, period, utr: '999999999999' }),
    );
    expect(again).toMatchObject({ ok: false, error: expect.stringMatching(/already/) });
    expect((await getDatabase().wagePayments.get(workerId, period))?.utr).toBe(UTR);
  });

  it.each([
    ['a short UTR', { utr: '12345' }, /12-digit/],
    ['a month long past', { period: '2020-01' }, /last month and this month/],
    ['a worker at another organisation', { workerId: 'worker-murugan' }, /not found/i],
  ])('refuses %s', async (_label, override, message) => {
    const workerId = await freshWorker();
    const state = await recordWagePaymentAction(
      INITIAL,
      form({ workerId, period: periodOf(new Date()), utr: UTR, ...override }),
    );
    expect(state).toMatchObject({ ok: false, error: expect.stringMatching(message) });
  });

  it('refuses a worker with no UPI ID on file', async () => {
    const workerId = await freshWorker();
    const db = getDatabase();
    const { upiId: _upiId, ...worker } = (await db.workers.getById(workerId))!;
    await db.workers.save(worker);
    const state = await recordWagePaymentAction(
      INITIAL,
      form({ workerId, period: periodOf(new Date()), utr: UTR }),
    );
    expect(state).toMatchObject({ ok: false, error: expect.stringMatching(/UPI ID/) });
  });

  it('shows an unpaid month as due with its legal date', async () => {
    const workerId = await freshWorker();
    const worker = (await getDatabase().workers.getById(workerId))!;
    const months = await loadMyWages(worker);
    expect(months[0]).toMatchObject({ state: 'due', payment: null });
    expect(months[0].dueBy).toMatch(/-07$/);
    for (const m of months.slice(1)) expect(m.period).toBe(previousPeriod(months[0].period));
  });
});

describe('fair-site score', () => {
  it('scores the demo site from its records', async () => {
    const { getSiteScore } = await import('@/src/server/services/adminPages');
    const s = await getSiteScore('construction');
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.score).toBeLessThanOrEqual(100);
    expect(s.parts.map((p) => p.key)).toEqual(expect.arrayContaining(['hours', 'retention']));
  });
});
