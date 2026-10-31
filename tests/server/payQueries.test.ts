import { beforeEach, describe, expect, it } from 'vitest';
import { workerService } from '@/src/server/services/workerService';
import {
  answerPayQueryForOrg,
  getPayData,
  schedulePayRulesForOrg,
} from '@/src/server/services/adminPay';
import { checkPlannedShift, listPlanWorkers } from '@/src/server/services/adminPlan';
import { listMyPayQueries, loadPayQuery } from '@/src/server/services/workerViews';
import { SECTORS } from '@/src/server/services/sectors';
import { getDatabase } from '@/src/server/repos';
import { upcomingMondays } from '@/src/server/domain/payRules';
import { istDateKey } from '@/src/server/domain/time';
import { AppError } from '@/src/shared/errors';
import type { Worker } from '@/src/shared/types';

const db = getDatabase();
const { orgId } = SECTORS.construction;
let worker: Worker;

beforeEach(async () => {
  const ramesh = (await db.workers.getById('worker-ramesh'))!;
  worker = { ...ramesh, id: `worker-pq-${Math.random().toString(36).slice(2, 8)}` };
  await db.workers.save(worker);
});

async function expectCode(promise: Promise<unknown>, code: AppError['code']) {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await promise.catch((err: AppError) => expect(err.code).toBe(code));
}

const ask = (over = {}) =>
  workerService.raisePayQuery(worker.id, {
    reason: 'short_pay',
    receivedAmount: 1000,
    note: 'Less money this month',
    ...over,
  });

describe('raising a pay query', () => {
  it('takes the payslip figure from the payslip engine, not the client', async () => {
    const payslip = await workerService.getMyPayslip(worker.id);
    const { query, already } = await ask();
    expect(already).toBe(false);
    expect(query).toMatchObject({
      workerId: worker.id,
      orgId: worker.orgId,
      siteId: worker.siteId,
      payslipNet: payslip.net,
      receivedAmount: 1000,
      period: istDateKey(new Date()).slice(0, 7),
      answers: [],
    });
    expect(query.id).toMatch(/^payq-/);
  });

  it('returns the open query instead of a duplicate for the same month and reason', async () => {
    const first = await ask();
    const again = await ask({ receivedAmount: 900 });
    expect(again).toMatchObject({ already: true, query: { id: first.query.id } });
    const other = await ask({ reason: 'late_pay' });
    expect(other.already).toBe(false);
  });

  it('replays an offline retry by its client id', async () => {
    const first = await ask({ reason: 'unpaid_overtime', clientId: 'c-1' });
    const retry = await ask({ reason: 'wrong_deduction', clientId: 'c-1' });
    expect(retry).toMatchObject({ already: true, query: { id: first.query.id } });
  });

  it('lets only the worker who raised it see it', async () => {
    const { query } = await ask();
    expect(await workerService.getMyPayQuery(worker.id, query.id)).not.toBeNull();
    expect(await workerService.getMyPayQuery('worker-ramesh', query.id)).toBeNull();
    expect(await loadPayQuery('worker-ramesh', query.id)).toBeNull();
    expect((await loadPayQuery(worker.id, query.id))?.state).toBe('open');
    expect((await listMyPayQueries(worker.id)).map((q) => q.id)).toEqual([query.id]);
  });
});

describe('two keys: employer answers, worker settles', () => {
  it('runs answer -> not settled -> answer -> settled', async () => {
    const { query } = await ask();
    await expectCode(
      workerService.givePayVerdict(worker.id, query.id, 'settled'),
      'verdict_not_allowed',
    );

    await answerPayQueryForOrg(query.id, orgId, 'admin-skyline', {
      text: 'We will pay the balance on Monday.',
      correctedNet: null,
    });
    await expectCode(
      answerPayQueryForOrg(query.id, orgId, 'admin-skyline', {
        text: 'Second answer',
        correctedNet: null,
      }),
      'answer_not_allowed',
    );
    await expectCode(
      workerService.givePayVerdict('worker-ramesh', query.id, 'settled'),
      'not_found',
    );

    const reopened = await workerService.givePayVerdict(worker.id, query.id, 'not_settled');
    expect(reopened.reopenCount).toBe(1);

    const answered = await answerPayQueryForOrg(query.id, orgId, 'admin-skyline', {
      text: 'Balance paid in cash today.',
      correctedNet: 1500,
    });
    expect(answered.answers.at(-1)).toMatchObject({
      by: 'Arunachalam Verma (Site Ops Lead)',
      correctedNet: 1500,
    });
    const settled = await workerService.givePayVerdict(worker.id, query.id, 'settled');
    expect(settled.workerVerdict).toBe('settled');
  });

  it('hides another organisation’s query from the console', async () => {
    const { query } = await ask();
    await expectCode(
      answerPayQueryForOrg(query.id, SECTORS.college.orgId, 'admin-campus', {
        text: 'Not my organisation',
        correctedNet: null,
      }),
      'not_found',
    );
  });
});

