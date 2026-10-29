import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as NextServer from 'next/server';

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof NextServer>()),
  connection: vi.fn(async () => {}),
}));

import { GET } from '@/app/api/health/route';
import { resetServerEnvForTests } from '@/src/server/env';

afterEach(() => {
  vi.unstubAllEnvs();
  resetServerEnvForTests();
});

describe('GET /api/health', () => {
  it('reports ok on the in-memory store, with no secrets and no caching', async () => {
    vi.stubEnv('DATA_BACKEND', 'memory');
    vi.stubEnv('GEMINI_API_KEY', 'test-key-not-real');
    resetServerEnvForTests();

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(body).toMatchObject({
      status: 'ok',
      dataBackend: 'memory',
      database: 'memory',
      ai: 'gemini',
    });
    expect(JSON.stringify(body)).not.toContain('test-key-not-real');
  });

  it('says when AI runs on the rule-based fallback', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    resetServerEnvForTests();
    const body = await (await GET()).json();
    expect(body.ai).toBe('rule-based fallback');
  });
});
