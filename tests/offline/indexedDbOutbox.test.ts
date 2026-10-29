import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  IndexedDbOutboxStore,
  getOutboxStore,
  setOutboxStoreForTesting,
  type OutboxItem,
} from '@/src/lib/offline/outbox';

const item = (id: string, workerId: string, capturedAt: string): OutboxItem => ({
  id,
  workerId,
  kind: 'hazard',
  payload: { category: 'Fire', description: 'smoke', severity: 'high', anonymous: false },
  capturedAt,
  attempts: 0,
});

afterEach(() => setOutboxStoreForTesting(null));

describe('IndexedDbOutboxStore (the store phones actually use)', () => {
  it('keeps items across store instances, like a reload of the page', async () => {
    const first = new IndexedDbOutboxStore();
    await first.put(item('persist-1', 'worker-a', '2026-10-27T08:00:00.000Z'));

    const afterReload = new IndexedDbOutboxStore();
    const items = await afterReload.list('worker-a');
    expect(items.map((i) => i.id)).toContain('persist-1');
    await afterReload.remove('persist-1');
  });

  it("lists only the given worker's items, so a shared phone never syncs someone else's", async () => {
    const store = new IndexedDbOutboxStore();
    await store.put(item('a-1', 'worker-a', '2026-10-27T08:00:00.000Z'));
    await store.put(item('b-1', 'worker-b', '2026-10-27T08:05:00.000Z'));

    expect((await store.list('worker-b')).map((i) => i.id)).toEqual(['b-1']);
    expect((await store.list()).length).toBeGreaterThanOrEqual(2);

    await store.remove('a-1');
    await store.remove('b-1');
    expect(await store.list('worker-a')).toEqual([]);
  });

  it('replaces an item with the same id instead of duplicating it', async () => {
    const store = new IndexedDbOutboxStore();
    await store.put(item('dup', 'worker-c', '2026-10-27T08:00:00.000Z'));
    await store.put({ ...item('dup', 'worker-c', '2026-10-27T08:00:00.000Z'), attempts: 2 });
    const items = await store.list('worker-c');
    expect(items).toHaveLength(1);
    expect(items[0].attempts).toBe(2);
    await store.remove('dup');
  });

  it('announces every change so the offline banner can refresh its count', async () => {
    const listener = vi.fn();
    window.addEventListener('fairshift:outbox-change', listener);
    const store = new IndexedDbOutboxStore();
    await store.put(item('evt', 'worker-d', '2026-10-27T08:00:00.000Z'));
    await store.remove('evt');
    window.removeEventListener('fairshift:outbox-change', listener);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('is the default store when the browser has IndexedDB', () => {
    expect(getOutboxStore()).toBeInstanceOf(IndexedDbOutboxStore);
  });
});
