/**
 * Deterministic demo data, anchored to today: a seeded PRNG builds the same organisations, people
 * and records on every start.
 */
import type { FeedbackBallot } from '../domain/feedbackBallot';
import type {
  Org,
  Site,
  Worker,
  Admin,
  Shift,
  HazardReport,
  FeedbackSubmission,
  SkillRecord,
  PayQuery,
  WagePayment,
} from '../../shared/types';
import { DAY_MS } from '../domain/time';
import { generateOrgs, generateSites } from './orgs';
import { generatePeople } from './people';
import { generateShifts } from './shifts';
import { receiptSecret } from '../auth/receiptKey';
import { sealShift } from '../domain/shiftReceipt';
import { generateRecords } from './records';
import { generatePayQueries } from './payQueries';

export * from './orgs';
export * from './people';
export * from './shifts';
export * from './records';
export * from './payQueries';

export interface SeedDataResult {
  orgs: Org[];
  sites: Site[];
  workers: Worker[];
  admins: Admin[];
  shifts: Shift[];
  hazards: HazardReport[];
  feedback: FeedbackSubmission[];
  /** Empty: seeded answers predate ballots and are already one per person. */
  feedbackBallots: FeedbackBallot[];
  skills: SkillRecord[];
  payQueries: PayQuery[];
  /** Empty: the demo starts with this month unpaid, so paying it can be shown. */
  wagePayments: WagePayment[];
}

/** Computed when the seed runs, never at import (Next.js prerendering forbids Date.now() there). */
export function demoAnchorMs(): number {
  const now = Date.now();
  const todayShiftStart = new Date(
    `${new Date(now).toISOString().slice(0, 10)}T02:30:00.000Z`,
  ).getTime(); // 08:00 IST
  return todayShiftStart > now - 2 * 60 * 60 * 1000 ? todayShiftStart - DAY_MS : todayShiftStart;
}

/**
 * Deterministic PRNG (Mulberry32)
 */
export function mulberry32(seed: number) {
  let a = seed;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function generateSeedData(): Promise<SeedDataResult> {
  const anchorMs = demoAnchorMs();
  const rand = mulberry32(20261027);

  const orgs = generateOrgs();
  const sites = generateSites();
  const { workers, admins } = await generatePeople();
  // Closed demo shifts carry receipts, as if each was sealed at its own check-out.
  const secret = receiptSecret();
  const shifts = generateShifts(workers, anchorMs, rand).map((s) => sealShift(s, secret));
  const { hazards, feedback, skills } = generateRecords(anchorMs);

  return {
    orgs,
    sites,
    workers,
    admins,
    shifts,
    hazards,
    feedback,
    feedbackBallots: [],
    skills,
    payQueries: generatePayQueries(anchorMs),
    wagePayments: [],
  };
}
