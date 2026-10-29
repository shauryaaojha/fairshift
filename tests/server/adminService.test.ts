import { beforeEach, describe, expect, it } from 'vitest';
import { adminService } from '@/src/server/services/adminService';
import { SECTORS } from '@/src/server/services/sectors';
import {
  acknowledgeHazardForOrg,
  getAttendanceData,
  getFeedbackData,
  getKioskView,
  getOverviewData,
  getPassportByToken,
  getRiskData,
  getSafetyData,
  getSitesData,
  resolveHazardForOrg,
} from '@/src/server/services/adminPages';
import { getDatabase } from '@/src/server/repos';
import { verifySession } from '@/src/server/auth/session';
import { setGeminiForTests } from '@/src/server/ai/client';
import { AppError } from '@/src/shared/errors';
import type { HazardReport } from '@/src/shared/types';

const db = getDatabase();
const { orgId, siteId } = SECTORS.construction;

beforeEach(() => setGeminiForTests(null));

async function freshHazard(over: Partial<HazardReport> = {}): Promise<HazardReport> {
  return db.hazards.create({
    id: `hazard-test-${Math.random().toString(36).slice(2, 8)}`,
    orgId,
    siteId,
    reporterId: null,
    category: 'Fall risk',
    description: 'Open edge on floor 6',
    severity: 'critical',
    status: 'reported',
    reportedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    acknowledgedAt: null,
    resolvedAt: null,
    aiSummary: null,
    aiSuggestedSeverity: null,
    anonymous: true,
    ...over,
  });
}

describe('admin login', () => {
  it('signs a regional admin session with both organisations', async () => {
    const { admin, token } = await adminService.login('admin.regional@fairshift.org', 'Admin@1234');
    expect(admin).not.toHaveProperty('passwordHash');
    expect(verifySession(token)?.orgIds).toEqual(['org-construction', 'org-college']);
  });

  it('gives the same error for an unknown email and a wrong password', async () => {
    await expect(
      adminService.login('admin.skyline@fairshift.org', 'nope-nope'),
    ).rejects.toMatchObject({ code: 'invalid_credentials' });
    await expect(adminService.login('ghost@fairshift.org', 'Admin@1234')).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
  });
});

describe('overview', () => {
  it('counts escalation live: a critical report left 2 hours is escalated', async () => {
    const before = await adminService.getOverviewKPIs(orgId, siteId);
    await freshHazard();
    const after = await adminService.getOverviewKPIs(orgId, siteId);
    expect(after.escalatedHazards).toBe(before.escalatedHazards + 1);
    expect(after.openHazards).toBe(before.openHazards + 1);
  });

  it('builds the whole overview with one consistent set of numbers', async () => {
    const data = await getOverviewData('construction');
    expect(data.trend).toHaveLength(14);
    expect(data.kpis.escalatedHazards).toBe(data.escalated.length);
    expect(data.risk.length).toBeLessThanOrEqual(8);
    expect(data.summary.isAi).toBe(false);
    expect(data.summary.summary).toContain(`${data.kpis.onSiteNow} of ${data.kpis.totalWorkers}`);
  });

  it('ranks workforce risk from highest to lowest and never returns PIN hashes', async () => {
    const ranked = await adminService.getWorkforceRisk(orgId, siteId);
    const scores = ranked.map((w) => w.risk.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(ranked.every((w) => !('pinHash' in w))).toBe(true);
  });
});

describe('hazard actions', () => {
  it('acknowledges then resolves a hazard of an allowed organisation', async () => {
    const h = await freshHazard();
    expect((await acknowledgeHazardForOrg(h.id, orgId)).status).toBe('acknowledged');
    const resolved = await resolveHazardForOrg(h.id, orgId);
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolvedAt).not.toBeNull();
  });

  it("refuses another organisation's hazard as not found", async () => {
    const h = await freshHazard();
    await expect(adminService.acknowledgeHazard(h.id, ['org-college'])).rejects.toBeInstanceOf(
      AppError,
    );
    await expect(adminService.resolveHazard(h.id, ['org-college'])).rejects.toMatchObject({
      code: 'not_found',
    });
  });
});

describe('console pages', () => {
  it('filters the safety queue by live status', async () => {
    await freshHazard();
    const all = await getSafetyData('construction');
    const escalated = await getSafetyData('construction', 'escalated');
    expect(escalated.total).toBe(all.total);
    expect(escalated.rows.every((r) => r.liveStatus === 'escalated')).toBe(true);
    expect(escalated.rows.length).toBeGreaterThan(0);
  });

  it('returns attendance rows with the team list', async () => {
    const data = await getAttendanceData('construction', {});
    expect(data.teams.length).toBeGreaterThan(0);
    expect(data.trend).toHaveLength(14);
  });

  it('only shows comments for teams at or above k = 3', async () => {
    const data = await getFeedbackData('college');
    for (const c of data.comments) {
      const row = data.heatmap.find((r) => r.team === c.team);
      expect(row?.count).toBeGreaterThanOrEqual(3);
    }
  });

  it('filters risk to high-score workers', async () => {
    const { rows } = await getRiskData('construction', { filter: 'high' });
    expect(rows.every((r) => r.risk.score > 50)).toBe(true);
  });

  it('lists sites per allowed sector without the QR secret', async () => {
    const groups = await getSitesData(['construction', 'college']);
    expect(groups.map((g) => g.sector)).toEqual(['construction', 'college']);
    expect(groups.flatMap((g) => g.sites).every((s) => !('qrSecret' in s))).toBe(true);
  });
});

describe('kiosk and passport', () => {
  it('renders a gate QR only for an allowed organisation', async () => {
    const kiosk = await getKioskView(siteId, 'https://example.test', [orgId]);
    expect(kiosk?.code).toMatch(/^\d{6}$/);
    expect(await getKioskView(siteId, 'https://example.test', ['org-college'])).toBeNull();
  });

  it('verifies a skill by its token and rejects a malformed one', async () => {
    const skills = await db.skills.listByWorker('worker-ramesh');
    const view = await getPassportByToken(skills[0].verifyToken);
    expect(view).toMatchObject({ title: skills[0].title, holder: 'Ramesh' });
    expect(await getPassportByToken('not a token')).toBeNull();
    expect(await getPassportByToken('deadbeefdeadbeef')).toBeNull();
  });
});
