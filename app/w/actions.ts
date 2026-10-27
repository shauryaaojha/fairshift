'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { workerService } from '@/src/server/services/workerService';
import {
  checkinErrorCode,
  explainMyPayslip,
  formatClock,
  getLocale,
  getWorkerContext,
  validateWorkerNext,
  type CheckinErrorCode,
} from '@/src/server/services/workerViews';
import { checkLoginLimit, checkRateLimit, recordLoginFailure } from '@/src/server/auth/rateLimit';
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from '@/src/server/auth/session';
import {
  checkinGpsSchema,
  checkinQrSchema,
  checkoutSchema,
  feedbackSchema,
  hazardReportSchema,
  workerLoginSchema,
} from '@/src/shared/schemas';
import { LOCALE_COOKIE, parseLocale } from '@/src/i18n';

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Form action: remember the language, then go on. Works without JavaScript. */
export async function setLanguageAction(formData: FormData): Promise<void> {
  const locale = parseLocale(String(formData.get('locale') ?? ''));
  if (!locale) return;
  const jar = await cookies();
  jar.set({ name: LOCALE_COOKIE, value: locale, path: '/', maxAge: ONE_YEAR, sameSite: 'lax' });
  const next = String(formData.get('next') ?? '');
  const signedIn = await getWorkerContext();
  if (next.startsWith('/w') && !next.startsWith('//')) {
    redirect(signedIn && next === '/w/login' ? '/w' : next);
  }
  redirect(signedIn ? '/w' : '/w/login');
}

export type LoginResult =
  { ok: true; redirectTo: string } | { ok: false; error: 'wrong' | 'too_many' };

export async function loginAction(phone: string, pin: string, next?: string): Promise<LoginResult> {
  const parsed = workerLoginSchema.safeParse({ phone, pin });
  if (!parsed.success) return { ok: false, error: 'wrong' };
  if (!checkLoginLimit('worker', await headers(), parsed.data.phone).allowed) {
    return { ok: false, error: 'too_many' };
  }
  try {
    const { token } = await workerService.login(parsed.data.phone, parsed.data.pin);
    const jar = await cookies();
    jar.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    });
    return { ok: true, redirectTo: validateWorkerNext(next) };
  } catch {
    recordLoginFailure('worker', parsed.data.phone);
    return { ok: false, error: 'wrong' };
  }
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE_NAME);
  redirect('/w/login');
}

export type CheckInErrorOrAuth = CheckinErrorCode | 'auth';

export type CheckinResult =
  | { ok: true; time: string; already: boolean; shiftId: string }
  | {
      ok: false;
      code: CheckInErrorOrAuth;
      permanent: boolean;
      retryable: boolean;
      reason?: string;
    };

export type CheckinInput = {
  code?: string;
  lat?: number;
  lng?: number;
  capturedAt?: string;
  clientId?: string;
};

function isPermanentError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('invalid capture time') ||
    m.includes('invalid or expired') ||
    m.includes('outside site geofence') ||
    m.includes('check-out time must be after check-in time') ||
    m.includes('shift record not found') ||
    m.includes('not found') ||
    m.includes('provide a valid qr code')
  );
}

