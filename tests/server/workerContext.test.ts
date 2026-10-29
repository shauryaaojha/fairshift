import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as NextServer from 'next/server';

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
  })),
}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`);
  }),
}));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof NextServer>()),
  connection: vi.fn(async () => {}),
}));

import {
  getLocale,
  getWorkerContext,
  listMyHazards,
  loadHazard,
  requireWorkerContext,
} from '@/src/server/services/workerViews';
import { SESSION_COOKIE_NAME, signSession } from '@/src/server/auth/session';
import { LOCALE_COOKIE } from '@/src/i18n';
import { getDatabase } from '@/src/server/repos';

beforeEach(() => jar.clear());

describe('getWorkerContext', () => {
  it('returns the worker and their site for a valid worker session', async () => {
    jar.set(
      SESSION_COOKIE_NAME,
      signSession({ userId: 'worker-ramesh', orgId: 'org-construction', role: 'worker' }),
    );
    const ctx = await getWorkerContext();
    expect(ctx?.worker.id).toBe('worker-ramesh');
    expect(ctx?.worker).not.toHaveProperty('pinHash');
    expect(ctx?.site.id).toBe(ctx?.worker.siteId);
  });

  it('returns null for no cookie, a tampered cookie and an admin session', async () => {
    expect(await getWorkerContext()).toBeNull();

    const token = signSession({
      userId: 'worker-ramesh',
      orgId: 'org-construction',
      role: 'worker',
    });
    jar.set(SESSION_COOKIE_NAME, `${token.slice(0, -2)}xx`);
    expect(await getWorkerContext()).toBeNull();

    jar.set(
      SESSION_COOKIE_NAME,
      signSession({ userId: 'admin-skyline', orgId: 'org-construction', role: 'admin' }),
    );
    expect(await getWorkerContext()).toBeNull();
  });

  it('sends a signed-out worker to the login page', async () => {
    await expect(requireWorkerContext()).rejects.toThrow('REDIRECT /w/login');
  });
});

describe('getLocale', () => {
  it('reads a supported language and ignores anything else', async () => {
    jar.set(LOCALE_COOKIE, 'ta');
    expect(await getLocale()).toBe('ta');
    jar.set(LOCALE_COOKIE, 'fr');
    expect(await getLocale()).toBeNull();
  });
});

describe('hazard visibility', () => {
  it("shows a worker their own report and their site's anonymous ones, never a colleague's", async () => {
    const db = getDatabase();
    const ramesh = (await db.workers.getById('worker-ramesh'))!;
    const colleague = (await db.workers.listBySite(ramesh.siteId)).find((w) => w.id !== ramesh.id)!;
    const base = {
      orgId: ramesh.orgId,
      siteId: ramesh.siteId,
      category: 'Fire',
      description: 'smoke',
      severity: 'high' as const,
      status: 'reported' as const,
      reportedAt: new Date().toISOString(),
      acknowledgedAt: null,
      resolvedAt: null,
      aiSummary: null,
      aiSuggestedSeverity: null,
    };
    await db.hazards.create({ ...base, id: 'vis-own', reporterId: ramesh.id, anonymous: false });
    await db.hazards.create({ ...base, id: 'vis-anon', reporterId: null, anonymous: true });
    await db.hazards.create({
      ...base,
      id: 'vis-other',
      reporterId: colleague.id,
      anonymous: false,
    });

    expect(await loadHazard(ramesh, 'vis-own')).not.toBeNull();
    expect(await loadHazard(ramesh, 'vis-anon')).not.toBeNull();
    expect(await loadHazard(ramesh, 'vis-other')).toBeNull();
    expect(await loadHazard(ramesh, 'missing')).toBeNull();

    const mine = await listMyHazards(ramesh, 50);
    expect(mine.every((h) => h.reporterId === ramesh.id)).toBe(true);
  });
});
