'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  adminLoginSchema,
  askSchema,
  hazardIdSchema,
  hazardSeveritySchema,
} from '@/src/shared/schemas';
import { checkRateLimit } from '@/src/server/auth/rateLimit';
import { askAsAdmin } from '@/src/server/assistant/admin';
import type { AssistantAnswer, ChatTurn } from '@/src/server/assistant/engine';
import { failure, toActionFailure, type ActionFailure } from '@/src/shared/errors';
import { adminService } from '@/src/server/services/adminService';
import { checkLoginLimit, recordLoginFailure } from '@/src/server/auth/rateLimit';
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from '@/src/server/auth/session';
import {
  SECTOR_COOKIE_NAME,
  acknowledgeHazardForOrg,
  confirmHazardSeverity,
  resolveHazardForOrg,
  resolveSector,
  sectorForOrg,
} from '@/src/server/services/adminViews';
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

export type AskConsoleResult = { ok: true; answer: AssistantAnswer } | ActionFailure;

/** Ask the console, scoped to the sector this admin is viewing (and allowed to view). */
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
