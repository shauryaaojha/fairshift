/**
 * Session tokens: an HMAC-SHA256 signed, base64url JSON payload with an expiry, carried in an
 * httpOnly cookie. Also derives per-purpose keys (QR, passport) from the one session secret.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import type { SessionPayload } from '../../shared/types';
import { serverEnv } from '../env';

export const SESSION_COOKIE_NAME = 'fairshift_session';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

// Outside production, a fixed local-only secret is used when SESSION_SECRET is unset.
// It must be the same value in every module instance (proxy, route handlers, server
// actions), otherwise a cookie signed by one is rejected by another. A random per-process
// value breaks that in `next dev`. Production refuses to run without a real secret.
const LOCAL_DEV_SECRET = 'fairshift-local-dev-only-not-a-secret';
let warned = false;
/**
 * A per-purpose secret derived from the session secret (HMAC), used for things such
 * as site QR keys and passport tokens. One deployment secret, no extra keys to manage.
 */
export function deriveServerSecret(purpose: string): string {
  return createHmac('sha256', getSessionSecret()).update(`fairshift:${purpose}`).digest('hex');
}

function getSessionSecret(): string {
  const env = serverEnv();
  if (env.sessionSecret) return env.sessionSecret;
  // Checked here, at sign/verify time, not when the env is parsed: `next build` runs with
  // NODE_ENV=production but signs nothing, so it must not need the secret.
  if (env.nodeEnv === 'production') {
    throw new Error('[FairShift] SESSION_SECRET must be set in production. See .env.example.');
  }
  if (!warned && env.nodeEnv !== 'test') {
    warned = true;
    console.warn('[FairShift Auth] SESSION_SECRET is unset. Using the local development secret.');
  }
  return LOCAL_DEV_SECRET;
}

/**
 * Creates an HMAC-SHA256 signed session string.
 */
export function signSession(
  payload: Omit<SessionPayload, 'iat' | 'exp'>,
  ttlSeconds: number = SESSION_TTL_SECONDS,
): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: SessionPayload = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };

  const payloadJson = JSON.stringify(fullPayload);
  const payloadBase64 = Buffer.from(payloadJson).toString('base64url');

  const secret = getSessionSecret();
  const signature = createHmac('sha256', secret).update(payloadBase64).digest('base64url');

  return `${payloadBase64}.${signature}`;
}

/**
 * Verifies and decodes an HMAC-SHA256 signed session string.
 * Returns null if signature is invalid or token has expired.
 */
export function verifySession(token: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadBase64, signature] = parts;
  const secret = getSessionSecret();

  const expectedSignature = createHmac('sha256', secret).update(payloadBase64).digest('base64url');

  // Constant-time comparison
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as SessionPayload;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
