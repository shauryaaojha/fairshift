import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateSeedData } from '../../src/server/seed';

describe('Seed Data Generator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates consistent, deterministic seed data for a fixed Date.now', async () => {
    const fixedNow = new Date('2026-10-27T10:00:00.000Z').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(fixedNow);

    const data = await generateSeedData();

    // Verify entity counts
    expect(data.orgs).toHaveLength(2);
    expect(data.sites).toHaveLength(2);
    expect(data.workers).toHaveLength(50);
    expect(data.admins).toHaveLength(3);
    expect(data.hazards).toHaveLength(5);
    expect(data.feedback).toHaveLength(9);
    expect(data.skills).toHaveLength(4);
    expect(data.shifts.length).toBeGreaterThan(500);

    // Snapshot fixed entity IDs
    expect(data.orgs.map((o) => o.id)).toEqual(['org-construction', 'org-college']);
    expect(data.sites.map((s) => s.id)).toEqual(['site-skyline-chennai', 'site-srm-campus']);
    expect(data.admins.map((a) => a.id)).toEqual([
      'admin-skyline',
      'admin-campus',
      'admin-regional',
    ]);
    expect(data.hazards.map((h) => h.id)).toEqual([
      'hazard-1',
      'hazard-2',
      'hazard-3',
      'hazard-4',
      'hazard-5',
    ]);

    // Check specific worker IDs
    expect(data.workers[0].id).toBe('worker-ramesh');
    expect(data.workers[0].name).toBe('Ramesh Kumar');
    expect(data.workers[30].id).toBe('worker-murugan');
    expect(data.workers[30].name).toBe('Murugan Swaminathan');

    // Reproducibility check: calling it again with same Date.now yields exact same shift count & shift IDs
    const data2 = await generateSeedData();
    expect(data2.shifts.length).toBe(data.shifts.length);
    expect(data2.shifts[0]).toEqual(data.shifts[0]);
    expect(data2.shifts[data.shifts.length - 1]).toEqual(data.shifts[data.shifts.length - 1]);
  });
});
