import { afterEach, describe, expect, it } from 'vitest';
import { setGeminiForTests } from '@/src/server/ai/client';
import {
  adminFallback,
  askAsAdmin,
  buildAdminTools,
  routeAdminQuestion,
} from '@/src/server/assistant/admin';
import { SECTORS } from '@/src/server/services/sectors';
import { adminService } from '@/src/server/services/adminService';

const construction = SECTORS.construction;

function runner() {
  const tools = new Map(buildAdminTools(construction).map((t) => [t.name, t]));
  return async (name: string) => (tools.has(name) ? tools.get(name)!.run() : null);
}

afterEach(() => setGeminiForTests(undefined));

describe('routeAdminQuestion', () => {
  it.each([
    ['Which hazards are overdue?', 'list_open_hazards'],
    ['Who is most likely to quit?', 'list_quit_risk'],
    ['How is team morale?', 'get_team_feedback'],
    ['Is attendance dropping?', 'get_attendance_trend'],
    ['Give me an overview', 'get_site_overview'],
  ])('routes "%s" to %s', (question, tool) => {
    expect(routeAdminQuestion(question)).toContain(tool);
  });
});

describe('admin tools', () => {
  it('read the sector the admin is viewing', async () => {
    const overview = await runner()('get_site_overview');
    const kpis = await adminService.getOverviewKPIs(construction.orgId, construction.siteId);
    expect(overview).toMatchObject({ site: construction.place, ...kpis });
  });

  it('never send feedback scores for a team under 3 answers', async () => {
    const data = (await runner()('get_team_feedback')) as {
      teams: Array<{ hidden?: boolean; answers?: number; scores?: unknown }>;
    };
    for (const team of data.teams) {
      if (team.hidden) expect(team.scores).toBeUndefined();
      else expect(team.answers).toBeGreaterThanOrEqual(3);
    }
  });

  it('list open hazards most urgent first', async () => {
    const data = (await runner()('list_open_hazards')) as {
      hazards: Array<{ status: string }>;
    };
    const order = { escalated: 0, reported: 1, acknowledged: 2, resolved: 3 } as const;
    const ranks = data.hazards.map((h) => order[h.status as keyof typeof order]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(data.hazards.every((h) => h.status !== 'resolved')).toBe(true);
  });
});

describe('adminFallback', () => {
  it('defaults to the overview for an open question', async () => {
    const res = await adminFallback('anything I should know?', runner());
    expect(res.tools).toEqual(['get_site_overview']);
    expect(res.text).toContain('workers on site now');
  });

  it('names the top quit-risk workers with a reason', async () => {
    const res = await adminFallback('who might quit?', runner());
    expect(res.text).toMatch(/^Highest quit risk: .+\/100/);
  });
});

describe('askAsAdmin', () => {
  it('answers without an API key and links to the console page', async () => {
    setGeminiForTests(null);
    const res = await askAsAdmin(construction, 'Which hazards are escalated?', []);
    expect(res.isAi).toBe(false);
    expect(res.sources[0]).toMatchObject({ tool: 'list_open_hazards', href: '/admin/safety' });
  });
});
