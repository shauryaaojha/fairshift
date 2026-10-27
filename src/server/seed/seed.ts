// ============================================================
// FairShift — Seed Data Generator (Deterministic)
// Seeded PRNG for reproducible shifts, fatigue cases, OT and quit risks
// 2 Sectors: Construction (Skyline Towers) & College (SRM Campus Facilities)
// ============================================================

import type {
  Org,
  Site,
  Worker,
  Admin,
  Shift,
  HazardReport,
  FeedbackSubmission,
  SkillRecord,
} from '../../shared/types';
import { hashSecret } from '../auth/password';
import { deriveServerSecret } from '../auth/session';

// Derived lazily: the session secret is only required when the seed actually runs.
const passportSecret = () => deriveServerSecret('passport');
import { generateSkillVerifyToken } from '../domain/skills';
import { calculateIsoWeek } from '../domain/anonymity';

// Demo data is anchored to the current day so dashboards always show "today".
// The anchor is today's 08:00 IST (02:30 UTC) shift start, moved back a day if that is less
// than two hours ago, so every seeded timestamp is safely in the past.
const DAY_MS = 24 * 60 * 60 * 1000;
/** Computed when the seed runs, never at import (Next.js prerendering forbids Date.now() there). */
function demoAnchorMs(): number {
  const now = Date.now();
  const todayShiftStart = new Date(`${new Date(now).toISOString().slice(0, 10)}T02:30:00.000Z`).getTime(); // 08:00 IST
  return todayShiftStart > now - 2 * 60 * 60 * 1000 ? todayShiftStart - DAY_MS : todayShiftStart;
}
/** Roster positions of the deliberately overworked demo workers (1 = Ramesh's first crew-mate, 35 = a campus worker). */
const OVERWORKED_INDEXES = new Set([1, 4, 35]);

/**
 * Deterministic PRNG (Mulberry32)
 */
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SeedDataResult {
  orgs: Org[];
  sites: Site[];
  workers: Worker[];
  admins: Admin[];
  shifts: Shift[];
  hazards: HazardReport[];
  feedback: FeedbackSubmission[];
  skills: SkillRecord[];
}

