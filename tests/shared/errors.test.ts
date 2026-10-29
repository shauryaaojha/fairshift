import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AppError,
  UNEXPECTED_REASON,
  checkinErrorKey,
  failure,
  isAppError,
  toActionFailure,
} from '@/src/shared/errors';

describe('AppError', () => {
  it('carries a code and classifies permanence from it', () => {
    const err = new AppError('invalid_code', 'Invalid code');
    expect(isAppError(err)).toBe(true);
    expect(err.code).toBe('invalid_code');
    expect(err.permanent).toBe(true);
    expect(new AppError('rate_limited', 'slow down').permanent).toBe(false);
  });

  it('does not treat a plain Error as an AppError', () => {
    expect(isAppError(new Error('x'))).toBe(false);
  });
});

describe('failure', () => {
  it('marks permanent codes as not retryable and transient ones as retryable', () => {
    expect(failure('not_found', 'gone')).toEqual({
      ok: false,
      code: 'not_found',
      permanent: true,
      retryable: false,
      reason: 'gone',
    });
    expect(failure('rate_limited', 'wait')).toMatchObject({ permanent: false, retryable: true });
  });
});

describe('toActionFailure', () => {
  afterEach(() => vi.restoreAllMocks());

  it('passes an AppError message through to the client', () => {
    const res = toActionFailure(new AppError('outside_geofence', 'Outside site geofence'), 'test');
    expect(res).toMatchObject({ code: 'outside_geofence', reason: 'Outside site geofence' });
  });

  it('never leaks an unexpected error message, and logs it on the server', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = toActionFailure(new Error('MongoServerError: auth failed for user admin'), 'scope');
    expect(res).toEqual({
      ok: false,
      code: 'unexpected',
      permanent: false,
      retryable: true,
      reason: UNEXPECTED_REASON,
    });
    expect(JSON.stringify(res)).not.toContain('Mongo');
    expect(log).toHaveBeenCalledOnce();
  });
});

describe('checkinErrorKey', () => {
  it('maps error codes to check-in messages', () => {
    expect(checkinErrorKey('invalid_code')).toBe('checkin.err.invalid_code');
    expect(checkinErrorKey('outside_geofence')).toBe('checkin.err.outside');
    expect(checkinErrorKey('unexpected')).toBe('checkin.err.generic');
    expect(checkinErrorKey('auth')).toBe('checkin.err.generic');
  });
});
