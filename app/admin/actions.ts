'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  adminLoginSchema,
  askSchema,
  hazardIdSchema,
  hazardSeveritySchema,
  payAnswerSchema,
  payRulesSchema,
  wagePaymentSchema,
} from '@/src/shared/schemas';
import { checkRateLimit } from '@/src/server/auth/rateLimit';
import { askAsAdmin } from '@/src/server/assistant/admin';
import type { AssistantAnswer, ChatTurn } from '@/src/server/assistant/engine';
import { failure, isAppError, toActionFailure, type ActionFailure } from '@/src/shared/errors';
import { adminService } from '@/src/server/services/adminService';
import { checkLoginLimit, recordLoginFailure } from '@/src/server/auth/rateLimit';
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from '@/src/server/auth/session';
import { SECTOR_COOKIE_NAME, resolveSector, sectorForOrg } from '@/src/server/services/sectors';
import {
  acknowledgeHazardForOrg,
  confirmHazardSeverity,
  resolveHazardForOrg,
} from '@/src/server/services/adminPages';
import {
  answerPayQueryForOrg,
  recordWagePaymentForOrg,
  schedulePayRulesForOrg,
} from '@/src/server/services/adminPay';
import { getAdminContext } from './_lib/context';

export interface LoginState {
  ok: boolean;
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = adminLoginSchema.safeParse({
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Check your email and password.',
    };
  }

  const limit = checkLoginLimit('admin', await headers(), parsed.data.email);
  if (!limit.allowed) {
    return {
      ok: false,
      error: `Too many attempts. Try again in ${limit.retryAfterSeconds} seconds.`,
    };
  }

  try {
    const { admin, token } = await adminService.login(parsed.data.email, parsed.data.password);
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
    jar.set({
      name: SECTOR_COOKIE_NAME,
      value: sectorForOrg(admin.orgId),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    });
    return { ok: true };
  } catch {
    recordLoginFailure('admin', parsed.data.email);
    return { ok: false, error: 'Wrong email or password.' };
  }
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE_NAME);
  redirect('/admin/login');
}

export async function setSectorAction(formData: FormData): Promise<void> {
  const ctx = await getAdminContext();
  const sector = resolveSector(String(formData.get('sector') ?? ''));
  if (!ctx.allowedSectors.includes(sector)) return;
  const jar = await cookies();
  jar.set({
    name: SECTOR_COOKIE_NAME,
    value: sector,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  revalidatePath('/admin', 'layout');
}

/** Parse the hazard id posted by a console form; a tampered id is ignored, never thrown. */
function hazardIdFrom(formData: FormData): string | null {
  const parsed = hazardIdSchema.safeParse(formData.get('id'));
  return parsed.success ? parsed.data : null;
}

export async function acknowledgeAction(formData: FormData): Promise<void> {
  const ctx = await getAdminContext();
  const id = hazardIdFrom(formData);
  if (!id) return;
  await acknowledgeHazardForOrg(id, ctx.sector.orgId);
  revalidatePath('/admin', 'layout');
}

export async function resolveAction(formData: FormData): Promise<void> {
  const ctx = await getAdminContext();
  const id = hazardIdFrom(formData);
  if (!id) return;
  await resolveHazardForOrg(id, ctx.sector.orgId);
  revalidatePath('/admin', 'layout');
}

export async function confirmSeverityAction(formData: FormData): Promise<void> {
  const ctx = await getAdminContext();
  const id = hazardIdFrom(formData);
  const severity = hazardSeveritySchema.safeParse(formData.get('severity'));
  if (!id || !severity.success) return;
  await confirmHazardSeverity(id, ctx.sector.orgId, severity.data);
  revalidatePath('/admin', 'layout');
}

/** Result of a console form that reports back inline (useActionState). */
export interface FormState {
  ok: boolean;
  error?: string;
  message?: string;
}

/** Runs a console form: rate limit per admin, then a safe message for any failure. */
async function runConsoleForm(
  scope: string,
  run: (ctx: Awaited<ReturnType<typeof getAdminContext>>) => Promise<FormState>,
): Promise<FormState> {
  const ctx = await getAdminContext();
  if (!checkRateLimit(`${scope}:${ctx.userId}`, 20, 60 * 1000).allowed) {
    return { ok: false, error: 'Too many changes. Wait a minute and try again.' };
  }
  try {
    const state = await run(ctx);
    if (state.ok) revalidatePath('/admin', 'layout');
    return state;
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    return { ok: false, error: toActionFailure(err, scope).reason };
  }
}

/** The employer answers a worker's pay query; the worker then says whether it is settled. */
export async function answerPayQueryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return runConsoleForm('payanswer', async (ctx) => {
    const parsed = payAnswerSchema.safeParse({
      id: formData.get('id'),
      text: String(formData.get('text') ?? ''),
      correctedNet: String(formData.get('correctedNet') ?? '').replace(/[₹,\s]/g, ''),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the answer.' };
    }
    const { id, ...answer } = parsed.data;
    await answerPayQueryForOrg(id, ctx.sector.orgId, ctx.userId, answer);
    return { ok: true, message: 'Answer sent. The worker will be asked if it is settled.' };
  });
}

/** Records a month's wages as paid by UPI, with the bank's 12-digit reference. */
export async function recordWagePaymentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return runConsoleForm('wagepay', async (ctx) => {
    const parsed = wagePaymentSchema.safeParse({
      workerId: formData.get('workerId'),
      period: formData.get('period'),
      utr: String(formData.get('utr') ?? '').replace(/\s/g, ''),
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the UTR.' };
    }
    const paid = await recordWagePaymentForOrg(
      ctx.sector.orgId,
      ctx.sector.siteId,
      ctx.userId,
      parsed.data,
    );
    const amount = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(paid.amount);
    return { ok: true, message: `Recorded ₹${amount} as paid. The worker can see the UTR.` };
  });
}

/** Schedule new pay rules from a coming Monday. */
export async function schedulePayRulesAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return runConsoleForm('payrules', async (ctx) => {
    const parsed = payRulesSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the rules.' };
    }
    const { effectiveFrom, reason, ...rules } = parsed.data;
    const version = await schedulePayRulesForOrg(ctx.sector.orgId, ctx.userId, {
      rules,
      effectiveFrom,
      reason,
    });
    return { ok: true, message: `Scheduled from Monday ${version.effectiveFrom}.` };
  });
}

export type AskConsoleResult = { ok: true; answer: AssistantAnswer } | ActionFailure;

/** Urima in the console, scoped to the sector this admin is viewing (and allowed to view). */
export async function askConsoleAction(
  question: string,
  history: ChatTurn[] = [],
): Promise<AskConsoleResult> {
  const ctx = await getAdminContext();
  if (!checkRateLimit(`ask-admin:${ctx.userId}`, 12, 60 * 1000).allowed) {
    return failure('rate_limited', 'Too many questions. Wait a minute and try again.');
  }
  const parsed = askSchema.safeParse({ question, history });
  if (!parsed.success) return failure('validation', parsed.error.issues[0]?.message ?? 'Invalid');
  try {
    return {
      ok: true,
      answer: await askAsAdmin(ctx.sector, parsed.data.question, parsed.data.history),
    };
  } catch (err) {
    return toActionFailure(err, 'askConsoleAction');
  }
}
