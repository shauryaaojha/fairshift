import { describe, expect, it } from 'vitest';
import {
  generateUuid,
  getActiveWorkerId,
  getOutboxStore,
  MemoryOutboxStore,
  setActiveWorkerId,
  type OutboxItem,
} from '@/src/lib/offline/outbox';

describe('MemoryOutboxStore', () => {
  it('puts, lists and removes items', async () => {
    const store = new MemoryOutboxStore();
    const item1: OutboxItem = {
      id: 'id-1',
      workerId: 'worker-a',
      kind: 'checkin',
      payload: { code: '123456' },
      capturedAt: '2026-10-27T08:00:00.000Z',
      attempts: 0,
    };
    const item2: OutboxItem = {
      id: 'id-2',
      workerId: 'worker-b',
      kind: 'hazard',
      payload: { category: 'fire', description: 'smoke', severity: 'high', anonymous: false },
      capturedAt: '2026-10-27T09:00:00.000Z',
      attempts: 0,
    };

    await store.put(item1);
    await store.put(item2);

    const all = await store.list();
    expect(all).toHaveLength(2);

    const forA = await store.list('worker-a');
    expect(forA).toHaveLength(1);
    expect(forA[0].id).toBe('id-1');

    const forB = await store.list('worker-b');
    expect(forB).toHaveLength(1);
    expect(forB[0].id).toBe('id-2');

    await store.remove('id-1');
    const remaining = await store.list();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('id-2');
  });

  it('updates item when put with same id', async () => {
    const store = new MemoryOutboxStore();
    const item: OutboxItem = {
      id: 'id-1',
      workerId: 'worker-a',
      kind: 'checkin',
      payload: { code: '123456' },
      capturedAt: '2026-10-27T08:00:00.000Z',
      attempts: 0,
    };
    await store.put(item);

    const updated = { ...item, attempts: 1 };
    await store.put(updated);

    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0].attempts).toBe(1);
  });
});

describe('outbox helpers', () => {
  it('generates unique valid uuids', () => {
    const u1 = generateUuid();
    const u2 = generateUuid();
    expect(u1).not.toBe(u2);
    expect(u1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('sets and gets active worker id safely', () => {
    setActiveWorkerId('w-123');
    expect(getActiveWorkerId()).toBe('w-123');
    setActiveWorkerId('');
    expect(getActiveWorkerId()).toBe('');
  });

  it('returns singleton store instance', () => {
    const s1 = getOutboxStore();
    const s2 = getOutboxStore();
    expect(s1).toBe(s2);
  });
});
