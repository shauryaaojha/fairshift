/**
 * Demo pay queries and pay rule history: one query waiting for an answer, one overdue, and one the
 * worker has settled, so every state shows on the console.
 */
import type { PayQuery, PayRuleVersion } from '../../shared/types';
import { HOUR_MS, istDateKey } from '../domain/time';

/** The first rules under the labour codes, which came into force on Friday 21 November 2025. */
export const INITIAL_PAY_RULES: PayRuleVersion = {
  id: 'rules-initial',
  effectiveFrom: '2025-11-24',
  rules: { dailyHoursLimit: 8, weeklyHoursLimit: 48, otMultiplier: 2 },
  reason: 'Rules set when the labour codes came into force on 21 November 2025.',
  changedBy: 'Kavya Raman (Regional HR Lead)',
  changedAt: '2025-11-21T10:00:00.000Z',
};

export function generatePayQueries(anchorMs: number): PayQuery[] {
  const at = (hours: number) => new Date(anchorMs + hours * HOUR_MS).toISOString();
  const thisMonth = istDateKey(new Date(anchorMs)).slice(0, 7);
  const [y, m] = thisMonth.split('-').map(Number);
  const lastMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const site = { orgId: 'org-construction', siteId: 'site-skyline-chennai' };

  return [
    {
      id: 'payq-1',
      ...site,
      workerId: 'worker-const-3',
      reason: 'unpaid_overtime',
      period: lastMonth,
      payslipNet: 18640,
      receivedAmount: 17400,
      note: 'Two Sundays of overtime at the Tower B slab are missing.',
      raisedAt: at(-20),
      answerDueAt: at(28),
      answers: [],
      workerVerdict: null,
      verdictAt: null,
      reopenCount: 0,
    },
    {
      id: 'payq-2',
      ...site,
      workerId: 'worker-const-7',
      reason: 'late_pay',
      period: lastMonth,
      payslipNet: 16200,
      receivedAmount: null,
      note: null,
      raisedAt: at(-60),
      answerDueAt: at(-12),
      answers: [],
      workerVerdict: null,
      verdictAt: null,
      reopenCount: 0,
    },
    {
      id: 'payq-3',
      orgId: 'org-college',
      siteId: 'site-srm-campus',
      workerId: 'worker-murugan',
      reason: 'wrong_deduction',
      period: lastMonth,
      payslipNet: 14310,
      receivedAmount: 13810,
      note: 'Uniform charge of 500 rupees was cut.',
      raisedAt: at(-120),
      answerDueAt: at(-72),
      answers: [
        {
          text: 'The uniform charge was a mistake. 500 rupees is added to this month’s pay.',
          correctedNet: 14310,
          by: 'Dr. Priya Sundaram (Facilities Director)',
          at: at(-100),
        },
      ],
      workerVerdict: 'settled',
      verdictAt: at(-90),
      reopenCount: 0,
    },
  ];
}
