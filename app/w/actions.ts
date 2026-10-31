'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { workerService } from '@/src/server/services/workerService';
import {
  explainMyPayslip,
  formatClock,
  getLocale,
  getWorkerContext,
  validateWorkerNext,
  type WorkerContext,
} from '@/src/server/services/workerViews';
import { checkLoginLimit, checkRateLimit, recordLoginFailure } from '@/src/server/auth/rateLimit';
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from '@/src/server/auth/session';
import {
  checkinGpsSchema,
  checkinQrSchema,
  checkoutSchema,
  feedbackSchema,
  askSchema,
  hazardReportSchema,
  hazardVerdictSchema,
  payQueryRaiseSchema,
  payQueryVerdictSchema,
  workerLoginSchema,
} from '@/src/shared/schemas';
import { askAsWorker } from '@/src/server/assistant/worker';
import type { AssistantAnswer, ChatTurn } from '@/src/server/assistant/engine';
import { failure, toActionFailure, type ActionFailure } from '@/src/shared/errors';
import { LOCALE_COOKIE, parseLocale } from '@/src/i18n';

const ONE_YEAR = 60 * 60 * 24 * 365;
const MINUTE = 60 * 1000;

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

/**
 * Shared frame for every worker mutation: require a session, apply a per-worker rate limit,
 * then run the use-case and turn anything it throws into a client-safe `ActionFailure`.
 */
async function runWorkerAction<T>(
  scope: string,
  limit: { max: number; windowMs: number },
  run: (ctx: WorkerContext) => Promise<T | ActionFailure>,
): Promise<T | ActionFailure> {
  const ctx = await getWorkerContext();
  if (!ctx) return failure('auth', 'Not authenticated');
  if (!checkRateLimit(`${scope}:${ctx.worker.id}`, limit.max, limit.windowMs).allowed) {
    return failure('rate_limited', 'Too many attempts. Wait a minute and try again.');
  }
  try {
    return await run(ctx);
  } catch (err) {
    return toActionFailure(err, scope);
  }
}

function invalid(issues: { message: string }[]): ActionFailure {
  return failure('validation', issues[0]?.message ?? 'Invalid input');
}

export type CheckinResult =
  { ok: true; time: string; already: boolean; shiftId: string } | ActionFailure;

export type CheckinInput = {
  code?: string;
  lat?: number;
  lng?: number;
  capturedAt?: string;
  clientId?: string;
};

export async function checkInAction(input: CheckinInput): Promise<CheckinResult> {
  // 6 tries a minute: enough for a fumbled scan, far too few to guess a 6-digit code.
  return runWorkerAction('checkin', { max: 6, windowMs: MINUTE }, async (ctx) => {
    const common = { siteId: ctx.site.id, capturedAt: input.capturedAt, clientId: input.clientId };
    let parsed;
    if (input.code !== undefined) {
      parsed = checkinQrSchema.safeParse({ ...common, code: input.code });
      if (!parsed.success) return failure('invalid_code', 'Enter the 6-digit code from the gate');
    } else if (input.lat !== undefined && input.lng !== undefined) {
      parsed = checkinGpsSchema.safeParse({ ...common, lat: input.lat, lng: input.lng });
      if (!parsed.success) return invalid(parsed.error.issues);
    } else {
      return failure('no_checkin_method', 'Provide a valid QR code or GPS location to check in');
    }

    const { shift, message } = await workerService.checkIn(ctx.worker.id, parsed.data);
    return {
      ok: true,
      time: formatClock(shift.checkIn),
      already: message === 'Already checked in',
      shiftId: shift.id,
    };
  });
}

export type CheckoutInput = {
  shiftId?: string;
  capturedAt?: string;
  clientId?: string;
};

export type CheckoutResult = { ok: true; time: string; shiftId: string } | ActionFailure;

export async function checkOutAction(input: CheckoutInput = {}): Promise<CheckoutResult> {
  return runWorkerAction('checkout', { max: 6, windowMs: MINUTE }, async (ctx) => {
    const parsed = checkoutSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error.issues);
    const shift = await workerService.checkOut(ctx.worker.id, parsed.data);
    return {
      ok: true,
      time: formatClock(shift.checkOut ?? new Date().toISOString()),
      shiftId: shift.id,
    };
  });
}

export type HazardInput = {
  category: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  anonymous: boolean;
  capturedAt?: string;
  clientId?: string;
};
export type HazardResult = { ok: true; id: string } | ActionFailure;