export async function generateSeedData(): Promise<SeedDataResult> {
  const DEMO_ANCHOR_MS = demoAnchorMs();
  /** ISO timestamp `minutes` after the demo anchor (negative = before). */
  const atAnchor = (minutes: number) => new Date(DEMO_ANCHOR_MS + minutes * 60 * 1000).toISOString();
  const DEMO_WEEK = calculateIsoWeek(new Date(DEMO_ANCHOR_MS));

  const rand = mulberry32(20261027);

  // ── 1. Organisations ──────────────────────────────────────────
  const orgs: Org[] = [
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
    },
  ];

  // ── 2. Sites ──────────────────────────────────────────────────
  const sites: Site[] = [
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

  // Common demo credentials
  const defaultPinHash = await hashSecret('1234');
  const defaultAdminPasswordHash = await hashSecret('Admin@1234');

  // ── 3. Workers ────────────────────────────────────────────────
  const workers: Worker[] = [];

  // Primary demo worker 1: Construction Mason (Hindi)
  workers.push({
    id: 'worker-ramesh',
    orgId: 'org-construction',
    siteId: 'site-skyline-chennai',
    name: 'Ramesh Kumar',
    phone: '9876543210',
    pinHash: defaultPinHash,
    role: 'mason',
    payType: 'daily',
    basePay: 750,
    allowances: 250,
    team: 'Masonry',
    locale: 'hi',
    active: true,
  });

  // Construction workers (29 additional workers)
  const constructionRoles: Worker['role'][] = ['mason', 'helper', 'electrician', 'plumber'];
  const constructionTeams = ['Masonry', 'Electrical', 'Scaffolding', 'Earthworks'];
  const constructionNames = [
    'Rajesh Yadav', 'Suresh Sharma', 'Amit Verma', 'Vikas Patel', 'Manoj Tiwari',
    'Deepak Singh', 'Dinesh Rawat', 'Ajay Meena', 'Pradeep Paswan', 'Santosh Sahni',
    'Mohan Lal', 'Anil Kumar', 'Govind Prasad', 'Rakesh Mandal', 'Sunil Chauhan',
    'Babloo Soren', 'Munna Ansari', 'Subhash Yadav', 'Guddu Kumar', 'Pankaj Mishra',
    'Kallu Ram', 'Chhotu Pandit', 'Dharmendra Pal', 'Suraj Bind', 'Vijay Kewat',
    'Sonu Vishwakarma', 'Karan Oraon', 'Mahesh Gond', 'Kamlesh Bind'
  ];

  for (let i = 0; i < constructionNames.length; i++) {
    const role = constructionRoles[i % constructionRoles.length];
    const team = constructionTeams[i % constructionTeams.length];
    const isMonthly = i % 4 === 0;
    workers.push({
      id: `worker-const-${i + 1}`,
      orgId: 'org-construction',
      siteId: 'site-skyline-chennai',
      name: constructionNames[i],
      phone: `98765432${(i + 11).toString().padStart(2, '0')}`,
      pinHash: defaultPinHash,
      role,
      payType: isMonthly ? 'monthly' : 'daily',
      basePay: isMonthly ? 20000 + (i * 300) : 650 + (i % 5) * 50,
      allowances: isMonthly ? 1500 : 200,
      team,
      locale: i % 2 === 0 ? 'hi' : 'en',
      active: true,
    });
  }

  // Primary demo worker 2: College Housekeeping (Tamil)
  workers.push({
    id: 'worker-murugan',
    orgId: 'org-college',
    siteId: 'site-srm-campus',
    name: 'Murugan Swaminathan',
    phone: '9123456789',
    pinHash: defaultPinHash,
    role: 'housekeeping',
    payType: 'monthly',
    basePay: 18500,
    allowances: 1500,
    team: 'Housekeeping',
    locale: 'ta',
    active: true,
  });

  // College workers (19 additional workers)
  const collegeRoles: Worker['role'][] = ['housekeeping', 'security', 'maintenance', 'plumber'];
  const collegeTeams = ['Housekeeping', 'Security', 'Maintenance'];
  const collegeNames = [
    'Anbarasan K', 'Kavitha S', 'Selvi M', 'Saravanan P', 'Balan R',
    'Prakash V', 'Munisamy T', 'Karthik N', 'Malarvizhi D', 'Ganesan C',
    'Venkatesh S', 'Manikandan B', 'Thangaraj E', 'Kannan L', 'Sudha A',
    'Pandian G', 'Meenakshi R', 'Vijayalakshmi K', 'Dhanasekaran J'
  ];

  for (let i = 0; i < collegeNames.length; i++) {
    const role = collegeRoles[i % collegeRoles.length];
    const team = collegeTeams[i % collegeTeams.length];
    const isMonthly = i % 2 === 0;
    workers.push({
      id: `worker-coll-${i + 1}`,
      orgId: 'org-college',
      siteId: 'site-srm-campus',
      name: collegeNames[i],
      phone: `91234567${(i + 10).toString().padStart(2, '0')}`,
      pinHash: defaultPinHash,
      role,
      payType: isMonthly ? 'monthly' : 'daily',
      basePay: isMonthly ? 17500 + (i * 250) : 600 + (i % 4) * 40,
      allowances: isMonthly ? 1200 : 150,
      team,
      locale: i % 3 === 0 ? 'en' : 'ta',
      active: true,
    });
  }

  // ── 4. Admins ─────────────────────────────────────────────────
  const admins: Admin[] = [
    {
      id: 'admin-skyline',
      orgId: 'org-construction',
      name: 'Arunachalam Verma (Site Ops Lead)',
      email: 'admin.skyline@fairshift.org',
      passwordHash: defaultAdminPasswordHash,
    },
    {
      id: 'admin-campus',
      orgId: 'org-college',
      name: 'Dr. Priya Sundaram (Facilities Director)',
      email: 'admin.campus@fairshift.org',
      passwordHash: defaultAdminPasswordHash,
    },
    {
      // Regional HR lead with access to both organisations: demonstrates the sector switcher.
      id: 'admin-regional',
      orgId: 'org-construction',
      orgIds: ['org-construction', 'org-college'],
      name: 'Kavya Raman (Regional HR Lead)',
      email: 'admin.regional@fairshift.org',
      passwordHash: defaultAdminPasswordHash,
    },
  ];

  // ── 5. Shifts (21 days back) ──────────────────────────────────
  const shifts: Shift[] = [];
  const baseTimestamp = DEMO_ANCHOR_MS;
  let shiftCount = 1;

  for (let dayOffset = 21; dayOffset >= 0; dayOffset--) {
    const dayDate = new Date(baseTimestamp - dayOffset * 24 * 60 * 60 * 1000);
    const dateStr = dayDate.toISOString().slice(0, 10);

    for (const [index, worker] of workers.entries()) {
      // A few workers are deliberately overworked (no rest day, 11 h shifts) so the
      // fatigue and quit-risk engines have real cases to flag. Everyone else gets a
      // weekly rest day, like a normal roster.
      const overworked = OVERWORKED_INDEXES.has(index);
      if (!overworked && dayOffset > 0 && dayDate.getUTCDay() === index % 7) continue;

      // 85% attendance probability
      if (!overworked && rand() > 0.85 && dayOffset > 0) continue;

      // For today (dayOffset === 0), mark selected workers as on-site right now.
      // The primary construction demo worker starts checked out so the check-in flow can be shown.
      if (dayOffset === 0) {
        if (worker.id === 'worker-ramesh') continue;
        if (worker.id === 'worker-murugan' || rand() > 0.3) {
          shifts.push({
            id: `shift-${shiftCount++}`,
            workerId: worker.id,
            siteId: worker.siteId,
            orgId: worker.orgId,
            checkIn: `${dateStr}T02:30:00.000Z`,
            checkOut: null, // Still on site now!
            method: 'qr',
          });
        }
        continue;
      }

      // Past shifts: variation in shift hours to generate overtime & fatigue
      // Normal shift 8h, 20% of shifts run 9-11h
      const durationHours = overworked ? 11 : rand() < 0.08 ? 9.5 + Math.floor(rand() * 2) : 8;
      // Every shift starts at 08:00 IST (02:30 UTC).
      const checkInMs = Date.parse(`${dateStr}T02:30:00.000Z`);

      shifts.push({
        id: `shift-${shiftCount++}`,
        workerId: worker.id,
        siteId: worker.siteId,
        orgId: worker.orgId,
        checkIn: new Date(checkInMs).toISOString(),
        checkOut: new Date(checkInMs + durationHours * 60 * 60 * 1000).toISOString(),
        method: rand() > 0.2 ? 'qr' : 'gps',
      });
    }
  }

  // ── 6. Hazards ────────────────────────────────────────────────
  const hazards: HazardReport[] = [
    {
      id: 'hazard-1',
      orgId: 'org-construction',
      siteId: 'site-skyline-chennai',
      reporterId: 'worker-ramesh',
      category: 'Electrical Safety',
      description: 'Uncovered 440V high-voltage cable trench near Tower B foundation after monsoon puddle.',
      severity: 'critical',
      status: 'escalated', // Missed 1h acknowledgement SLA
      reportedAt: atAnchor(30),
      acknowledgedAt: null,
      resolvedAt: null,
      aiSummary: 'Critical 440V exposed electrical line immersed in rainwater posing acute shock risk near foundation.',
      aiSuggestedSeverity: 'critical',
      anonymous: false,
    },
    {
      id: 'hazard-2',
      orgId: 'org-construction',
      siteId: 'site-skyline-chennai',
      reporterId: null, // anonymous
      category: 'Fall Protection',
      description: 'Defective scaffolding coupler on 6th floor external staging vibrating heavily.',
      severity: 'high',
      status: 'acknowledged',
      reportedAt: atAnchor(-45),
      acknowledgedAt: atAnchor(-15),
      resolvedAt: null,
      aiSummary: 'Loose staging coupler at height requiring immediate scaffolding crew retightening.',
      aiSuggestedSeverity: 'high',
      anonymous: true,
    },
    {
      id: 'hazard-3',
      orgId: 'org-college',
      siteId: 'site-srm-campus',
      reporterId: 'worker-murugan',
      category: 'Slip & Fall',
      description: 'Chilled water pipe condensing and creating persistent slippery puddle on main auditorium stairs.',
      severity: 'medium',
      status: 'resolved',
      reportedAt: atAnchor(-21 * 60),
      acknowledgedAt: atAnchor(-20.5 * 60),
      resolvedAt: atAnchor(-18 * 60),
      aiSummary: 'A/C condensation runoff on stairs; anti-slip mats deployed and pipe re-insulated.',
      aiSuggestedSeverity: 'medium',
      anonymous: false,
    },
    {
      id: 'hazard-4',
      orgId: 'org-college',
      siteId: 'site-srm-campus',
      reporterId: null,
      category: 'Chemical / Cleaning',
      description: 'Exhaust fan stopped working in central chemical storage room in basement.',
      severity: 'low',
      status: 'reported',
      reportedAt: atAnchor(60),
      acknowledgedAt: null,
      resolvedAt: null,
      aiSummary: 'Basement ventilation issue in storage room, low immediate risk.',
      aiSuggestedSeverity: 'low',
      anonymous: true,
    },
  ];

  // ── 7. Feedback ───────────────────────────────────────────────
  const feedback: FeedbackSubmission[] = [
    // Masonry (4 entries: count >= 3, averages & comments available)
    {
      id: 'fb-1',
      orgId: 'org-construction',
      siteId: 'site-skyline-chennai',
      team: 'Masonry',
      isoWeek: DEMO_WEEK,
      managerRespect: 4,
      safetyRating: 4,
      payFairness: 5,
      workloadRating: 3,
      comment: 'Drinking water canisters were refilled on time this week.',
    },
    {
      id: 'fb-2',
      orgId: 'org-construction',
      siteId: 'site-skyline-chennai',
      team: 'Masonry',
      isoWeek: DEMO_WEEK,
      managerRespect: 5,
      safetyRating: 4,
      payFairness: 4,
      workloadRating: 4,
      comment: 'Good overtime transparency on the phone app.',
    },
    {
      id: 'fb-3',
      orgId: 'org-construction',
      siteId: 'site-skyline-chennai',
      team: 'Masonry',
      isoWeek: DEMO_WEEK,
      managerRespect: 4,
      safetyRating: 3,
      payFairness: 4,
      workloadRating: 3,
      comment: 'Need replacement helmets for new helpers joining tomorrow.',
    },
    {
      id: 'fb-4',
      orgId: 'org-construction',
      siteId: 'site-skyline-chennai',
      team: 'Masonry',
      isoWeek: DEMO_WEEK,
      managerRespect: 4,
      safetyRating: 5,
      payFairness: 5,
      workloadRating: 4,
      comment: 'Clear salary slip in Hindi helped me verify my base wages.',
    },

    // College Housekeeping (5 entries: count >= 3)
    {
      id: 'fb-5',
      orgId: 'org-college',
      siteId: 'site-srm-campus',
      team: 'Housekeeping',
      isoWeek: DEMO_WEEK,
      managerRespect: 5,
      safetyRating: 5,
      payFairness: 4,
      workloadRating: 4,
      comment: 'Sanitation chemicals are safely labeled in Tamil and English.',
    },
    {
      id: 'fb-6',
      orgId: 'org-college',
      siteId: 'site-srm-campus',
      team: 'Housekeeping',
      isoWeek: DEMO_WEEK,
      managerRespect: 4,
      safetyRating: 4,
      payFairness: 5,
      workloadRating: 3,
      comment: 'Break room water cooler is working well.',
    },
    {
      id: 'fb-7',
      orgId: 'org-college',
      siteId: 'site-srm-campus',
      team: 'Housekeeping',
      isoWeek: DEMO_WEEK,
      managerRespect: 4,
      safetyRating: 5,
      payFairness: 4,
      workloadRating: 4,
      comment: 'App voice guidance is very easy to use.',
    },

    // College Security (2 entries: count < 3 -> ANONYMITY SHIELD ACTIVE)
    {
      id: 'fb-8',
      orgId: 'org-college',
      siteId: 'site-srm-campus',
      team: 'Security',
      isoWeek: DEMO_WEEK,
      managerRespect: 3,
      safetyRating: 4,
      payFairness: 3,
      workloadRating: 2,
      comment: 'Night patrol flashlights need replacement batteries.',
    },
    {
      id: 'fb-9',
      orgId: 'org-college',
      siteId: 'site-srm-campus',
      team: 'Security',
      isoWeek: DEMO_WEEK,
      managerRespect: 4,
      safetyRating: 3,
      payFairness: 3,
      workloadRating: 3,
      comment: 'Guard post shelter fan needs repair.',
    },
  ];

  // ── 8. Skills ─────────────────────────────────────────────────
  const skills: SkillRecord[] = [
    {
      id: 'skill-1',
      workerId: 'worker-ramesh',
      orgId: 'org-construction',
      title: 'Structural Brick Masonry (Level 3)',
      issuer: 'National Skill Development Corporation (NSDC)',
      issuedDate: '2024-03-15',
      expiryDate: '2027-03-15',
      verifyToken: generateSkillVerifyToken('worker-ramesh', 'Structural Brick Masonry (Level 3)', '2024-03-15', passportSecret()),
      verified: true,
    },
    {
      id: 'skill-2',
      workerId: 'worker-ramesh',
      orgId: 'org-construction',
      title: 'Scaffolding Safety & Fall Arrest Certification',
      issuer: 'L&T Construction Skills Training Institute',
      issuedDate: '2025-01-10',
      expiryDate: '2028-01-10',
      verifyToken: generateSkillVerifyToken('worker-ramesh', 'Scaffolding Safety & Fall Arrest Certification', '2025-01-10', passportSecret()),
      verified: true,
    },
    {
      id: 'skill-3',
      workerId: 'worker-murugan',
      orgId: 'org-college',
      title: 'Commercial Infection Control & Bio-Sanitation',
      issuer: 'Tamil Nadu Skill Development Mission (TNSDM)',
      issuedDate: '2024-08-20',
      expiryDate: '2027-08-20',
      verifyToken: generateSkillVerifyToken('worker-murugan', 'Commercial Infection Control & Bio-Sanitation', '2024-08-20', passportSecret()),
      verified: true,
    },
    {
      id: 'skill-4',
      workerId: 'worker-murugan',
      orgId: 'org-college',
      title: 'Campus Emergency First Response & Evacuation',
      issuer: 'Indian Red Cross Society',
      issuedDate: '2025-02-05',
      expiryDate: '2028-02-05',
      verifyToken: generateSkillVerifyToken('worker-murugan', 'Campus Emergency First Response & Evacuation', '2025-02-05', passportSecret()),
      verified: true,
    },
  ];

  return {
    orgs,
    sites,
    workers,
    admins,
    shifts,
    hazards,
    feedback,
    skills,
  };
}
