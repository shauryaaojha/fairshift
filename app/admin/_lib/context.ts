import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { verifySession, SESSION_COOKIE_NAME } from '@/src/server/auth/session';
import { allowedOrgIds } from '@/src/server/auth/guard';
import {
  SECTORS,
  SECTOR_COOKIE_NAME,
  resolveSector,
  sectorForOrg,
  type SectorConfig,
} from '@/src/server/services/sectors';
import type { Sector } from '@/src/shared/types';

export interface AdminContext {
  userId: string;
  orgId: string;
  sector: SectorConfig;
  /** Sectors this admin may switch between (one for a site admin, both for a regional admin). */
  allowedSectors: Sector[];
}

/**
 * Reads the signed session cookie and the sector switcher cookie.
 * Call only inside a <Suspense> boundary (it uses cookies()).
 * The sector defaults to the admin's own organisation, and the switcher cookie is
 * only honoured for organisations the signed session grants access to.
 */
export async function getAdminContext(): Promise<AdminContext> {
  const jar = await cookies();
  // Console data is live (SLA timers, on-site counts): render at request time.
  await connection();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? verifySession(token) : null;
  if (!session || session.role !== 'admin') redirect('/admin/login');

  const orgs = allowedOrgIds(session);
  const allowedSectors = (Object.keys(SECTORS) as Sector[]).filter((key) =>
    orgs.includes(SECTORS[key].orgId),
  );

  const chosen = jar.get(SECTOR_COOKIE_NAME)?.value;
  const wanted = chosen ? resolveSector(chosen) : sectorForOrg(session.orgId);
  const key = allowedSectors.includes(wanted) ? wanted : sectorForOrg(session.orgId);

  return { userId: session.userId, orgId: session.orgId, sector: SECTORS[key], allowedSectors };
}
