/**
 * Limits for actions queued offline: at most 24 h old and at most 2 minutes in the future. Pure.
 */

/** Maximum age for an offline action before it is rejected as stale (24 hours). */
export const MAX_OFFLINE_AGE_MS = 24 * 60 * 60 * 1000;

/** Allowed future clock skew for device time drift (2 minutes). */
export const MAX_CLOCK_SKEW_MS = 2 * 60 * 1000;

export type CaptureValidationResult =
  { valid: true } | { valid: false; reason: 'future' | 'too_old' | 'invalid' };

/**
 * Validates whether an offline captured timestamp is acceptable relative to the server clock.
 *
 * Accepts only when timestamp is <= nowMs + MAX_CLOCK_SKEW_MS (clock skew)
 * and >= nowMs - MAX_OFFLINE_AGE_MS.
 *
 * Otherwise returns { valid: false, reason: 'future' | 'too_old' | 'invalid' }.
 * If capturedAtIso is null/empty or Date.parse yields NaN, returns { valid: false, reason: 'invalid' }.
 */
export function validateCapturedAt(
  capturedAtIso: string,
  nowMs: number = Date.now(),
): CaptureValidationResult {
  if (!capturedAtIso || typeof capturedAtIso !== 'string') {
    return { valid: false, reason: 'invalid' };
  }

  const ts = Date.parse(capturedAtIso);
  if (Number.isNaN(ts)) {
    return { valid: false, reason: 'invalid' };
  }

  if (ts > nowMs + MAX_CLOCK_SKEW_MS) {
    return { valid: false, reason: 'future' };
  }

  if (ts < nowMs - MAX_OFFLINE_AGE_MS) {
    return { valid: false, reason: 'too_old' };
  }

  return { valid: true };
}