export async function reportHazardAction(input: HazardInput): Promise<HazardResult> {
  return runWorkerAction('hazard', { max: 5, windowMs: MINUTE }, async (ctx) => {
    const parsed = hazardReportSchema.safeParse({ ...input, siteId: ctx.site.id });
    if (!parsed.success) return invalid(parsed.error.issues);
    const hazard = await workerService.reportHazard(ctx.worker.id, parsed.data);
    return { ok: true, id: hazard.id };
  });
}

export type VerdictResult = { ok: true; reopened: boolean } | ActionFailure;

/** The reporter answers "is it really fixed?" on a resolved report. */
export async function hazardVerdictAction(
  hazardId: string,
  verdict: 'fixed' | 'not_fixed',
): Promise<VerdictResult> {
  return runWorkerAction('verdict', { max: 10, windowMs: MINUTE }, async (ctx) => {
    const parsed = hazardVerdictSchema.safeParse({ hazardId, verdict });
    if (!parsed.success) return invalid(parsed.error.issues);
    await workerService.giveHazardVerdict(ctx.worker.id, parsed.data.hazardId, parsed.data.verdict);
    return { ok: true, reopened: parsed.data.verdict === 'not_fixed' };
  });
}

export type PayQueryRaiseInput = {
  reason: 'short_pay' | 'unpaid_overtime' | 'wrong_deduction' | 'late_pay';
  receivedAmount: number | null;
  note: string | null;
  clientId?: string;
};
export type PayQueryRaiseResult = { ok: true; id: string; already: boolean } | ActionFailure;

/** Raise a question about this month's pay. The payslip figure is worked out on the server. */
export async function raisePayQueryAction(input: PayQueryRaiseInput): Promise<PayQueryRaiseResult> {
  return runWorkerAction('payquery', { max: 5, windowMs: 60 * MINUTE }, async (ctx) => {
    const note = input.note?.trim() || null;
    const parsed = payQueryRaiseSchema.safeParse({ ...input, note });
    if (!parsed.success) return invalid(parsed.error.issues);
    const { query, already } = await workerService.raisePayQuery(ctx.worker.id, parsed.data);
    return { ok: true, id: query.id, already };
  });
}

export type PayVerdictResult = { ok: true; reopened: boolean } | ActionFailure;

/** The worker answers "is your pay now right?" on an answered query. */
export async function payQueryVerdictAction(
  queryId: string,
  verdict: 'settled' | 'not_settled',
): Promise<PayVerdictResult> {
  return runWorkerAction('payverdict', { max: 10, windowMs: MINUTE }, async (ctx) => {
    const parsed = payQueryVerdictSchema.safeParse({ queryId, verdict });
    if (!parsed.success) return invalid(parsed.error.issues);
    await workerService.givePayVerdict(ctx.worker.id, parsed.data.queryId, parsed.data.verdict);
    return { ok: true, reopened: parsed.data.verdict === 'not_settled' };
  });
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

export type FeedbackResult = { ok: true } | ActionFailure;

export async function submitFeedbackAction(input: FeedbackInput): Promise<FeedbackResult> {
  return runWorkerAction('feedback', { max: 3, windowMs: 60 * MINUTE }, async (ctx) => {
    const comment = input.comment?.trim() || null;
    const parsed = feedbackSchema.safeParse({ ...input, comment, siteId: ctx.site.id });
    if (!parsed.success) return invalid(parsed.error.issues);
    await workerService.submitFeedback(ctx.worker.id, parsed.data);
    return { ok: true };
  });
}

export async function explainPayAction(): Promise<{ text: string; isAi: boolean } | null> {
  const ctx = await getWorkerContext();
  if (!ctx) return null;
  if (!checkRateLimit(`explain:${ctx.worker.id}`, 5, MINUTE).allowed) return null;
  const locale = (await getLocale()) ?? ctx.worker.locale;
  try {
    return await explainMyPayslip(ctx.worker.id, locale);
  } catch (err) {
    console.error('[FairShift] explainPayAction failed:', err);
    return null;
  }
}

export type AskResult = { ok: true; answer: AssistantAnswer } | ActionFailure;

/** Urima, the assistant. Answers only from this worker's own records (see src/server/assistant). */
export async function askAction(question: string, history: ChatTurn[] = []): Promise<AskResult> {
  // 8 questions a minute per worker keeps AI cost bounded and stops scripted abuse.
  return runWorkerAction('ask', { max: 8, windowMs: MINUTE }, async (ctx) => {
    const parsed = askSchema.safeParse({ question, history });
    if (!parsed.success) return invalid(parsed.error.issues);
    const locale = (await getLocale()) ?? ctx.worker.locale;
    const answer = await askAsWorker(ctx, locale, parsed.data.question, parsed.data.history);
    return { ok: true, answer };
  });
}
