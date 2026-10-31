import { describe, it, expect } from 'vitest';
import {
  buildAttendanceRows,
  buildHeatmapRows,
  buildNeedsAction,
  buildStateSegments,
  filterHazards,
  filterRiskRows,
  toHazardRows,
  type RiskRow,
} from '@/src/server/services/adminRows';
import { confirmHazardSeverity, getOverviewData } from '@/src/server/services/adminPages';
import { resolveSector, sectorForOrg } from '@/src/server/services/sectors';
import { getDatabase } from '@/src/server/repos';
import type { HazardReport, Shift, Worker } from '@/src/shared/types';

const hazard = (over: Partial<HazardReport>): HazardReport => ({
  id: 'h',
  orgId: 'org-construction',
  siteId: 's',
  reporterId: null,
  category: 'Fall',
  description: 'x',
  severity: 'high',
  status: 'reported',
  reportedAt: '2026-10-27T08:00:00.000Z',
  acknowledgedAt: null,
  resolvedAt: null,
  aiSummary: null,
  aiSuggestedSeverity: null,
  anonymous: true,
  ...over,
});

describe('sector helpers', () => {
  it('defaults to construction and maps orgs', () => {
    expect(resolveSector(undefined)).toBe('construction');
    expect(resolveSector('college')).toBe('college');
    expect(resolveSector('nonsense')).toBe('construction');
    expect(sectorForOrg('org-college')).toBe('college');
    expect(sectorForOrg('org-construction')).toBe('construction');
  });
});

describe('buildStateSegments', () => {
  it('links each number to its rows and pluralises', () => {
    const segs = buildStateSegments({
      onSiteNow: 43,
      totalWorkers: 51,
      escalatedHazards: 1,
      fatigueFlags: 5,
    });
    expect(segs.map((s) => s.text).join('')).toBe(
      '43 of 51 on site · 1 hazard escalated · 5 workers flagged for fatigue',
    );
    expect(segs.filter((s) => s.href).map((s) => s.href)).toEqual([
      '/admin/attendance?status=on-site',
      '/admin/safety?status=escalated',
      '/admin/risk?filter=fatigue',
    ]);
  });
});

describe('buildHeatmapRows', () => {
  it('hides rows below k and sorts teams', () => {
    const rows = buildHeatmapRows([
      {
        team: 'B',
        isoWeek: 'w',
        count: 3,
        averages: { managerRespect: 4, safetyRating: 3, payFairness: 2, workloadRating: 5 },
        comments: null,
      },
      { team: 'A', isoWeek: 'w', count: 1, averages: null, comments: null },
    ]);
    expect(rows.map((r) => r.team)).toEqual(['A', 'B']);
    expect(rows[0].hidden).toBe(true);
    expect(rows[1].hidden).toBe(false);
    expect(rows[1].cells.map((c) => c.value)).toEqual([4, 3, 2, 5]);
  });
});

describe('hazard rows', () => {
  const now = new Date('2026-10-27T10:00:00.000Z');
  const rows = toHazardRows(
    [
      hazard({ id: 'late', severity: 'critical' }),
      hazard({ id: 'soon', severity: 'low' }),
      hazard({
        id: 'done',
        status: 'resolved',
        resolvedAt: '2026-10-27T09:00:00.000Z',
        acknowledgedAt: '2026-10-27T08:10:00.000Z',
      }),
      hazard({ id: 'acked', acknowledgedAt: '2026-10-27T08:30:00.000Z', status: 'acknowledged' }),
    ],
    now,
  );

  it('computes live status and orders by urgency', () => {
    expect(rows.map((r) => r.id)).toEqual(['late', 'soon', 'acked', 'done']);
    expect(rows[0].liveStatus).toBe('escalated');
    expect(rows[0].slaLabel).toMatch(/overdue/i);
    expect(rows[1].liveStatus).toBe('reported');
    expect(rows[3].slaLabel).toBe('Resolved');
  });

  it('filters by status', () => {
    expect(filterHazards(rows, 'escalated').map((r) => r.id)).toEqual(['late']);
    expect(filterHazards(rows, 'open')).toHaveLength(3);
    expect(filterHazards(rows, 'all')).toHaveLength(4);
    expect(filterHazards(rows, undefined)).toHaveLength(4);
  });
});

describe('buildAttendanceRows', () => {
  const worker = (id: string, team: string): Worker =>
    ({ id, name: `W ${id}`, team }) as unknown as Worker;
  const workers = [worker('a', 'Masonry'), worker('b', 'Electrical')];
  const shift = (
    id: string,
    workerId: string,
    checkIn: string,
    checkOut: string | null,
  ): Shift => ({
    id,
    workerId,
    siteId: 's',
    orgId: 'o',
    checkIn,
    checkOut,
    method: 'qr',
  });
  const shifts = [
    shift('1', 'a', '2026-10-27T08:00:00.000Z', null),
    shift('2', 'b', '2026-10-26T08:00:00.000Z', '2026-10-26T17:30:00.000Z'),
    shift('3', 'a', '2026-09-01T08:00:00.000Z', '2026-09-01T16:00:00.000Z'),
  ];

  it('keeps the last 14 days, newest first, and computes hours', () => {
    const rows = buildAttendanceRows(shifts, workers);
    expect(rows.map((r) => r.shiftId)).toEqual(['1', '2']);
    expect(rows[1].hours).toBe(9.5);
    expect(rows[0].onSite).toBe(true);
  });

  it('filters by status and team', () => {
    expect(
      buildAttendanceRows(shifts, workers, { status: 'on-site' }).map((r) => r.shiftId),
    ).toEqual(['1']);
    expect(
      buildAttendanceRows(shifts, workers, { status: 'over-8' }).map((r) => r.shiftId),
    ).toEqual(['2']);
    expect(
      buildAttendanceRows(shifts, workers, { team: 'Electrical' }).map((r) => r.shiftId),
    ).toEqual(['2']);
  });
});

