import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "./src/server/auth/session";

/**
 * Next.js 16 proxy (replaces middleware.ts).
 * Protects /w/* and /admin/* routes by checking for a verified session cookie.
 * Public routes: /, /w/login, /admin/login, /passport/*, /api/auth/*, /api/passport/*
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — no session needed
  if (
    pathname === "/" ||
    pathname === "/w/login" ||
    pathname === "/admin/login" ||
    pathname.startsWith("/passport/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/passport/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? verifySession(token) : null;

  // Worker routes require a valid worker session
  if (pathname.startsWith("/w")) {
    if (!session || session.role !== "worker") {
      const loginUrl = new URL("/w/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // Admin routes require a valid admin session
  if (pathname.startsWith("/admin")) {
    if (!session || session.role !== "admin") {
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // Protected API routes require a valid session
  if (pathname.startsWith("/api/")) {
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
