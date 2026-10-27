import { describe, expect, it } from 'vitest';
import {
  MAX_CLOCK_SKEW_MS,
  MAX_OFFLINE_AGE_MS,
  validateCapturedAt,
} from '../../src/server/domain/offline';

describe('Domain: Offline Capture Validation', () => {
  const now = Date.parse('2026-10-27T12:00:00.000Z');

  it('accepts timestamps equal to now', () => {
    const iso = new Date(now).toISOString();
    expect(validateCapturedAt(iso, now)).toEqual({ valid: true });
  });

  it('accepts timestamps in the past within 24 hours', () => {
    // 1 hour ago
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    expect(validateCapturedAt(oneHourAgo, now)).toEqual({ valid: true });

    // Exactly at the 24 hour limit
    const exact24hAgo = new Date(now - MAX_OFFLINE_AGE_MS).toISOString();
    expect(validateCapturedAt(exact24hAgo, now)).toEqual({ valid: true });
  });

  it('accepts timestamps slightly in the future within allowed clock skew (2 min)', () => {
    // 30 seconds ahead
    const thirtySecAhead = new Date(now + 30 * 1000).toISOString();
    expect(validateCapturedAt(thirtySecAhead, now)).toEqual({ valid: true });

    // Exactly 2 minutes ahead
    const exactSkewAhead = new Date(now + MAX_CLOCK_SKEW_MS).toISOString();
    expect(validateCapturedAt(exactSkewAhead, now)).toEqual({ valid: true });
  });

  it('rejects timestamps beyond clock skew as future', () => {
    // 2 minutes and 1 ms ahead
    const futureIso = new Date(now + MAX_CLOCK_SKEW_MS + 1).toISOString();
    expect(validateCapturedAt(futureIso, now)).toEqual({
      valid: false,
      reason: 'future',
    });

    // 1 hour ahead
    const farFutureIso = new Date(now + 60 * 60 * 1000).toISOString();
    expect(validateCapturedAt(farFutureIso, now)).toEqual({
      valid: false,
      reason: 'future',
    });
  });

  it('rejects timestamps older than 24 hours as too_old', () => {
    // 24 hours and 1 ms ago
    const tooOldIso = new Date(now - MAX_OFFLINE_AGE_MS - 1).toISOString();
    expect(validateCapturedAt(tooOldIso, now)).toEqual({
      valid: false,
      reason: 'too_old',
    });

    // 2 days ago
    const twoDaysAgoIso = new Date(now - 2 * MAX_OFFLINE_AGE_MS).toISOString();
    expect(validateCapturedAt(twoDaysAgoIso, now)).toEqual({
      valid: false,
      reason: 'too_old',
    });
  });

  it('rejects invalid or empty strings as invalid', () => {
    expect(validateCapturedAt('', now)).toEqual({
      valid: false,
      reason: 'invalid',
    });
    expect(validateCapturedAt('not-a-date', now)).toEqual({
      valid: false,
      reason: 'invalid',
    });
    // @ts-expect-error test invalid types
    expect(validateCapturedAt(null, now)).toEqual({
      valid: false,
      reason: 'invalid',
    });
    // @ts-expect-error test invalid types
    expect(validateCapturedAt(undefined, now)).toEqual({
      valid: false,
      reason: 'invalid',
    });
  });

  it('uses default nowMs when not passed', () => {
    const freshIso = new Date().toISOString();
    expect(validateCapturedAt(freshIso)).toEqual({ valid: true });
  });
});
