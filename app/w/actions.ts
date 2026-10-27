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
import { feedbackSchema, hazardReportSchema, workerLoginSchema } from '@/src/shared/schemas';
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

export type CheckinResult =
  | { ok: true; time: string; already: boolean; shiftId: string }
  | { ok: false; code: CheckInErrorOrAuth };
type CheckInErrorOrAuth = CheckinErrorCode | 'auth';

export async function checkInAction(input: {
  code?: string;
  lat?: number;
  lng?: number;
}): Promise<CheckinResult> {
  const ctx = await getWorkerContext();
  if (!ctx) return { ok: false, code: 'auth' };
  // 6 tries a minute: enough for a fumbled scan, far too few to guess a 6-digit code.
  if (!checkRateLimit(`checkin:${ctx.worker.id}`, 6, 60 * 1000).allowed) {
    return { ok: false, code: 'generic' };
  }
  try {
    const { shift, message } = await workerService.checkIn(ctx.worker.id, {
      siteId: ctx.site.id,
      code: input.code,
      lat: input.lat,
      lng: input.lng,
    });
    return {
      ok: true,
      time: formatClock(shift.checkIn),
      already: message === 'Already checked in',
      shiftId: shift.id,
    };
  } catch (err) {
    return { ok: false, code: checkinErrorCode(err instanceof Error ? err.message : '') };
  }
}

export type CheckoutResult = { ok: true; time: string; shiftId: string } | { ok: false };

export async function checkOutAction(): Promise<CheckoutResult> {
  const ctx = await getWorkerContext();
  if (!ctx) return { ok: false };
  try {
    const status = await workerService.getTodayStatus(ctx.worker.id);
    if (!status.activeShift) return { ok: false };
    const shift = await workerService.checkOut(ctx.worker.id, status.activeShift.id);
    return {
      ok: true,
      time: formatClock(shift.checkOut ?? new Date().toISOString()),
      shiftId: shift.id,
    };
  } catch {
    return { ok: false };
  }
}

export type HazardInput = {
  category: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  anonymous: boolean;
};
export type HazardResult = { ok: true; id: string } | { ok: false };

export async function reportHazardAction(input: HazardInput): Promise<HazardResult> {
  const ctx = await getWorkerContext();
  if (!ctx) return { ok: false };
  if (!checkRateLimit(`hazard:${ctx.worker.id}`, 5, 60 * 1000).allowed) return { ok: false };
  const parsed = hazardReportSchema.safeParse({ ...input, siteId: ctx.site.id });
  if (!parsed.success) return { ok: false };
  try {
    const hazard = await workerService.reportHazard(ctx.worker.id, parsed.data);
    return { ok: true, id: hazard.id };
  } catch {
    return { ok: false };
  }
}

export type FeedbackInput = {
  managerRespect: number;
  safetyRating: number;
  payFairness: number;
  workloadRating: number;
  comment: string | null;
};

export async function submitFeedbackAction(input: FeedbackInput): Promise<{ ok: boolean }> {
  const ctx = await getWorkerContext();
  if (!ctx) return { ok: false };
  if (!checkRateLimit(`feedback:${ctx.worker.id}`, 3, 60 * 60 * 1000).allowed) return { ok: false };
  const parsed = feedbackSchema.safeParse({
    ...input,
    comment: input.comment?.trim() ? input.comment.trim() : null,
    siteId: ctx.site.id,
  });
  if (!parsed.success) return { ok: false };
  try {
    await workerService.submitFeedback(ctx.worker.id, parsed.data);
    return { ok: true };
  } catch {
    return { ok: false };
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
