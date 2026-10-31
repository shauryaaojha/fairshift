import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE_NAME } from './src/server/auth/session';

/**
 * Next.js 16 proxy (replaces middleware.ts).
 * Protects /w/* and /admin/* routes by checking for a verified session cookie.
 * Public routes: /, /w/login, /admin/login, /passport/*, /verify/*
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — no session needed
  if (
    pathname === '/' ||
    pathname === '/w/login' ||
    pathname === '/admin/login' ||
    pathname.startsWith('/passport/') ||
    pathname.startsWith('/verify/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? verifySession(token) : null;

  // Worker routes require a valid worker session
  if (pathname.startsWith('/w')) {
    if (!session || session.role !== 'worker') {
      const target = `${pathname}${request.nextUrl.search}`;
      const loginUrl = new URL('/w/login', request.url);
      loginUrl.searchParams.set('next', target);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // Admin routes require a valid admin session
  if (pathname.startsWith('/admin')) {
    if (!session || session.role !== 'admin') {
      const loginUrl = new URL('/admin/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
