import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkLoginLimit,
  checkRateLimit,
  clientIp,
  recordLoginFailure,
  resetRateLimits,
} from '@/src/server/auth/rateLimit';
import { allowedOrgIds, canAccessOrg } from '@/src/server/auth/guard';
import type { SessionPayload } from '@/src/shared/types';

const headersFrom = (init: Record<string, string>) => new Headers(init);

beforeEach(() => {
  resetRateLimits();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-27T09:00:00Z'));
});

afterEach(() => vi.useRealTimers());

describe('checkRateLimit', () => {
  it('counts down, blocks at the cap and reports when to retry', () => {
    expect(checkRateLimit('k', 2, 60_000)).toMatchObject({ allowed: true, remaining: 1 });
    expect(checkRateLimit('k', 2, 60_000)).toMatchObject({ allowed: true, remaining: 0 });
    vi.advanceTimersByTime(15_000);
    expect(checkRateLimit('k', 2, 60_000)).toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 45,
    });
  });

  it('opens a fresh window after the old one ends', () => {
    checkRateLimit('k', 1, 1_000);
    expect(checkRateLimit('k', 1, 1_000).allowed).toBe(false);
    vi.advanceTimersByTime(1_001);
    expect(checkRateLimit('k', 1, 1_000).allowed).toBe(true);
  });

  it('keeps keys independent', () => {
    checkRateLimit('a', 1);
    expect(checkRateLimit('a', 1).allowed).toBe(false);
    expect(checkRateLimit('b', 1).allowed).toBe(true);
  });
});

describe('clientIp', () => {
  it('uses the last X-Forwarded-For hop, which the platform proxy appends', () => {
    expect(clientIp(headersFrom({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9' }))).toBe(
      '203.0.113.9',
    );
  });

  it('falls back to X-Real-IP, then to a local marker', () => {
    expect(clientIp(headersFrom({ 'x-real-ip': '198.51.100.4' }))).toBe('198.51.100.4');
    expect(clientIp(headersFrom({}))).toBe('local');
  });
});

describe('login limits', () => {
  const h = headersFrom({ 'x-forwarded-for': '203.0.113.9' });

  it('locks one account after 5 failures without locking others', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkLoginLimit('worker', h, '9876543210').allowed).toBe(true);
      recordLoginFailure('worker', '9876543210');
    }
    expect(checkLoginLimit('worker', h, '9876543210')).toMatchObject({ allowed: false });
    expect(checkLoginLimit('worker', h, '9123456789').allowed).toBe(true);
  });

  it('treats the account case- and space-insensitively', () => {
    for (let i = 0; i < 5; i++) recordLoginFailure('admin', ' Admin@Site.org ');
    expect(checkLoginLimit('admin', h, 'admin@site.org').allowed).toBe(false);
  });

  it('unlocks after the 15 minute window', () => {
    for (let i = 0; i < 5; i++) recordLoginFailure('worker', '9876543210');
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    expect(checkLoginLimit('worker', h, '9876543210').allowed).toBe(true);
  });

  it('caps attempts per IP at 20 a minute, whatever the account', () => {
    for (let i = 0; i < 20; i++) checkLoginLimit('worker', h, `98765432${i}`);
    expect(checkLoginLimit('worker', h, '9000000000').allowed).toBe(false);
  });
});

describe('org guard', () => {
  const base: SessionPayload = {
    userId: 'u',
    orgId: 'org-construction',
    role: 'admin',
    iat: 0,
    exp: 1,
  };

  it('gives a site admin only their own organisation', () => {
    expect(allowedOrgIds(base)).toEqual(['org-construction']);
    expect(canAccessOrg(base, 'org-college')).toBe(false);
  });

  it('gives a regional admin every organisation in the signed session', () => {
    const regional = { ...base, orgIds: ['org-construction', 'org-college'] };
    expect(canAccessOrg(regional, 'org-college')).toBe(true);
  });

  it('ignores orgIds on a worker session', () => {
    const worker = { ...base, role: 'worker' as const, orgIds: ['org-college'] };
    expect(allowedOrgIds(worker)).toEqual(['org-construction']);
  });
});
