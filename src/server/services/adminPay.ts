/**
 * The console's pay page: worker pay queries with their answer deadlines, and the versioned pay
 * rules. Everything is scoped to the sector the session may view; ids from forms are re-checked
 * against that organisation.
 */

import { SECTORS } from './sectors';
import { getDatabase } from '../repos';
import { formatSlaRemaining } from '../domain/hazardSla';
import { istDateKey } from '../domain/time';
import {
  answerPayQuery,
  canAnswer,
  payGap,
  payQueryState,
  sortPayQueries,
  wagesDueBy,
  type PayQueryState,
} from '../domain/payQuery';
import {
  addRuleVersion,
  checkRuleChange,
  rulesOn,
  upcomingMondays,
  type RuleChangeInput,
} from '../domain/payRules';
import { newRecordId } from '../ids';
import { AppError } from '../../shared/errors';
import type { PayQuery, PayRuleVersion, PayRules, Sector } from '../../shared/types';

export interface PayQueryRow extends PayQuery {
  workerName: string;
  team: string;
  state: PayQueryState;
  /** Rupees short by the worker's count, or null when they did not type an amount. */
  gap: number | null;
  /** "Overdue by 12h 0m", "27h 40m remaining", "Waiting for the worker" or "Settled". */
  dueLabel: string;
  /** Legal last day for this month's wages (`YYYY-MM-07` of the next month). */
  wagesDueBy: string;
}

export interface PayRulesView {
  /** Rules in force today. */
  current: PayRules;
  /** Changes that start on a coming Monday, soonest first. */
  scheduled: PayRuleVersion[];
  /** Every version, newest first. */
  history: PayRuleVersion[];
  /** Mondays a new change may start on (none already taken). */
  startDates: string[];
}

export interface PayPageData {
  queries: PayQueryRow[];
  rules: PayRulesView;
}

const DUE_LABEL: Partial<Record<PayQueryState, string>> = {
  awaiting_worker: 'Answered, waiting for the worker',
  settled: 'Settled by the worker',
};

export async function getPayData(sector: Sector, now: Date = new Date()): Promise<PayPageData> {
  const { orgId, siteId } = SECTORS[sector];
  const db = getDatabase();
  const [queries, workers, org] = await Promise.all([
    db.payQueries.listByOrg(orgId),
    db.workers.listBySite(siteId),
    db.orgs.get(orgId),
  ]);
  const byId = new Map(workers.map((w) => [w.id, w]));

  const rows = sortPayQueries(
    queries.filter((q) => q.siteId === siteId),
    now,
  ).map((q): PayQueryRow => {
    const state = payQueryState(q, now);
    const worker = byId.get(q.workerId);
    return {
      ...q,
      workerName: worker?.name ?? 'Former worker',
      team: worker?.team ?? '',
      state,
      gap: payGap(q),
      dueLabel:
        DUE_LABEL[state] ??
        formatSlaRemaining(Math.floor((Date.parse(q.answerDueAt) - now.getTime()) / 1000)),
      wagesDueBy: wagesDueBy(q.period),
    };
  });

  const today = istDateKey(now);
  const history = org?.payRuleHistory ?? [];
  const taken = new Set(history.map((v) => v.effectiveFrom));
  return {
    queries: rows,
    rules: {
      current: rulesOn(org ?? {}, today),
      scheduled: history.filter((v) => v.effectiveFrom > today),
      history: [...history].reverse(),
      startDates: upcomingMondays(now).filter((d) => !taken.has(d)),
    },
  };
}

async function adminName(adminId: string): Promise<string> {
  return (await getDatabase().admins.getById(adminId))?.name ?? 'Supervisor';
}

export interface PayAnswerInput {
  text: string;
  correctedNet: number | null;
}

/** The employer's answer to an open query in their own organisation. */
export async function answerPayQueryForOrg(
  queryId: string,
  orgId: string,
  adminId: string,
  input: PayAnswerInput,
  now: Date = new Date(),
): Promise<PayQuery> {
  const db = getDatabase();
  const query = await db.payQueries.getById(queryId);
  if (!query || query.orgId !== orgId) throw new AppError('not_found', 'Pay query not found');
  if (!canAnswer(query, now)) {
    throw new AppError('answer_not_allowed', 'This query is not waiting for an answer.');
  }
  return db.payQueries.update(
    answerPayQuery(query, {
      text: input.text,
      correctedNet: input.correctedNet,
      by: await adminName(adminId),
      at: now.toISOString(),
    }),
  );
}

/** Schedules new pay rules from a coming Monday, within the law and with a reason. */
export async function schedulePayRulesForOrg(
  orgId: string,
  adminId: string,
  input: RuleChangeInput,
  now: Date = new Date(),
): Promise<PayRuleVersion> {
  const db = getDatabase();
  const org = await db.orgs.get(orgId);
  if (!org) throw new AppError('not_found', 'Organisation not found');
  const check = checkRuleChange(org, input, now);
  if (!check.ok) throw new AppError('validation', check.reason);

  const version: PayRuleVersion = {
    id: newRecordId('rules'),
    effectiveFrom: input.effectiveFrom,
    rules: input.rules,
    reason: input.reason.trim(),
    changedBy: await adminName(adminId),
    changedAt: now.toISOString(),
  };
  await db.orgs.save({ ...org, payRuleHistory: addRuleVersion(org, version) });
  return version;
}