describe('console pay page', () => {
  it('lists the site’s queries most urgent first with names and figures', async () => {
    const { queries } = await getPayData('construction');
    const seeded = queries.filter((q) => q.id === 'payq-1' || q.id === 'payq-2');
    expect(seeded.map((q) => q.state)).toEqual(['overdue', 'open']);
    const [overdue, open] = seeded;
    expect(overdue.dueLabel).toMatch(/^Overdue by/);
    expect(open).toMatchObject({ gap: 1240, wagesDueBy: expect.stringMatching(/-07$/) });
    expect(open.workerName).not.toBe('Former worker');
    // The college query never shows on the construction console.
    expect(queries.some((q) => q.id === 'payq-3')).toBe(false);
    const college = await getPayData('college');
    expect(college.queries.find((q) => q.id === 'payq-3')).toMatchObject({
      state: 'settled',
      dueLabel: 'Settled by the worker',
    });
  });

  it('shows rules in force and schedules a lawful change with the admin’s name', async () => {
    const now = new Date();
    const before = await getPayData('construction', now);
    expect(before.rules.current).toEqual({
      dailyHoursLimit: 8,
      weeklyHoursLimit: 48,
      otMultiplier: 2,
    });
    expect(before.rules.startDates).toEqual(upcomingMondays(now));

    const from = before.rules.startDates[1];
    const version = await schedulePayRulesForOrg(
      orgId,
      'admin-skyline',
      {
        rules: { dailyHoursLimit: 8, weeklyHoursLimit: 48, otMultiplier: 2.5 },
        effectiveFrom: from,
        reason: '  Monsoon rush: higher overtime rate  ',
      },
      now,
    );
    expect(version).toMatchObject({
      effectiveFrom: from,
      reason: 'Monsoon rush: higher overtime rate',
      changedBy: 'Arunachalam Verma (Site Ops Lead)',
    });

    const after = await getPayData('construction', now);
    expect(after.rules.scheduled.map((v) => v.effectiveFrom)).toEqual([from]);
    expect(after.rules.history[0].id).toBe(version.id);
    expect(after.rules.startDates).not.toContain(from);
    // Rules in force today do not change until that Monday.
    expect(after.rules.current.otMultiplier).toBe(2);
  });

  it('refuses rules below the law', async () => {
    await expectCode(
      schedulePayRulesForOrg(orgId, 'admin-skyline', {
        rules: { dailyHoursLimit: 9, weeklyHoursLimit: 48, otMultiplier: 2 },
        effectiveFrom: upcomingMondays(new Date())[0],
        reason: 'Longer days before overtime',
      }),
      'validation',
    );
    await expectCode(
      schedulePayRulesForOrg('org-missing', 'admin-skyline', {
        rules: { dailyHoursLimit: 8, weeklyHoursLimit: 48, otMultiplier: 2 },
        effectiveFrom: upcomingMondays(new Date())[0],
        reason: 'No such organisation',
      }),
      'not_found',
    );
  });
});

describe('plan a shift', () => {
  const tomorrow = istDateKey(new Date(Date.now() + 24 * 3600_000));

  it('lists only this site’s workers, by name', async () => {
    const workers = await listPlanWorkers('construction');
    expect(workers.every((w) => w.siteId === SECTORS.construction.siteId)).toBe(true);
    const names = workers.map((w) => w.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('checks a shift for a worker at the site', async () => {
    const outcome = await checkPlannedShift('construction', {
      workerId: worker.id,
      date: tomorrow,
      start: '09:00',
      end: '17:00',
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.result.hours).toBe(8);
  });

  it('treats a worker from another site as unknown and rejects bad input', async () => {
    const other = await checkPlannedShift('college', {
      workerId: worker.id,
      date: tomorrow,
      start: '09:00',
      end: '17:00',
    });
    expect(other).toEqual({ ok: false, error: 'Pick a worker at this site.' });
    const bad = await checkPlannedShift('construction', {
      workerId: worker.id,
      date: tomorrow,
      start: 'nine',
      end: '17:00',
    });
    expect(bad.ok).toBe(false);
    const past = await checkPlannedShift('construction', {
      workerId: worker.id,
      date: '2020-01-01',
      start: '09:00',
      end: '17:00',
    });
    expect(past.ok).toBe(false);
  });
});
