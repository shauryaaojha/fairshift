import type { SessionPayload } from '../../shared/types';

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
