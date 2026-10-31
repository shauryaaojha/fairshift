/**
 * Demo hazard reports, anonymous feedback and skill records.
 */
import type { HazardReport, FeedbackSubmission, SkillRecord } from '../../shared/types';
import { deriveServerSecret } from '../auth/session';
import { generateSkillVerifyToken } from '../domain/skills';
import { calculateIsoWeek } from '../domain/anonymity';

export function generateRecords(demoAnchorMs: number): {
  hazards: HazardReport[];
  feedback: FeedbackSubmission[];
  skills: SkillRecord[];
} {
  const atAnchor = (minutes: number) => new Date(demoAnchorMs + minutes * 60 * 1000).toISOString();
  const demoWeek = calculateIsoWeek(new Date(demoAnchorMs));
  const passportSecret = () => deriveServerSecret('passport');

  // Hazards
  const hazards: HazardReport[] = [
    {
      id: 'hazard-1',
      orgId: 'org-construction',
      siteId: 'site-skyline-chennai',
      reporterId: 'worker-ramesh',
      category: 'Electrical Safety',
      description:
        'Uncovered 440V high-voltage cable trench near Tower B foundation after monsoon puddle.',
      severity: 'critical',
      status: 'escalated', // Missed 1h acknowledgement SLA
      reportedAt: atAnchor(30),
      acknowledgedAt: null,
      resolvedAt: null,
      aiSummary:
        'Critical 440V exposed electrical line immersed in rainwater posing acute shock risk near foundation.',
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
      aiSummary:
        'Loose staging coupler at height requiring immediate scaffolding crew retightening.',
      aiSuggestedSeverity: 'high',
      anonymous: true,
    },
    {
      id: 'hazard-3',
      orgId: 'org-college',
      siteId: 'site-srm-campus',
      reporterId: 'worker-murugan',
      category: 'Slip & Fall',
      description:
        'Chilled water pipe condensing and creating persistent slippery puddle on main auditorium stairs.',
      severity: 'medium',
      status: 'resolved',
      reportedAt: atAnchor(-21 * 60),
      acknowledgedAt: atAnchor(-20.5 * 60),
      resolvedAt: atAnchor(-18 * 60),
      aiSummary:
        'A/C condensation runoff on stairs; anti-slip mats deployed and pipe re-insulated.',
      aiSuggestedSeverity: 'medium',
      anonymous: false,
      reporterVerdict: null, // resolved by the supervisor, waiting for Murugan to confirm
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
    {
      id: 'hazard-5',
      orgId: 'org-construction',
      siteId: 'site-skyline-chennai',
      reporterId: 'worker-ramesh',
      category: 'Fall Protection',
      description: 'Broken rung on the steel ladder to the Tower A stair core, second landing.',
      severity: 'high',
      status: 'resolved',
      reportedAt: atAnchor(-26 * 60),
      acknowledgedAt: atAnchor(-25 * 60),
      resolvedAt: atAnchor(-3 * 60),
      aiSummary: 'Damaged ladder rung at height on the stair core access route.',
      aiSuggestedSeverity: 'high',
      anonymous: false,
      reporterVerdict: null, // resolved by the supervisor, waiting for Ramesh to confirm
    },
  ];

  // Feedback
  const feedback: FeedbackSubmission[] = [
    // Masonry (4 entries: count >= 3, averages & comments available)
    {
      id: 'fb-1',
      orgId: 'org-construction',
      siteId: 'site-skyline-chennai',
      team: 'Masonry',
      isoWeek: demoWeek,
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
      isoWeek: demoWeek,
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
      isoWeek: demoWeek,
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
      isoWeek: demoWeek,
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
      isoWeek: demoWeek,
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
      isoWeek: demoWeek,
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
      isoWeek: demoWeek,
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
      isoWeek: demoWeek,
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
      isoWeek: demoWeek,
      managerRespect: 4,
      safetyRating: 3,
      payFairness: 3,
      workloadRating: 3,
      comment: 'Guard post shelter fan needs repair.',
    },
  ];

  // Skills
  const skills: SkillRecord[] = [
    {
      id: 'skill-1',
      workerId: 'worker-ramesh',
      orgId: 'org-construction',
      title: 'Structural Brick Masonry (Level 3)',
      issuer: 'National Skill Development Corporation (NSDC)',
      issuedDate: '2024-03-15',
      expiryDate: '2027-03-15',
      verifyToken: generateSkillVerifyToken(
        'worker-ramesh',
        'Structural Brick Masonry (Level 3)',
        '2024-03-15',
        passportSecret(),
      ),
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
      verifyToken: generateSkillVerifyToken(
        'worker-ramesh',
        'Scaffolding Safety & Fall Arrest Certification',
        '2025-01-10',
        passportSecret(),
      ),
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
      verifyToken: generateSkillVerifyToken(
        'worker-murugan',
        'Commercial Infection Control & Bio-Sanitation',
        '2024-08-20',
        passportSecret(),
      ),
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
      verifyToken: generateSkillVerifyToken(
        'worker-murugan',
        'Campus Emergency First Response & Evacuation',
        '2025-02-05',
        passportSecret(),
      ),
      verified: true,
    },
  ];

  return { hazards, feedback, skills };
}
