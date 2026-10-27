import { describe, it, expect, vi, beforeEach } from 'vitest';

type Doc = Record<string, unknown>;

const h = vi.hoisted(() => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  const state = { initFail: false, apps: 0, batchSizes: [] as number[] };
  return { store, state };
});

function col(name: string) {
  if (!h.store.has(name)) h.store.set(name, new Map());
  return h.store.get(name)!;
}

vi.mock('firebase-admin/app', () => ({
  getApps: () => Array.from({ length: h.state.apps }),
  initializeApp: () => {
    if (h.state.initFail) throw new Error('Could not load the default credentials');
    h.state.apps = 1;
  },
}));

vi.mock('firebase-admin/firestore', () => {
  const makeQuery = (name: string, filters: Array<[string, unknown]>, lim?: number) => ({
    where: (f: string, _op: string, v: unknown) => makeQuery(name, [...filters, [f, v]], lim),
    limit: (n: number) => makeQuery(name, filters, n),
    get: async () => {
      let docs = Array.from(col(name).entries())
        .filter(([, d]) => filters.every(([f, v]) => d[f] === v))
        .map(([id, d]) => ({ id, exists: true, data: () => structuredClone(d) }));
      if (lim !== undefined) docs = docs.slice(0, lim);
      return { docs, empty: docs.length === 0 };
    },
  });
  const collection = (name: string) => ({
    ...makeQuery(name, []),
    doc: (id: string) => ({
      __col: name,
      __id: id,
      get: async () => {
        const d = col(name).get(id);
        return { exists: d !== undefined, data: () => (d ? structuredClone(d) : undefined) };
      },
      set: async (data: Doc) => {
        if (Object.values(data).includes(undefined)) throw new Error('undefined value');
        col(name).set(id, structuredClone(data));
      },
      update: async (data: Doc) => {
        col(name).set(id, { ...(col(name).get(id) ?? {}), ...data });
      },
    }),
  });
  return {
    getFirestore: () => ({
      collection,
      batch: () => {
        const ops: Array<() => void> = [];
        return {
          set: (ref: { __col: string; __id: string }, data: Doc) => {
            ops.push(() => col(ref.__col).set(ref.__id, structuredClone(data)));
          },
          commit: async () => {
            h.state.batchSizes.push(ops.length);
            ops.forEach((o) => o());
          },
        };
      },
    }),
  };
});

import { getFirestoreDb, resetFirestoreDbForTests } from '../../src/server/repos/firestore';
import { inMemoryDb } from '../../src/server/repos/memory';
import { generateSeedData } from '../../src/server/seed/seed';
import { withLiveHazardStatus } from '../../src/server/repos/hazardStatus';
import type { HazardReport, Shift } from '../../src/shared/types';

beforeEach(() => {
  h.store.clear();
  h.state.initFail = false;
  h.state.apps = 0;
  h.state.batchSizes = [];
  resetFirestoreDbForTests();
});