export async function checkInAction(input: CheckinInput): Promise<CheckinResult> {
  const ctx = await getWorkerContext();
  if (!ctx) {
    return {
      ok: false,
      code: 'auth',
      permanent: true,
      retryable: false,
      reason: 'Not authenticated',
    };
  }
  // 6 tries a minute: enough for a fumbled scan, far too few to guess a 6-digit code.
  if (!checkRateLimit(`checkin:${ctx.worker.id}`, 6, 60 * 1000).allowed) {
    return {
      ok: false,
      code: 'generic',
      permanent: false,
      retryable: true,
      reason: 'Rate limit exceeded',
    };
  }

  if (input.code !== undefined) {
    const parsed = checkinQrSchema.safeParse({
      siteId: ctx.site.id,
      code: input.code,
      capturedAt: input.capturedAt,
      clientId: input.clientId,
    });
    if (!parsed.success) {
      return {
        ok: false,
        code: 'invalid_code',
        permanent: true,
        retryable: false,
        reason: parsed.error.issues[0]?.message,
      };
    }
  } else if (input.lat !== undefined && input.lng !== undefined) {
    const parsed = checkinGpsSchema.safeParse({
      siteId: ctx.site.id,
      lat: input.lat,
      lng: input.lng,
      capturedAt: input.capturedAt,
      clientId: input.clientId,
    });
    if (!parsed.success) {
      return {
        ok: false,
        code: 'outside',
        permanent: true,
        retryable: false,
        reason: parsed.error.issues[0]?.message,
      };
    }
  } else {
    return {
      ok: false,
      code: 'generic',
      permanent: true,
      retryable: false,
      reason: 'Provide a valid QR code or GPS location to check in',
    };
  }

  try {
    const { shift, message } = await workerService.checkIn(ctx.worker.id, {
      siteId: ctx.site.id,
      code: input.code,
      lat: input.lat,
      lng: input.lng,
      capturedAt: input.capturedAt,
      clientId: input.clientId,
    });
    return {
      ok: true,
      time: formatClock(shift.checkIn),
      already: message === 'Already checked in',
      shiftId: shift.id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const permanent = isPermanentError(message);
    return {
      ok: false,
      code: checkinErrorCode(message),
      permanent,
      retryable: !permanent,
      reason: message,
    };
  }
}

export type CheckoutInput = {
  shiftId?: string;
  capturedAt?: string;
  clientId?: string;
};

export type CheckoutResult =
  | { ok: true; time: string; shiftId: string }
  | { ok: false; permanent: boolean; retryable: boolean; reason?: string };

export async function checkOutAction(input?: CheckoutInput): Promise<CheckoutResult> {
  const ctx = await getWorkerContext();
  if (!ctx) {
    return { ok: false, permanent: true, retryable: false, reason: 'Not authenticated' };
  }
  if (!checkRateLimit(`checkout:${ctx.worker.id}`, 6, 60 * 1000).allowed) {
    return { ok: false, permanent: false, retryable: true, reason: 'Rate limit exceeded' };
  }

  let shiftId = input?.shiftId;
  let capturedAt = input?.capturedAt;
  let clientId = input?.clientId;

  if (input) {
    const parsed = checkoutSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        permanent: true,
        retryable: false,
        reason: parsed.error.issues[0]?.message,
      };
    }
    shiftId = parsed.data.shiftId;
    capturedAt = parsed.data.capturedAt;
    clientId = parsed.data.clientId;
  }

  try {
    const shift = await workerService.checkOut(ctx.worker.id, shiftId, {
      capturedAt,
      clientId,
    });
    return {
      ok: true,
      time: formatClock(shift.checkOut ?? new Date().toISOString()),
      shiftId: shift.id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const permanent = isPermanentError(message);
    return { ok: false, permanent, retryable: !permanent, reason: message };
  }
}

export type HazardInput = {
  category: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  anonymous: boolean;
  capturedAt?: string;
  clientId?: string;
};
export type HazardResult =
  { ok: true; id: string } | { ok: false; permanent: boolean; retryable: boolean; reason?: string };

export async function reportHazardAction(input: HazardInput): Promise<HazardResult> {
  const ctx = await getWorkerContext();
  if (!ctx) {
    return { ok: false, permanent: true, retryable: false, reason: 'Not authenticated' };
  }
  if (!checkRateLimit(`hazard:${ctx.worker.id}`, 5, 60 * 1000).allowed) {
    return { ok: false, permanent: false, retryable: true, reason: 'Rate limit exceeded' };
  }
  const parsed = hazardReportSchema.safeParse({ ...input, siteId: ctx.site.id });
  if (!parsed.success) {
    return {
      ok: false,
      permanent: true,
      retryable: false,
      reason: parsed.error.issues[0]?.message,
    };
  }
  try {
    const hazard = await workerService.reportHazard(ctx.worker.id, parsed.data);
    return { ok: true, id: hazard.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const permanent = isPermanentError(message);
    return { ok: false, permanent, retryable: !permanent, reason: message };
  }
}

export type FeedbackInput = {
  managerRespect: number;
  safetyRating: number;
  payFairness: number;
  workloadRating: number;
  comment: string | null;
  capturedAt?: string;
  clientId?: string;
};

export type FeedbackResult =
  { ok: true } | { ok: false; permanent: boolean; retryable: boolean; reason?: string };

export async function submitFeedbackAction(input: FeedbackInput): Promise<FeedbackResult> {
  const ctx = await getWorkerContext();
  if (!ctx) {
    return { ok: false, permanent: true, retryable: false, reason: 'Not authenticated' };
  }
  if (!checkRateLimit(`feedback:${ctx.worker.id}`, 3, 60 * 60 * 1000).allowed) {
    return { ok: false, permanent: false, retryable: true, reason: 'Rate limit exceeded' };
  }
  const parsed = feedbackSchema.safeParse({
    ...input,
    comment: input.comment?.trim() ? input.comment.trim() : null,
    siteId: ctx.site.id,
  });
  if (!parsed.success) {
    return {
      ok: false,
      permanent: true,
      retryable: false,
      reason: parsed.error.issues[0]?.message,
    };
  }
  try {
    await workerService.submitFeedback(ctx.worker.id, parsed.data);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const permanent = isPermanentError(message);
    return { ok: false, permanent, retryable: !permanent, reason: message };
  }
}

export async function explainPayAction(): Promise<{ text: string; isAi: boolean } | null> {
  const ctx = await getWorkerContext();
  if (!ctx) return null;
  if (!checkRateLimit(`explain:${ctx.worker.id}`, 5, 60 * 1000).allowed) return null;
  const locale = (await getLocale()) ?? ctx.worker.locale;
  try {
    return await explainMyPayslip(ctx.worker.id, locale);
  } catch {
    return null;
  }
}
