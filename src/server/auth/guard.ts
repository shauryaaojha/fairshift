// ============================================================
// FairShift — Auth Guard: Centralized Route & Session Verification
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE_NAME } from './session';
import type { SessionPayload, SessionRole } from '../../shared/types';

export interface GuardResult {
  session: SessionPayload | null;
  errorResponse?: NextResponse;
}

/**
 * Enforces authenticated session on API route handlers.
 * Optionally restricts by required role ('worker' | 'admin').
 */
export function requireSession(
  request: NextRequest,
  requiredRole?: SessionRole
): { session: SessionPayload } | { errorResponse: NextResponse } {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: Session missing' },
        { status: 401 }
      ),
    };
  }

  const session = verifySession(token);
  if (!session) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: Session invalid or expired' },
        { status: 401 }
      ),
    };
  }

  if (requiredRole && session.role !== requiredRole) {
    return {
      errorResponse: NextResponse.json(
        { error: `Forbidden: Requires ${requiredRole} privileges` },
        { status: 403 }
      ),
    };
  }

  return { session };
}

/** Organisations a session may access. Workers are always limited to their own. */
export function allowedOrgIds(session: SessionPayload): string[] {
  if (session.role === 'admin' && session.orgIds && session.orgIds.length > 0) {
    return session.orgIds;
  }
  return [session.orgId];
}

export function canAccessOrg(session: SessionPayload, orgId: string): boolean {
  return allowedOrgIds(session).includes(orgId);
}

/**
 * Resolves the organisation an admin request targets. With no explicit request it
 * is the admin's home org; a request for an org outside the session gets a 403.
 */
export function resolveOrgScope(
  session: SessionPayload,
  requested: string | null | undefined
): { orgId: string } | { errorResponse: NextResponse } {
  const orgId = requested || session.orgId;
  if (!canAccessOrg(session, orgId)) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Forbidden: No access to this organisation' },
        { status: 403 }
      ),
    };
  }
  return { orgId };
}
