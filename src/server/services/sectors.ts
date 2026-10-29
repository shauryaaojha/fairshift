/**
 * The two live sectors and how a console session picks one. A sector maps to one organisation
 * and its demo site; the switcher only offers sectors the signed session may access.
 */

import type { Sector } from '../../shared/types';

export interface SectorConfig {
  key: Sector;
  orgId: string;
  siteId: string;
  label: string;
  place: string;
}

export const SECTORS: Record<Sector, SectorConfig> = {
  construction: {
    key: 'construction',
    orgId: 'org-construction',
    siteId: 'site-skyline-chennai',
    label: 'Construction',
    place: 'Skyline Towers',
  },
  college: {
    key: 'college',
    orgId: 'org-college',
    siteId: 'site-srm-campus',
    label: 'College',
    place: 'Campus Facilities',
  },
};

export const SECTOR_COOKIE_NAME = 'fairshift_sector';

export function resolveSector(value: string | null | undefined): Sector {
  return value === 'college' ? 'college' : 'construction';
}

export function sectorForOrg(orgId: string): Sector {
  return orgId === SECTORS.college.orgId ? 'college' : 'construction';
}
