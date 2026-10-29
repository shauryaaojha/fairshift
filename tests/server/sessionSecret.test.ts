import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveServerSecret, signSession, verifySession } from '@/src/server/auth/session';
import { resetServerEnvForTests } from '@/src/server/env';

afterEach(() => {
  vi.unstubAllEnvs();
  resetServerEnvForTests();
});

const payload = { userId: 'worker-ramesh', orgId: 'org-construction', role: 'worker' as const };

describe('session secret', () => {
  it('refuses to sign in production without SESSION_SECRET', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_SECRET', '');
    resetServerEnvForTests();
    expect(() => signSession(payload)).toThrow(/SESSION_SECRET must be set/);
  });

  it('rejects a cookie signed with a different secret', () => {
    vi.stubEnv('SESSION_SECRET', 'a'.repeat(32));
    resetServerEnvForTests();
    const token = signSession(payload);
    expect(verifySession(token)?.userId).toBe('worker-ramesh');

    vi.stubEnv('SESSION_SECRET', 'b'.repeat(32));
    resetServerEnvForTests();
    expect(verifySession(token)).toBeNull();
  });

  it('derives a different key per purpose', () => {
    vi.stubEnv('SESSION_SECRET', 'c'.repeat(32));
    resetServerEnvForTests();
    expect(deriveServerSecret('qr')).not.toBe(deriveServerSecret('passport'));
    expect(deriveServerSecret('qr')).toMatch(/^[a-f0-9]{64}$/);
  });
});
