import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/src/server/services/workerService', () => ({ workerService: {} }));
vi.mock('@/src/server/repos', () => ({ getDatabase: vi.fn() }));
vi.mock('@/src/server/ai/gemini', () => ({ explainPayslip: vi.fn() }));

import {
  buildPayslipSpeech,
  describeFatigue,
  formatClock,
  formatDay,
  hazardTimeline,
  musterDays,
  summarizeWeek,
  validateWorkerNext,
} from '@/src/server/services/workerViews';
import type { FatigueFlag, PayslipResult, Shift } from '@/src/shared/types';

const shift = (id: string, inIso: string, outIso: string | null): Shift => ({
  id,
  workerId: 'w1',
  siteId: 's1',
  orgId: 'o1',
  checkIn: inIso,
  checkOut: outIso,
  method: 'qr',
});

describe('formatClock / formatDay', () => {
  it('formats in site time (IST)', () => {
    expect(formatClock('2026-10-27T02:32:00.000Z')).toBe('08:02');
    expect(formatClock('not a date')).toBe('--:--');
  });

  it('formats date-only strings without shifting the day', () => {
    expect(formatDay('2026-10-20', 'en')).toMatch(/20/);
    expect(formatDay('2026-10-20', 'hi')).toMatch(/20/);
    expect(formatDay('garbage', 'en')).toBe('garbage');
  });
});

describe('describeFatigue', () => {
  it('renders every domain flag as a plain sentence in each language', () => {
    const flags: FatigueFlag[] = [
      {
        type: 'long_shift',
        messageKey: 'fatigue.long_shift',
        params: { hours: 11, shiftId: 's', date: '2026-10-20' },
      },
      {
        type: 'weekly_hours_exceeded',
        messageKey: 'fatigue.weekly_hours_exceeded',
        params: { totalHours: 52, limit: 48 },
      },
      {
        type: 'short_rest',
        messageKey: 'fatigue.short_rest',
        params: { gapHours: 6, date: '2026-10-21', minGap: 10 },
      },
      { type: 'no_rest_day', messageKey: 'fatigue.no_rest_day', params: { consecutiveDays: 7 } },
    ];
    for (const loc of ['en', 'hi', 'ta'] as const) {
      const notes = describeFatigue(flags, loc);
      expect(notes).toHaveLength(4);
      for (const n of notes) expect(n.text).not.toMatch(/\{\w+\}|fatigue\./);
    }
    expect(describeFatigue(flags, 'en')[0].text).toContain('11 hours');
    expect(describeFatigue(flags, 'ta')[3].text).toContain('7');
  });
});

describe('hazardTimeline', () => {
  // Anonymous by default: no reporter, so no "confirmed" step.
  const base = {
    reportedAt: '2026-10-27T05:00:00Z',
    acknowledgedAt: null,
    resolvedAt: null,
    reporterId: null,
  };

  it('a new report is logged with only the first step done', () => {
    const tl = hazardTimeline({ ...base, status: 'reported' });
    expect(tl.steps.map((s) => s.key)).toEqual(['reported', 'acknowledged', 'resolved']);
    expect(tl.steps.map((s) => s.done)).toEqual([true, false, false]);
    expect(tl.stamp).toEqual({ variant: 'hivis', labelKey: 'hazard.stamp.logged' });
  });

  it('an escalated report adds an escalated node and an escalated stamp', () => {
    const tl = hazardTimeline({ ...base, status: 'escalated' });
    expect(tl.steps.map((s) => s.key)).toEqual([
      'reported',
      'escalated',
      'acknowledged',
      'resolved',
    ]);
    expect(tl.steps[1].done).toBe(true);
    expect(tl.stamp.variant).toBe('escalated');
  });

  it('a resolved report has every step done and a cleared stamp', () => {
    const tl = hazardTimeline({
      ...base,
      status: 'resolved',
      acknowledgedAt: '2026-10-27T05:30:00Z',
      resolvedAt: '2026-10-27T08:00:00Z',
    });
    expect(tl.steps.every((s) => s.done)).toBe(true);
    expect(tl.stamp.variant).toBe('cleared');
    expect(tl.closure).toBe('closed');
  });

  const resolvedNamed = {
    ...base,
    reporterId: 'worker-1',
    status: 'resolved' as const,
    acknowledgedAt: '2026-10-27T05:30:00Z',
    resolvedAt: '2026-10-27T08:00:00Z',
  };

  it('a resolved named report waits for the reporter before the last step is done', () => {
    const tl = hazardTimeline({ ...resolvedNamed, reporterVerdict: null });
    expect(tl.steps.map((s) => s.key)).toEqual([
      'reported',
      'acknowledged',
      'resolved',
      'confirmed',
    ]);
    expect(tl.steps.at(-1)?.done).toBe(false);
    expect(tl.closure).toBe('awaiting_reporter');
    expect(tl.stamp.labelKey).toBe('hazard.stamp.resolved');
  });

  it('a confirmed fix completes the timeline with a confirmed stamp', () => {
    const tl = hazardTimeline({
      ...resolvedNamed,
      reporterVerdict: 'fixed',
      verdictAt: '2026-10-27T09:00:00Z',
    });
    expect(tl.steps.at(-1)).toEqual({ key: 'confirmed', at: '2026-10-27T09:00:00Z', done: true });
    expect(tl.stamp).toEqual({ variant: 'cleared', labelKey: 'hazard.stamp.confirmed' });
  });

  it('a reopened report shows a reopened node instead of a plain escalation', () => {
    const tl = hazardTimeline({
      ...base,
      reporterId: 'worker-1',
      status: 'escalated',
      reporterVerdict: 'not_fixed',
      reopenedAt: '2026-10-27T09:00:00Z',
    });
    expect(tl.steps.map((s) => s.key)).toEqual([
      'reported',
      'reopened',
      'acknowledged',
      'resolved',
      'confirmed',
    ]);
    expect(tl.stamp.variant).toBe('escalated');
  });
});

