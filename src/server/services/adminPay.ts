/**
 * The console's pay page: wages to pay by UPI, worker pay queries with their answer deadlines,
 * and the versioned pay rules. Everything is scoped to the sector the session may view; ids from forms are re-checked
 * against that organisation.
 */

import QRCode from 'qrcode';
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
  policyForDate,
  rulesOn,
  upcomingMondays,
  type RuleChangeInput,
} from '../domain/payRules';
import {
  payablePeriods,
  payslipForMonth,
  UTR_PATTERN,
  upiPayUri,
  wagePaymentId,
  wageState,
  type WageState,
} from '../domain/wagePayment';
import { newRecordId } from '../ids';
import { AppError } from '../../shared/errors';
import type { PayQuery, PayRuleVersion, PayRules, Sector, WagePayment } from '../../shared/types';

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

// ── Wages by UPI ────────────────────────────────────────────

export interface WageRow {
  workerId: string;
  workerName: string;
  team: string;
  /** The payslip net for the month, from the server's own calculation. */
  net: number;
  state: WageState;
  payment: WagePayment | null;
  upiId: string | null;
  /** `upi://pay` link with payee and amount filled in; null when paid or there is no UPI ID. */
  payUri: string | null;
  /** The same link as a QR code, to scan with the employer's phone. */
  qrSvg: string | null;
}

export interface WageMonth {
  period: string;
  /** Legal last day to pay (the 7th of the next month). */
  dueBy: string;
  rows: WageRow[];
  paidCount: number;
  overdueCount: number;
}

const monthLabel = (period: string) =>
  new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${period}-01T00:00:00Z`),
  );

/**
 * This month and last month, for every active worker at the sector's site who earned something.
 * Without QR codes; `getWagesData` adds them for the pay page.
 */
export async function getWageMonths(sector: Sector, now: Date = new Date()): Promise<WageMonth[]> {
  const { orgId, siteId } = SECTORS[sector];
  const db = getDatabase();
  const [workers, shifts, org, payments] = await Promise.all([
    db.workers.listBySite(siteId),
    db.shifts.listBySite(siteId),
    db.orgs.get(orgId),
    db.wagePayments.listBySite(siteId),
  ]);
  const policy = policyForDate(org);
  const paid = new Map(payments.map((p) => [p.id, p]));
  const active = workers.filter((w) => w.active).sort((a, b) => a.name.localeCompare(b.name));

  return payablePeriods(now)
    .reverse()
    .map((period): WageMonth => {
      const rows = active.map((w): WageRow | null => {
        const payment = paid.get(wagePaymentId(w.id, period)) ?? null;
        const net = payslipForMonth(w, shifts, period, now, policy)?.net ?? 0;
        if (net <= 0 && !payment) return null;
        return {
          workerId: w.id,
          workerName: w.name,
          team: w.team,
          net,
          state: wageState(period, payment, now),
          payment,
          upiId: w.upiId ?? null,
          payUri: payment
            ? null
            : upiPayUri({
                vpa: w.upiId ?? '',
                payeeName: w.name,
                amount: net,
                note: `FairShift wages ${monthLabel(period)}`,
              }),
          qrSvg: null,
        };
      });
      const listed = rows.filter((r): r is WageRow => r !== null);
      return {
        period,
        dueBy: wagesDueBy(period),
        rows: listed,
        paidCount: listed.filter((r) => r.state === 'paid').length,
        overdueCount: listed.filter((r) => r.state === 'overdue').length,
      };
    });
}

/** The wage months with each unpaid row's UPI link drawn as a QR code to scan. */
export async function getWagesData(sector: Sector, now: Date = new Date()): Promise<WageMonth[]> {
  const months = await getWageMonths(sector, now);
  return Promise.all(
    months.map(async (m) => ({
      ...m,
      rows: await Promise.all(
        m.rows.map(async (r) => ({
          ...r,
          qrSvg: r.payUri
            ? await QRCode.toString(r.payUri, {
                type: 'svg',
                margin: 1,
                errorCorrectionLevel: 'M',
                color: { dark: '#1C1D1A', light: '#FFFFFF' },
              })
            : null,
        })),
      ),
    })),
  );
}

export interface WagePaymentInput {
  workerId: string;
  period: string;
  utr: string;
}

/**
 * Records that a worker's month was paid by UPI. The amount is worked out again here, never taken
 * from the form, and a month can be recorded once.
 */
export async function recordWagePaymentForOrg(
  orgId: string,
  siteId: string,
  adminId: string,
  input: WagePaymentInput,
  now: Date = new Date(),
): Promise<WagePayment> {
  const db = getDatabase();
  const worker = await db.workers.getById(input.workerId);
  if (!worker || worker.orgId !== orgId || worker.siteId !== siteId) {
    throw new AppError('not_found', 'Worker not found');
  }
  if (!payablePeriods(now).includes(input.period)) {
    throw new AppError('validation', 'Only last month and this month can be paid here.');
  }
  if (!UTR_PATTERN.test(input.utr)) {
    throw new AppError('validation', 'The UTR is the 12-digit reference your UPI app shows.');
  }
  if (!worker.upiId) throw new AppError('validation', 'This worker has no UPI ID on file.');

  const [shifts, org] = await Promise.all([db.shifts.listByWorker(worker.id), db.orgs.get(orgId)]);
  const net = payslipForMonth(worker, shifts, input.period, now, policyForDate(org))?.net ?? 0;
  if (net <= 0) throw new AppError('validation', 'Nothing is owed for this month.');

  const payment: WagePayment = {
    id: wagePaymentId(worker.id, input.period),
    orgId,
    siteId,
    workerId: worker.id,
    period: input.period,
    amount: net,
    utr: input.utr,
    upiId: worker.upiId,
    paidAt: now.toISOString(),
    paidBy: await adminName(adminId),
  };
  if (!(await db.wagePayments.record(payment))) {
    throw new AppError('wages_already_paid', 'This month is already recorded as paid.');
  }
  return payment;
}
