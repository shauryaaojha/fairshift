import { NextRequest, NextResponse } from 'next/server';
import { adminLoginSchema } from '@/src/shared/schemas';
import { adminService } from '@/src/server/services/adminService';
import { checkLoginLimit, recordLoginFailure } from '@/src/server/auth/rateLimit';
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from '@/src/server/auth/session';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.issues[0]?.message },
      { status: 400 }
    );
  }

  const limit = checkLoginLimit('admin', request.headers, parsed.data.email);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Too many login attempts. Try again in ${limit.retryAfterSeconds}s.` },
      { status: 429 }
    );
  }

  try {
    const { admin, token } = await adminService.login(parsed.data.email, parsed.data.password);

    const response = NextResponse.json({
      data: { admin },
      message: 'Admin authenticated',
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
    recordLoginFailure('admin', parsed.data.email);
    // One message for every failure, so the response never reveals whether the account exists.
    return NextResponse.json({ error: 'Wrong email or password' }, { status: 401 });
  }
}
