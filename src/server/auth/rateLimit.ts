/**
 * Fixed-window rate limits kept in memory per server instance: per-action caps, 20 login attempts
 * per IP per minute, and a 15-minute lockout after 5 failed logins for one account.
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();
const MAX_TRACKED_KEYS = 10_000;

/** Drop expired records so spoofed or one-off keys cannot grow the map without bound. */
function prune(now: number): void {
  if (rateLimitStore.size < MAX_TRACKED_KEYS) return;
  for (const [key, record] of rateLimitStore) {
    if (now > record.resetTime) rateLimitStore.delete(key);
  }
  // Still full of live keys: drop the oldest entries (Map keeps insertion order).
  for (const key of rateLimitStore.keys()) {
    if (rateLimitStore.size < MAX_TRACKED_KEYS) break;
    rateLimitStore.delete(key);
  }
}

/**
 * Checks and increments rate limit counter for a specific key.
 * @param key unique identifier (e.g., `login:${ip}`)
 * @param maxLimit maximum allowed requests within the window
 * @param windowMs time window in milliseconds (default 60 seconds)
 */
export function checkRateLimit(
  key: string,
  maxLimit: number = 10,
  windowMs: number = 60 * 1000,
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    prune(now);
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      allowed: true,
      remaining: maxLimit - 1,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (record.count >= maxLimit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  record.count++;
  return {
    allowed: true,
    remaining: maxLimit - record.count,
    retryAfterSeconds: Math.ceil((record.resetTime - now) / 1000),
  };
}

/**
 * Helper to reset rate limits (useful in tests)
 */
export function resetRateLimits(): void {
  rateLimitStore.clear();
}

/**
 * Client IP for rate limiting. Proxies append to X-Forwarded-For, so the left-most
 * entries can be set by the client; the last entry is the one Cloud Run's front end
 * added. Spoofing the header therefore cannot reset the counter on each request.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  const last = forwarded
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .pop();
  return last || headers.get('x-real-ip') || 'local';
}

const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const accountKey = (kind: string, account: string) =>
  `login:${kind}:fail:${account.trim().toLowerCase()}`;

/**
 * Login throttle, checked before verifying credentials: per IP (20 a minute) and per
 * account (locked after 5 wrong attempts in 15 minutes). Only failures count against
 * the account, so a shared demo account is never locked by people signing in correctly.
 * The per-account lock is what protects a 4-digit PIN from brute force.
 */
export function checkLoginLimit(
  kind: 'worker' | 'admin',
  headers: Headers,
  account: string,
): { allowed: boolean; retryAfterSeconds: number } {
  const byIp = checkRateLimit(`login:${kind}:ip:${clientIp(headers)}`, 20, 60 * 1000);
  if (!byIp.allowed) return byIp;
  const failures = rateLimitStore.get(accountKey(kind, account));
  const now = Date.now();
  if (failures && now <= failures.resetTime && failures.count >= LOGIN_FAILURE_LIMIT) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((failures.resetTime - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Records a wrong password or PIN against the account. */
export function recordLoginFailure(kind: 'worker' | 'admin', account: string): void {
  checkRateLimit(accountKey(kind, account), Number.MAX_SAFE_INTEGER, LOGIN_FAILURE_WINDOW_MS);
}
