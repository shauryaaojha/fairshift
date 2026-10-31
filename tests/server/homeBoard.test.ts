import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { loadHomeBoard } from '@/src/server/services/workerViews';
import { getDatabase } from '@/src/server/repos';
import type { Worker } from '@/src/shared/types';

const db = getDatabase();

async function worker(id: string): Promise<Worker> {
  const w = await db.workers.getById(id);
  if (!w) throw new Error(`no demo worker ${id}`);
  return w;
}

describe('loadHomeBoard', () => {
  it('gives seven muster days ending today, and the normal day from the pay rules', async () => {
    const board = await loadHomeBoard(await worker('worker-ramesh'));
    expect(board.days).toHaveLength(7);
    expect(board.days.at(-1)?.today).toBe(true);
    expect(board.dayHours).toBeGreaterThan(0);
    expect(board.totalHours).toBeGreaterThanOrEqual(0);
    for (const item of board.todo) expect(item.href.startsWith('/w/')).toBe(true);
  });

  it('lists the overdue pay question as a letter ready to write', async () => {
    const board = await loadHomeBoard(await worker('worker-const-7'));
    expect(board.todo).toContainEqual({
      kind: 'letter_ready',
      href: '/w/pay/query/payq-2/letter',
    });
  });

  it('has nothing to answer for a worker with no records', async () => {
    const ramesh = await worker('worker-ramesh');
    const fresh: Worker = { ...ramesh, id: 'worker-home-fresh', phone: '9000000001' };
    await db.workers.save(fresh);
    const board = await loadHomeBoard(fresh);
    expect(board.todo.filter((t) => t.kind !== 'wages_overdue')).toEqual([]);
    expect(board.days.every((d) => !d.present)).toBe(true);
    expect(board.totalHours).toBe(0);
  });
});