describe('filterRiskRows', () => {
  const row = (id: string, team: string, score: number, factor: string): RiskRow =>
    ({
      id,
      team,
      risk: { score, topReasons: [{ factor, weight: score, detail: 'd' }] },
    }) as unknown as RiskRow;
  const rows = [row('1', 'A', 70, 'ot_load'), row('2', 'B', 20, 'attendance_drop')];

  it('filters high risk, fatigue and team', () => {
    expect(filterRiskRows(rows, 'high').map((r) => r.id)).toEqual(['1']);
    expect(filterRiskRows(rows, 'fatigue').map((r) => r.id)).toEqual(['1']);
    expect(filterRiskRows(rows, 'all', 'B').map((r) => r.id)).toEqual(['2']);
    expect(filterRiskRows(rows, undefined)).toHaveLength(2);
  });
});

describe('confirmHazardSeverity', () => {
  it("lowering an escalated hazard throws 'Cannot lower the severity of an escalated hazard'", async () => {
    const db = getDatabase();
    const testHazard = hazard({
      id: 'h-esc-lower',
      orgId: 'org-construction',
      severity: 'high',
      status: 'reported',
      reportedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      acknowledgedAt: null,
    });
    await db.hazards.create(testHazard);

    await expect(confirmHazardSeverity('h-esc-lower', 'org-construction', 'low')).rejects.toThrow(
      'Cannot lower the severity of an escalated hazard',
    );
  });

  it('raising an escalated hazard works (e.g. from high to critical)', async () => {
    const db = getDatabase();
    const testHazard = hazard({
      id: 'h-esc-raise',
      orgId: 'org-construction',
      severity: 'high',
      status: 'reported',
      reportedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      acknowledgedAt: null,
    });
    await db.hazards.create(testHazard);

    const updated = await confirmHazardSeverity('h-esc-raise', 'org-construction', 'critical');
    expect(updated.severity).toBe('critical');
  });

  it('lowering a non-escalated hazard works (e.g. from high to low when not escalated)', async () => {
    const db = getDatabase();
    const testHazard = hazard({
      id: 'h-non-esc-lower',
      orgId: 'org-construction',
      severity: 'high',
      status: 'reported',
      reportedAt: new Date(Date.now() - 60 * 1000).toISOString(),
      acknowledgedAt: null,
    });
    await db.hazards.create(testHazard);

    const updated = await confirmHazardSeverity('h-non-esc-lower', 'org-construction', 'low');
    expect(updated.severity).toBe('low');
  });
});

describe('buildNeedsAction', () => {
  const none = {
    escalated: 0,
    newHazards: 0,
    payWaiting: 0,
    payOverdue: 0,
    wagesOverdue: 0,
    fatigue: 0,
    highRisk: 0,
  };

  it('is empty when nothing waits', () => {
    expect(buildNeedsAction(none)).toEqual([]);
  });

  it('puts missed hazard deadlines first and keeps only kinds with work', () => {
    const items = buildNeedsAction({ ...none, escalated: 2, highRisk: 3, wagesOverdue: 1 });
    expect(items.map((i) => i.key)).toEqual(['escalated', 'wages', 'risk']);
    expect(items[0]).toMatchObject({
      count: 2,
      urgent: true,
      href: '/admin/safety?status=escalated',
    });
    expect(items[1].href).toBe('/admin/pay?tab=wages');
    expect(items[2].urgent).toBe(false);
  });

  it('marks pay questions urgent only once one is past its deadline', () => {
    const open = buildNeedsAction({ ...none, payWaiting: 2 })[0];
    expect(open).toMatchObject({ key: 'pay', count: 2, urgent: false });
    const late = buildNeedsAction({ ...none, payWaiting: 2, payOverdue: 1 })[0];
    expect(late.urgent).toBe(true);
    expect(late.detail).toMatch(/1 past/);
  });
});

describe('overview needs-action list', () => {
  it('matches the KPIs it is built from and links into the console', async () => {
    const data = await getOverviewData('construction');
    const byKey = Object.fromEntries(data.actions.map((a) => [a.key, a]));
    expect(byKey.escalated?.count ?? 0).toBe(data.escalated.length);
    expect(byKey.fatigue?.count ?? 0).toBe(data.kpis.fatigueFlags);
    expect(byKey.risk?.count ?? 0).toBe(data.kpis.highQuitRisk);
    for (const a of data.actions) {
      expect(a.count).toBeGreaterThan(0);
      expect(a.href.startsWith('/admin/')).toBe(true);
    }
  });
});
