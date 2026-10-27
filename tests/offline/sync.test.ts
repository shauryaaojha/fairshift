import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryOutboxStore, type OutboxItem } from '@/src/lib/offline/outbox';
import { flushOutbox, _resetFlushingForTests, type SyncHandlers } from '@/src/lib/offline/sync';

describe('flushOutbox', () => {
  let store: MemoryOutboxStore;

  beforeEach(() => {
    store = new MemoryOutboxStore();
    _resetFlushingForTests();
  });

  it('replays items in chronological order (oldest capturedAt first)', async () => {
    const executedOrder: string[] = [];

    const itemNew: OutboxItem = {
      id: 'id-new',
      workerId: 'worker-1',
      kind: 'checkin',
      payload: { code: '111111' },
      capturedAt: '2026-10-27T10:00:00.000Z',
      attempts: 0,
    };
    const itemOld: OutboxItem = {
      id: 'id-old',
      workerId: 'worker-1',
      kind: 'checkin',
      payload: { code: '222222' },
      capturedAt: '2026-10-27T08:00:00.000Z',
      attempts: 0,
    };
    const itemMiddle: OutboxItem = {
      id: 'id-mid',
      workerId: 'worker-1',
      kind: 'checkout',
      payload: {},
      capturedAt: '2026-10-27T09:00:00.000Z',
      attempts: 0,
    };

    // Put them in non-chronological order
    await store.put(itemNew);
    await store.put(itemOld);
    await store.put(itemMiddle);

    const handlers: SyncHandlers = {
      checkin: vi.fn(async (item) => {
        executedOrder.push(item.id);
        return { ok: true };
      }),
      checkout: vi.fn(async (item) => {
        executedOrder.push(item.id);
        return { ok: true };
      }),
      hazard: vi.fn(async () => ({ ok: true })),
      feedback: vi.fn(async () => ({ ok: true })),
    };

    const res = await flushOutbox(store, 'worker-1', handlers);

    expect(executedOrder).toEqual(['id-old', 'id-mid', 'id-new']);
    expect(res.processed).toBe(3);
    expect(res.succeeded).toBe(3);
  });

  it('removes successfully synced items from the store', async () => {
    const item: OutboxItem = {
      id: 'success-1',
      workerId: 'worker-1',
      kind: 'checkin',
      payload: { code: '123456' },
      capturedAt: '2026-10-27T08:00:00.000Z',
      attempts: 0,
    };
    await store.put(item);

    const handlers: SyncHandlers = {
      checkin: vi.fn(async () => ({ ok: true })),
      checkout: vi.fn(async () => ({ ok: true })),
      hazard: vi.fn(async () => ({ ok: true })),
      feedback: vi.fn(async () => ({ ok: true })),
    };

    const res = await flushOutbox(store, 'worker-1', handlers);
    expect(res.succeeded).toBe(1);

    const remaining = await store.list();
    expect(remaining).toHaveLength(0);
  });

  it('removes permanently failed items and reports them via onPermanentFailure and result', async () => {
    const item: OutboxItem = {
      id: 'bad-code',
      workerId: 'worker-1',
      kind: 'checkin',
      payload: { code: '000000' },
      capturedAt: '2026-10-27T08:00:00.000Z',
      attempts: 0,
    };
    await store.put(item);

    const onPermanentFailure = vi.fn();
    const handlers: SyncHandlers = {
      checkin: vi.fn(async () => ({
        ok: false,
        permanent: true,
        reason: 'Invalid gate code',
      })),
      checkout: vi.fn(async () => ({ ok: true })),
      hazard: vi.fn(async () => ({ ok: true })),
      feedback: vi.fn(async () => ({ ok: true })),
      onPermanentFailure,
    };

    const res = await flushOutbox(store, 'worker-1', handlers);
    expect(res.permanentFailures).toHaveLength(1);
    expect(res.permanentFailures[0].reason).toBe('Invalid gate code');
    expect(onPermanentFailure).toHaveBeenCalledWith(item, 'Invalid gate code');

    // Item must be removed so it does not block the queue forever
    const remaining = await store.list();
    expect(remaining).toHaveLength(0);
  });

  it('retains retryable failure, increments attempts, and stops loop immediately', async () => {
    const item1: OutboxItem = {
      id: 'item-1',
      workerId: 'worker-1',
      kind: 'checkin',
      payload: {},
      capturedAt: '2026-10-27T08:00:00.000Z',
      attempts: 0,
    };
    const item2: OutboxItem = {
      id: 'item-2',
      workerId: 'worker-1',
      kind: 'hazard',
      payload: {},
      capturedAt: '2026-10-27T08:30:00.000Z',
      attempts: 0,
    };
    await store.put(item1);
    await store.put(item2);

    const hazardMock = vi.fn(async () => ({ ok: true }));
    const handlers: SyncHandlers = {
      checkin: vi.fn(async () => {
        // Simulates network error throw
        throw new Error('Network error: failed to fetch');
      }),
      checkout: vi.fn(async () => ({ ok: true })),
      hazard: hazardMock,
      feedback: vi.fn(async () => ({ ok: true })),
    };

    const res = await flushOutbox(store, 'worker-1', handlers);

    expect(res.stoppedDueToRetryable).toBeDefined();
    expect(res.stoppedDueToRetryable?.item.id).toBe('item-1');
    expect(res.stoppedDueToRetryable?.reason).toContain('failed to fetch');

    // Item 2 must NOT have been called because loop stopped
    expect(hazardMock).not.toHaveBeenCalled();

    // Check store state: item 1 still exists with attempts = 1, item 2 still exists with attempts = 0
    const list = await store.list('worker-1');
    expect(list).toHaveLength(2);
    const updatedItem1 = list.find((i) => i.id === 'item-1');
    expect(updatedItem1?.attempts).toBe(1);
  });

  it('skips items belonging to other workers and keeps them in store', async () => {
    const itemWorkerA: OutboxItem = {
      id: 'item-a',
      workerId: 'worker-a',
      kind: 'checkin',
      payload: {},
      capturedAt: '2026-10-27T08:00:00.000Z',
      attempts: 0,
    };
    const itemWorkerB: OutboxItem = {
      id: 'item-b',
      workerId: 'worker-b',
      kind: 'checkin',
      payload: {},
      capturedAt: '2026-10-27T08:30:00.000Z',
      attempts: 0,
    };
    await store.put(itemWorkerA);
    await store.put(itemWorkerB);

    const checkinMock = vi.fn(async () => ({ ok: true }));
    const handlers: SyncHandlers = {
      checkin: checkinMock,
      checkout: vi.fn(async () => ({ ok: true })),
      hazard: vi.fn(async () => ({ ok: true })),
      feedback: vi.fn(async () => ({ ok: true })),
    };

    // Flush as worker-b
    const res = await flushOutbox(store, 'worker-b', handlers);

    expect(res.skippedMismatch).toBe(1);
    expect(res.succeeded).toBe(1);
    expect(checkinMock).toHaveBeenCalledTimes(1);

    // item-a must remain untouched for worker-a!
    const all = await store.list();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('item-a');
  });

  it('guards against concurrent flushes', async () => {
    const item: OutboxItem = {
      id: 'item-slow',
      workerId: 'worker-1',
      kind: 'checkin',
      payload: {},
      capturedAt: '2026-10-27T08:00:00.000Z',
      attempts: 0,
    };
    await store.put(item);

    let resolveSlow: () => void;
    const slowPromise = new Promise<void>((r) => {
      resolveSlow = r;
    });

    const checkinMock = vi.fn(async () => {
      await slowPromise;
      return { ok: true };
    });

    const handlers: SyncHandlers = {
      checkin: checkinMock,
      checkout: vi.fn(async () => ({ ok: true })),
      hazard: vi.fn(async () => ({ ok: true })),
      feedback: vi.fn(async () => ({ ok: true })),
    };

    // Start flush 1
    const p1 = flushOutbox(store, 'worker-1', handlers);
    // Start flush 2 while flush 1 is running
    const p2 = flushOutbox(store, 'worker-1', handlers);

    const res2 = await p2;
    expect(res2.alreadyFlushing).toBe(true);

    // Now resolve slow handler
    resolveSlow!();
    const res1 = await p1;
    expect(res1.succeeded).toBe(1);
    expect(checkinMock).toHaveBeenCalledTimes(1);
  });
});
