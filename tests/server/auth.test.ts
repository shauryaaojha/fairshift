import { describe, it, expect } from 'vitest';
import { hashSecret, verifySecret } from '../../src/server/auth/password';
import { signSession, verifySession } from '../../src/server/auth/session';
import { checkRateLimit, resetRateLimits } from '../../src/server/auth/rateLimit';
import { getDatabase } from '../../src/server/repos';

describe('Server: Auth & Storage', () => {
  describe('scrypt password hashing', () => {
    it('hashes and verifies secrets accurately', async () => {
      const pin = '1234';
      const hash = await hashSecret(pin);
      expect(hash).toContain(':');

      const isValid = await verifySecret(pin, hash);
      expect(isValid).toBe(true);

      const isInvalid = await verifySecret('9999', hash);
      expect(isInvalid).toBe(false);
    });

    it('rejects invalid or empty hashes', async () => {
      expect(await verifySecret('', 'invalid')).toBe(false);
      expect(await verifySecret('1234', 'no-colon')).toBe(false);
    });
  });

  describe('HMAC session tokens', () => {
    it('signs and verifies session payload with tamper-resistance', () => {
      const token = signSession({
        userId: 'worker-ramesh',
        orgId: 'org-construction',
        role: 'worker',
      });

      const verified = verifySession(token);
      expect(verified).not.toBeNull();
      expect(verified?.userId).toBe('worker-ramesh');
      expect(verified?.role).toBe('worker');

      // Tampered token
      const tampered = token.slice(0, -4) + 'abcd';
      expect(verifySession(tampered)).toBeNull();
    });

    it('rejects expired tokens', () => {
      // Negative TTL = expired
      const expiredToken = signSession({ userId: 'u1', orgId: 'o1', role: 'admin' }, -100);
      expect(verifySession(expiredToken)).toBeNull();
    });
  });

  describe('Rate Limiter', () => {
    it('enforces request caps and resets properly', () => {
      resetRateLimits();
      const key = 'test-ip';

      // 3 requests allowed with limit 3
      expect(checkRateLimit(key, 3, 10000).allowed).toBe(true);
      expect(checkRateLimit(key, 3, 10000).allowed).toBe(true);
      expect(checkRateLimit(key, 3, 10000).allowed).toBe(true);

      // 4th request blocked
      const blocked = checkRateLimit(key, 3, 10000);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    });
  });

  describe('Repository & Seed Data', () => {
    it('seeds and retrieves organisations and sites correctly', async () => {
      const db = getDatabase();
      const orgs = await db.orgs.list();
      expect(orgs.length).toBe(2);

      const constructionSites = await db.sites.listByOrg('org-construction');
      expect(constructionSites.length).toBeGreaterThan(0);
      expect(constructionSites[0].name).toContain('Skyline Towers');

      const worker = await db.workers.getByPhone('9876543210');
      expect(worker).not.toBeNull();
      expect(worker?.name).toBe('Ramesh Kumar');

      const admin = await db.admins.getByEmail('admin.skyline@fairshift.org');
      expect(admin).not.toBeNull();
    });
  });
});