describe('buildPayslipSpeech', () => {
  const payslip: PayslipResult = {
    lines: [
      { key: 'payslip.basePay', label: 'Base Pay', amount: 15000, type: 'earning' },
      { key: 'payslip.pf', label: 'PF', amount: 1800, type: 'deduction' },
      { key: 'payslip.net', label: 'Net', amount: 13200, type: 'total' },
    ],
    gross: 15000,
    totalDeductions: 1800,
    net: 13200,
    periodStart: '2026-10-01',
    periodEnd: '2026-10-27',
  };

  it('speaks each line and the net, using only engine numbers', () => {
    const en = buildPayslipSpeech(payslip, 'en');
    expect(en).toContain('Base pay, 15,000 rupees.');
    expect(en).toContain('Net pay, 13,200 rupees.');
    expect(en.match(/13,200/g)).toHaveLength(1);
  });

  it('speaks in Hindi and Tamil', () => {
    expect(buildPayslipSpeech(payslip, 'hi')).toContain('रुपये');
    expect(buildPayslipSpeech(payslip, 'ta')).toContain('ரூபாய்');
  });
});

describe('summarizeWeek', () => {
  const now = new Date('2026-10-27T10:00:00Z');

  it('keeps the last 7 days newest first and counts overtime past 8 h', () => {
    const week = summarizeWeek(
      [
        shift('old', '2026-10-10T03:00:00Z', '2026-10-10T11:00:00Z'),
        shift('a', '2026-10-25T03:00:00Z', '2026-10-25T13:00:00Z'),
        shift('b', '2026-10-26T03:00:00Z', '2026-10-26T11:00:00Z'),
        shift('open', '2026-10-27T03:00:00Z', null),
      ],
      now,
    );
    expect(week.rows.map((r) => r.id)).toEqual(['open', 'b', 'a']);
    expect(week.rows[0].open).toBe(true);
    expect(week.rows[2].hours).toBe(10);
    expect(week.overtime.overtimeHours).toBe(2);
    expect(week.totalHours).toBe(18);
  });

  it('is empty when there are no recent shifts', () => {
    const week = summarizeWeek([shift('old', '2026-09-01T03:00:00Z', '2026-09-01T11:00:00Z')], now);
    expect(week.rows).toEqual([]);
    expect(week.totalHours).toBe(0);
  });
});

describe('validateWorkerNext', () => {
  it('allows valid /w/ paths', () => {
    expect(validateWorkerNext('/w/checkin?site=123&code=456')).toBe('/w/checkin?site=123&code=456');
    expect(validateWorkerNext('/w/hours')).toBe('/w/hours');
  });

  it('rejects // evil redirects', () => {
    expect(validateWorkerNext('//evil.com')).toBe('/w');
    expect(validateWorkerNext('//w/checkin')).toBe('/w');
  });

  it('rejects external URLs like https://example.com', () => {
    expect(validateWorkerNext('https://example.com')).toBe('/w');
    expect(validateWorkerNext('http://example.com/w/checkin')).toBe('/w');
  });

  it('rejects non-worker routes like /admin', () => {
    expect(validateWorkerNext('/admin')).toBe('/w');
    expect(validateWorkerNext('/admin/login')).toBe('/w');
    expect(validateWorkerNext('/')).toBe('/w');
  });

  it('handles null / undefined / empty string', () => {
    expect(validateWorkerNext(null)).toBe('/w');
    expect(validateWorkerNext(undefined)).toBe('/w');
    expect(validateWorkerNext('')).toBe('/w');
  });

  it('rejects /w itself (must start with /w/ to go to subpaths, or falls back to /w)', () => {
    expect(validateWorkerNext('/w')).toBe('/w');
  });
});

describe('musterDays', () => {
  // 2026-10-31 15:00 IST.
  const now = new Date('2026-10-31T09:30:00.000Z');

  it('lists the last seven IST days, oldest first, ending today', () => {
    const days = musterDays([], now);
    expect(days.map((d) => d.date)).toEqual([
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
    ]);
    expect(days.filter((d) => d.today).map((d) => d.date)).toEqual(['2026-10-31']);
    expect(days.every((d) => !d.present && d.hours === 0)).toBe(true);
  });

  it('adds up the hours of every shift that started that day, by site time', () => {
    const days = musterDays(
      [
        // 05:00 IST on the 29th, and a second short shift the same evening.
        { date: '2026-10-28T23:30:00.000Z', hours: 8.25 },
        { date: '2026-10-29T12:30:00.000Z', hours: 2 },
        // Older than the strip: ignored.
        { date: '2026-10-20T03:00:00.000Z', hours: 9 },
      ],
      now,
    );
    const byDate = Object.fromEntries(days.map((d) => [d.date, d]));
    expect(byDate['2026-10-29']).toMatchObject({ present: true, hours: 10.3 });
    expect(byDate['2026-10-28']).toMatchObject({ present: false, hours: 0 });
    expect(days.filter((d) => d.present)).toHaveLength(1);
  });
});
