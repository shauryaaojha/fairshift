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

import { revalidatePath } from 'next/cache';
import { answerPayQueryAction, schedulePayRulesAction } from '@/app/admin/actions';
import { workerService } from '@/src/server/services/workerService';
import { getDatabase } from '@/src/server/repos';
import { resetRateLimits } from '@/src/server/auth/rateLimit';
import { upcomingMondays } from '@/src/server/domain/payRules';

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const INITIAL = { ok: false };

beforeEach(() => {
  resetRateLimits();
  vi.mocked(revalidatePath).mockClear();
});

async function openQuery(): Promise<string> {
  const db = getDatabase();
  const base = (await db.workers.getById('worker-ramesh'))!;
  const worker = { ...base, id: `worker-apa-${Math.random().toString(36).slice(2, 8)}` };
  await db.workers.save(worker);
  const { query } = await workerService.raisePayQuery(worker.id, {
    reason: 'short_pay',
    receivedAmount: 500,
    note: null,
  });
  return query.id;
}

describe('answerPayQueryAction', () => {
  it('answers with a corrected amount typed with ₹ and commas', async () => {
    const id = await openQuery();
    const state = await answerPayQueryAction(
      INITIAL,
      form({ id, text: 'Balance of the pay is added.', correctedNet: '₹ 18,500' }),
    );
    expect(state).toMatchObject({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith('/admin', 'layout');
    const stored = await getDatabase().payQueries.getById(id);
    expect(stored?.answers.at(-1)).toMatchObject({ correctedNet: 18500 });
  });

  it('treats an empty amount as unchanged', async () => {
    const id = await openQuery();
    await answerPayQueryAction(
      INITIAL,
      form({ id, text: 'Pay is correct as shown.', correctedNet: '' }),
    );
    expect((await getDatabase().payQueries.getById(id))?.answers.at(-1)?.correctedNet).toBeNull();
  });

  it('asks for a real answer and says why it cannot answer twice', async () => {
    const id = await openQuery();
    expect(await answerPayQueryAction(INITIAL, form({ id, text: 'ok' }))).toMatchObject({
      ok: false,
      error: expect.stringMatching(/10 characters/),
    });
    await answerPayQueryAction(INITIAL, form({ id, text: 'First proper answer here.' }));
    expect(
      await answerPayQueryAction(INITIAL, form({ id, text: 'Second proper answer here.' })),
    ).toEqual({ ok: false, error: 'This query is not waiting for an answer.' });
    expect(revalidatePath).toHaveBeenCalledTimes(1);
  });

  it('rate limits a flood of answers', async () => {
    let last = INITIAL as Awaited<ReturnType<typeof answerPayQueryAction>>;
    for (let i = 0; i < 21; i++) {
      last = await answerPayQueryAction(INITIAL, form({ id: 'payq-none', text: 'x' }));
    }
    expect(last.error).toMatch(/Too many/);
  });
});

describe('schedulePayRulesAction', () => {
  const monday = () => upcomingMondays(new Date())[2];

  it('schedules lawful rules from a coming Monday', async () => {
    const state = await schedulePayRulesAction(
      INITIAL,
      form({
        dailyHoursLimit: '8',
        weeklyHoursLimit: '46',
        otMultiplier: '2.5',
        effectiveFrom: monday(),
        reason: 'Agreed with workers at the site meeting',
      }),
    );
    expect(state).toEqual({ ok: true, message: `Scheduled from Monday ${monday()}.` });
    const org = await getDatabase().orgs.get(ctx.orgId);
    expect(org?.payRuleHistory?.some((v) => v.effectiveFrom === monday())).toBe(true);
  });

  it('refuses overtime below twice the rate, and a short reason', async () => {
    const below = await schedulePayRulesAction(
      INITIAL,
      form({
        dailyHoursLimit: '8',
        weeklyHoursLimit: '48',
        otMultiplier: '1.5',
        effectiveFrom: upcomingMondays(new Date())[3],
        reason: 'Cut costs this quarter please',
      }),
    );
    expect(below).toMatchObject({ ok: false, error: expect.stringMatching(/Code on Wages/) });
    const noReason = await schedulePayRulesAction(
      INITIAL,
      form({
        dailyHoursLimit: '8',
        weeklyHoursLimit: '48',
        otMultiplier: '2',
        effectiveFrom: upcomingMondays(new Date())[3],
        reason: 'x',
      }),
    );
    expect(noReason).toMatchObject({ ok: false, error: expect.stringMatching(/reason/) });
  });
});
