/**
 * Typed application errors.
 *
 * Services throw an `AppError` with a closed `code` instead of free-form prose, so callers decide
 * what to show (and whether an offline replay should retry) from the code alone. Anything that is
 * not an `AppError` is an unexpected fault: it is logged on the server and reaches the client only
 * as a generic, retryable failure, so database or library messages never leak to the browser.
 */

export type AppErrorCode =
  | 'auth'
  | 'invalid_credentials'
  | 'validation'
  | 'not_found'
  | 'invalid_code'
  | 'outside_geofence'
  | 'no_checkin_method'
  | 'invalid_capture_time'
  | 'checkout_before_checkin'
  | 'severity_locked'
  | 'verdict_not_allowed'
  | 'answer_not_allowed'
  | 'feedback_already_given'
  | 'wages_already_paid'
  | 'rate_limited';

/**
 * A permanent error fails the same way however often it is retried, so the offline outbox drops
 * the item and tells the worker. A transient one (rate limit, unexpected fault) is kept for retry.
 */
const PERMANENT: Record<AppErrorCode, boolean> = {
  auth: true,
  invalid_credentials: true,
  validation: true,
  not_found: true,
  invalid_code: true,
  outside_geofence: true,
  no_checkin_method: true,
  invalid_capture_time: true,
  checkout_before_checkin: true,
  severity_locked: true,
  verdict_not_allowed: true,
  answer_not_allowed: true,
  feedback_already_given: true,
  wages_already_paid: true,
  rate_limited: false,
};

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }

  get permanent(): boolean {
    return PERMANENT[this.code];
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

/** The failure half of every Server Action result. `reason` is always safe to show. */
export interface ActionFailure {
  ok: false;
  code: AppErrorCode | 'unexpected';
  permanent: boolean;
  retryable: boolean;
  reason: string;
}

export const UNEXPECTED_REASON = 'Something went wrong. Please try again.';

export function failure(code: AppErrorCode, reason: string): ActionFailure {
  const permanent = PERMANENT[code];
  return { ok: false, code, permanent, retryable: !permanent, reason };
}

/** Turn anything thrown inside an action into a client-safe failure. */
export function toActionFailure(err: unknown, scope: string): ActionFailure {
  if (isAppError(err)) return failure(err.code, err.message);
  console.error(`[FairShift] Unexpected error in ${scope}:`, err);
  return {
    ok: false,
    code: 'unexpected',
    permanent: false,
    retryable: true,
    reason: UNEXPECTED_REASON,
  };
}

/** i18n key for a failed check-in, shown under the check-in buttons. */
export function checkinErrorKey(code: ActionFailure['code']): string {
  if (code === 'invalid_code') return 'checkin.err.invalid_code';
  if (code === 'outside_geofence') return 'checkin.err.outside';
  return 'checkin.err.generic';
}
