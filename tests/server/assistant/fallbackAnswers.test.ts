import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

import { workerFallback } from '@/src/server/assistant/worker';
import { adminFallback } from '@/src/server/assistant/admin';

/** A tool runner that returns canned data, so each template branch can be checked exactly. */
const canned = (data: Record<string, Record<string, unknown>>) => async (name: string) =>
  data[name] ?? null;

describe('worker answer templates', () => {
  it('mentions overtime pay only when there is some', async () => {
    const lines = (ot: number) => [
      { key: 'payslip.basePay', amount: 15000 },
      { key: 'payslip.overtime', amount: ot },
    ];
    const payslip = (ot: number) => ({
      get_my_payslip: {
        period: '1 Oct – 27 Oct',
        gross: 16200,
        deductions: 1800,
        net: 14400,
        lines: lines(ot),
      },
    });
    const withOt = await workerFallback('en')('my pay', canned(payslip(1200)));
    expect(withOt.text).toBe(
      'From 1 Oct – 27 Oct, your pay before deductions is ₹16,200. After PF and ESI of ₹1,800, you take home ₹14,400. This includes ₹1,200 overtime, paid at double rate.',
    );
    const without = await workerFallback('en')('my pay', canned(payslip(0)));
    expect(without.text).not.toContain('overtime');
  });

  it('adds fatigue warnings after the hours', async () => {
    const res = await workerFallback('en')(
      'hours this week',
      canned({
        get_my_hours: {
          totalHours: 56,
          daysWorked: 7,
          overtimeHours: 8,
          fatigueWarnings: ['You worked 7 days without a rest day.'],
        },
      }),
    );
    expect(res.text).toBe(
      'In the last 7 days you worked 56 hours on 7 days. 8 of those hours are overtime. You worked 7 days without a rest day.',
    );
  });

  it('says whether the worker is on site', async () => {
    const on = await workerFallback('hi')(
      'aaj shift',
      canned({ get_today_shift: { checkedIn: true, since: '08:02', site: 'Skyline Towers' } }),
    );
    expect(on.text).toBe('आप 08:02 से Skyline Towers पर चेक-इन हैं।');
    const off = await workerFallback('en')(
      'today',
      canned({ get_today_shift: { checkedIn: false } }),
    );
    expect(off.text).toBe('You are not checked in right now.');
  });

  it('describes the latest hazard report, or explains anonymity when there is none', async () => {
    const some = await workerFallback('en')(
      'my report',
      canned({
        get_my_hazard_reports: {
          reports: [{ category: 'Electric', status: 'Seen by supervisor', reportedOn: '26 Oct' }],
        },
      }),
    );
    expect(some.text).toBe(
      'Your named reports: 1. The latest, Electric on 26 Oct, is Seen by supervisor.',
    );
    const none = await workerFallback('en')(
      'my report',
      canned({ get_my_hazard_reports: { reports: [] } }),
    );
    expect(none.text).toContain('Anonymous reports are never linked to you');
  });

  it('counts active skills and names one that expires', async () => {
    const res = await workerFallback('en')(
      'my skills',
      canned({
        get_my_skills: {
          skills: [
            { title: 'Scaffolding safety', status: 'active', expires: '15 Mar 2027' },
            { title: 'First aid', status: 'expired', expires: '1 Jan 2025' },
          ],
        },
      }),
    );
    expect(res.text).toBe('Active verified skills: 1. Scaffolding safety expires on 15 Mar 2027.');
    const none = await workerFallback('en')('my skills', canned({ get_my_skills: { skills: [] } }));
    expect(none.text).toContain('No skills are recorded yet');
  });

  it('answers two topics in one question', async () => {
    const res = await workerFallback('en')(
      'pay and hours?',
      canned({
        get_my_payslip: { period: 'Oct', gross: 1, deductions: 0, net: 1, lines: [] },
        get_my_hours: { totalHours: 8, daysWorked: 1, overtimeHours: 0, fatigueWarnings: [] },
      }),
    );
    expect(res.tools).toEqual(['get_my_payslip', 'get_my_hours']);
    expect(res.text).toContain('No overtime');
  });
});

describe('admin answer templates', () => {
  it('summarises open hazards, or says there are none', async () => {
    const some = await adminFallback(
      'hazards?',
      canned({
        list_open_hazards: {
          openCount: 2,
          hazards: [
            {
              category: 'Fall risk',
              severity: 'critical',
              status: 'escalated',
              deadline: 'Overdue',
            },
          ],
        },
      }),
    );
    expect(some.text).toBe(
      '2 open hazards. Most urgent: Fall risk (critical), escalated, Overdue.',
    );
    const none = await adminFallback(
      'hazards?',
      canned({ list_open_hazards: { openCount: 0, hazards: [] } }),
    );
    expect(none.text).toBe('No open hazards.');
  });

  it('keeps small teams hidden in the feedback answer', async () => {
    const hidden = await adminFallback(
      'team feedback',
      canned({ get_team_feedback: { teams: [{ team: 'Electric', hidden: true }] } }),
    );
    expect(hidden.text).toContain('stays hidden');
    const shown = await adminFallback(
      'team feedback',
      canned({
        get_team_feedback: {
          teams: [{ team: 'Masonry', answers: 4, scores: { Respect: 2.5, Safety: null } }],
        },
      }),
    );
    expect(shown.text).toBe('Feedback this week: Masonry Respect 2.5, Safety –.');
  });

  it('averages attendance over the trend', async () => {
    const res = await adminFallback(
      'attendance trend',
      canned({
        get_attendance_trend: {
          days: [
            { date: '2026-10-26', present: 20, total: 30 },
            { date: '2026-10-27', present: 25, total: 30 },
          ],
        },
      }),
    );
    expect(res.text).toBe(
      'Average 22.5 workers present per day over the last 2 days; today 25 of 30.',
    );
  });

  it('handles an empty quit-risk list', async () => {
    const res = await adminFallback('who will quit', canned({ list_quit_risk: { workers: [] } }));
    expect(res.text).toBe('No workers in this scope.');
  });
});
