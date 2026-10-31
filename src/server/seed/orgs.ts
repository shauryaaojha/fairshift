/**
 * Demo organisations and sites: a construction site in Chennai and a college campus.
 */
import type { Org, Site } from '../../shared/types';
import { deriveServerSecret } from '../auth/session';
import { INITIAL_PAY_RULES } from './payQueries';

export function generateOrgs(): Org[] {
  return [
    {
      id: 'org-construction',
      name: 'Skyline Infrastructure Ltd',
      sector: 'construction',
      policy: {
        dailyHoursLimit: 8,
        weeklyHoursLimit: 48,
        otMultiplier: 2.0,
        pfRate: 0.12,
        pfCeiling: 15000,
        esiRate: 0.0075,
        esiCeiling: 21000,
        anonymityK: 3,
      },
      payRuleHistory: [INITIAL_PAY_RULES],
    },
    {
      id: 'org-college',
      name: 'SRM Institute Facilities Management',
      sector: 'college',
      policy: {
        dailyHoursLimit: 8,
        weeklyHoursLimit: 48,
        otMultiplier: 2.0,
        pfRate: 0.12,
        pfCeiling: 15000,
        esiRate: 0.0075,
        esiCeiling: 21000,
        anonymityK: 3,
      },
      payRuleHistory: [INITIAL_PAY_RULES],
    },
  ];
}

export function generateSites(): Site[] {
  return [
    {
      id: 'site-skyline-chennai',
      orgId: 'org-construction',
      name: 'Skyline Towers, Guindy, Chennai',
      lat: 13.0067,
      lng: 80.2023,
      radiusMetres: 250,
      qrSecret: deriveServerSecret('qr:site-skyline-chennai'),
    },
    {
      id: 'site-srm-campus',
      orgId: 'org-college',
      name: 'SRM Tech Park Campus, Kattankulathur',
      lat: 12.823,
      lng: 80.045,
      radiusMetres: 400,
      qrSecret: deriveServerSecret('qr:site-srm-campus'),
    },
  ];
}
