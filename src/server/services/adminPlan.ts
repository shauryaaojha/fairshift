/**
 * The console's "Plan a shift" check: what one more shift would do to a worker at this site.
 * Read-only; nothing is saved.
 */

import { SECTORS } from './sectors';
import { getDatabase } from '../repos';
import { deriveHourlyRate } from '../domain/payslip';
import { policyForDate } from '../domain/payRules';
import {
  checkShiftPlan,
  planFromLocal,
  planProblem,
  type ShiftPlanResult,
} from '../domain/shiftPlan';
import type { Sector, Worker } from '../../shared/types';

export interface PlanRequest {
  workerId: string;
  /** IST date, `YYYY-MM-DD` */
  date: string;
  /** `HH:MM`, IST */
  start: string;
  end: string;
}

export type PlanOutcome =
  { ok: true; worker: Worker; result: ShiftPlanResult } | { ok: false; error: string };

export async function listPlanWorkers(sector: Sector): Promise<Worker[]> {
  const workers = await getDatabase().workers.listBySite(SECTORS[sector].siteId);
  return [...workers].sort((a, b) => a.name.localeCompare(b.name));
}

export async function checkPlannedShift(
  sector: Sector,
  req: PlanRequest,
  now: Date = new Date(),
): Promise<PlanOutcome> {
  const { siteId, orgId } = SECTORS[sector];
  const db = getDatabase();
  const worker = await db.workers.getById(req.workerId);
  // A worker from another site looks the same as one that does not exist.
  if (!worker || worker.siteId !== siteId) {
    return { ok: false, error: 'Pick a worker at this site.' };
  }

  const plan = planFromLocal(req.date, req.start, req.end);
  if (!plan) return { ok: false, error: 'Enter a date and start and end times.' };
  const problem = planProblem(plan, now);
  if (problem) return { ok: false, error: problem };

  const [shifts, org] = await Promise.all([db.shifts.listByWorker(worker.id), db.orgs.get(orgId)]);
  const result = checkShiftPlan(
    shifts,
    plan,
    deriveHourlyRate(worker.basePay, worker.payType),
    policyForDate(org),
  );
  return { ok: true, worker, result };
}
