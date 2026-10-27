import { NextRequest, NextResponse } from 'next/server';
import { workerLoginSchema } from '@/src/shared/schemas';
import { workerService } from '@/src/server/services/workerService';
import { checkLoginLimit, recordLoginFailure } from '@/src/server/auth/rateLimit';
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from '@/src/server/auth/session';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  const parsed = workerLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.issues[0]?.message },
      { status: 400 }
    );
  }

  const limit = checkLoginLimit('worker', request.headers, parsed.data.phone);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Too many login attempts. Try again in ${limit.retryAfterSeconds}s.` },
      { status: 429 }
    );
  }

  try {
    const { worker, token } = await workerService.login(parsed.data.phone, parsed.data.pin);

    const response = NextResponse.json({
      data: { worker },
      message: 'Logged in successfully',
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    });

    return response;
  } catch {
    recordLoginFailure('worker', parsed.data.phone);
    // One message for every failure, so the response never reveals whether the account exists.
    return NextResponse.json({ error: 'Wrong phone number or PIN' }, { status: 401 });
  }
}