describe('Firestore adapter', () => {
  it('seeds only when orgs is empty, in batches of <= 500', async () => {
    const seed = await generateSeedData();
    const db = getFirestoreDb();
    expect((await db.orgs.list()).length).toBe(seed.orgs.length);
    expect(h.state.batchSizes.length).toBeGreaterThan(0);
    expect(h.state.batchSizes.every((n) => n <= 500)).toBe(true);
    const total = h.state.batchSizes.reduce((a, b) => a + b, 0);
    expect(total).toBe(Object.values(seed).reduce((a, l) => a + l.length, 0));

    // fresh instance on a populated store must not reseed
    const before = h.state.batchSizes.length;
    resetFirestoreDbForTests();
    await getFirestoreDb().orgs.list();
    expect(h.state.batchSizes.length).toBe(before);
  });

  it('round-trips orgs, sites, workers, admins', async () => {
    const seed = await generateSeedData();
    const db = getFirestoreDb();
    const org = seed.orgs[0];
    expect(await db.orgs.get(org.id)).toEqual(org);
    expect(await db.orgs.get('nope')).toBeNull();
    await db.orgs.save({ ...org, name: 'Renamed' });
    expect((await db.orgs.get(org.id))?.name).toBe('Renamed');

    const site = seed.sites[0];
    expect((await db.sites.listByOrg(site.orgId)).some((s) => s.id === site.id)).toBe(true);
    expect((await db.sites.list()).length).toBe(seed.sites.length);

    const w = seed.workers[0];
    expect((await db.workers.getByPhone(w.phone))?.id).toBe(w.id);
    expect((await db.workers.getById(w.id))?.id).toBe(w.id);
    expect((await db.workers.listBySite(w.siteId)).some((x) => x.id === w.id)).toBe(true);
    expect((await db.workers.listByOrg(w.orgId)).length).toBeGreaterThan(0);

    const a = seed.admins[0];
    expect((await db.admins.getByEmail(a.email.toUpperCase()))?.id).toBe(a.id);
    expect((await db.admins.getById(a.id))?.id).toBe(a.id);
    expect((await db.admins.listByOrg(a.orgId)).length).toBeGreaterThan(0);
  });

  it('active shift query, update and sorting', async () => {
    const seed = await generateSeedData();
    const db = getFirestoreDb();
    const base = seed.shifts[0];
    const open: Shift = {
      ...base,
      id: 'shift-open',
      workerId: 'worker-x',
      checkIn: '2030-01-01T08:00:00.000Z',
      checkOut: null,
    };
    await db.shifts.create(open);
    expect((await db.shifts.getActiveForWorker('worker-x'))?.id).toBe('shift-open');
    await db.shifts.update({ ...open, checkOut: '2030-01-01T16:00:00.000Z' });
    expect(await db.shifts.getActiveForWorker('worker-x')).toBeNull();
    expect((await db.shifts.getById('shift-open'))?.checkOut).toBe('2030-01-01T16:00:00.000Z');
    const list = await db.shifts.listByWorker(base.workerId);
    for (let i = 1; i < list.length; i++) {
      expect(new Date(list[i - 1].checkIn).getTime()).toBeGreaterThanOrEqual(
        new Date(list[i].checkIn).getTime()
      );
    }
    expect((await db.shifts.listBySite(base.siteId)).length).toBeGreaterThan(0);
    expect((await db.shifts.listByOrg(base.orgId)).length).toBeGreaterThan(0);
  });

  it('hazards compute status identically to memory adapter', async () => {
    const seed = await generateSeedData();
    const db = getFirestoreDb();
    const src = seed.hazards[0];
    const stale: HazardReport = {
      ...src,
      id: 'hz-stale',
      status: 'reported',
      severity: 'critical',
      reportedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
      acknowledgedAt: null,
    };
    await db.hazards.create(stale);
    expect((await db.hazards.getById('hz-stale'))?.status).toBe('escalated');
    expect((await db.hazards.getById('hz-stale'))?.status).toBe(withLiveHazardStatus(stale).status);

    await inMemoryDb.hazards.create(stale);
    const mem = await inMemoryDb.hazards.listBySite(stale.siteId);
    const fs = await db.hazards.listBySite(stale.siteId);
    expect(fs.map((x) => [x.id, x.status])).toEqual(mem.map((x) => [x.id, x.status]));
    expect((await db.hazards.listByOrg(stale.orgId)).length).toBeGreaterThan(0);
    expect(await db.hazards.getById('missing')).toBeNull();

    await db.hazards.update({ ...stale, status: 'resolved' });
    expect((await db.hazards.getById('hz-stale'))?.status).toBe('resolved');
  });

  it('feedback and skills', async () => {
    const seed = await generateSeedData();
    const db = getFirestoreDb();
    const fb = { ...seed.feedback[0], id: 'fb-new', isoWeek: '2099-W01', comment: null };
    await db.feedback.create(fb);
    expect(await db.feedback.listBySiteAndWeek(fb.siteId, '2099-W01')).toEqual([fb]);
    expect((await db.feedback.listBySite(fb.siteId)).length).toBeGreaterThan(1);
    expect((await db.feedback.listByOrg(fb.orgId)).length).toBeGreaterThan(1);

    const sk = { ...seed.skills[0], id: 'sk-new', verifyToken: 'tok-123' };
    await db.skills.create(sk);
    expect(await db.skills.getById('sk-new')).toEqual(sk);
    expect((await db.skills.getByVerifyToken('tok-123'))?.id).toBe('sk-new');
    expect(await db.skills.getByVerifyToken('zzz')).toBeNull();
    expect((await db.skills.listByWorker(sk.workerId)).some((s) => s.id === 'sk-new')).toBe(true);
  });

  it('strips undefined before writing', async () => {
    const db = getFirestoreDb();
    const seed = await generateSeedData();
    await db.orgs.save({ ...seed.orgs[0], id: 'o-undef', extra: undefined } as never);
    expect((await db.orgs.get('o-undef'))?.id).toBe('o-undef');
  });

  it('throws a clear error when initialisation fails', () => {
    h.state.initFail = true;
    expect(() => getFirestoreDb()).toThrow(/DATA_BACKEND=firestore.*initialisation failed/);
  });
});
