import { describe, it, expect } from 'vitest';
import { computeFeedbackHeatmap, adminService } from '../../src/server/services/adminService';
import type { FeedbackSubmission } from '../../src/shared/types';

describe('Server: Feedback Heatmap Service', () => {
  const createSubmission = (overrides: Partial<FeedbackSubmission> = {}): FeedbackSubmission => ({
    id: `fb-${Math.random().toString(36).slice(2, 9)}`,
    orgId: 'org-test',
    siteId: 'site-test',
    team: 'Masonry',
    isoWeek: '2026-W43',
    managerRespect: 4,
    safetyRating: 5,
    payFairness: 4,
    workloadRating: 3,
    comment: 'Good conditions on site.',
    ...overrides,
  });

  describe('computeFeedbackHeatmap', () => {
    it('returns empty list for empty submissions', () => {
      const result = computeFeedbackHeatmap([]);
      expect(result).toEqual([]);
    });

    it('ensures submissions across different weeks do NOT mix to meet k=3', () => {
      // 2 submissions in W42 and 1 submission in W43
      const submissions: FeedbackSubmission[] = [
        createSubmission({
          team: 'Electrical',
          isoWeek: '2026-W42',
          managerRespect: 4,
          comment: 'Older week feedback 1',
        }),
        createSubmission({
          team: 'Electrical',
          isoWeek: '2026-W42',
          managerRespect: 5,
          comment: 'Older week feedback 2',
        }),
        createSubmission({
          team: 'Electrical',
          isoWeek: '2026-W43',
          managerRespect: 3,
          comment: 'Current week feedback',
        }),
      ];

      const result = computeFeedbackHeatmap(submissions);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        team: 'Electrical',
        isoWeek: '2026-W43',
        count: 1,
        averages: null,
        comments: null,
      });
    });

    it('computes averages and scrubs comments when a team has >= 3 submissions in the most recent week', () => {
      const rosterNames = ['Ramesh Kumar', 'Suresh'];
      const submissions: FeedbackSubmission[] = [
        createSubmission({
          team: 'Masonry',
          isoWeek: '2026-W42',
          managerRespect: 2,
        }),
        createSubmission({
          team: 'Masonry',
          isoWeek: '2026-W43',
          managerRespect: 4,
          safetyRating: 5,
          payFairness: 4,
          workloadRating: 3,
          comment: 'Ramesh Kumar provided great help.',
        }),
        createSubmission({
          team: 'Masonry',
          isoWeek: '2026-W43',
          managerRespect: 5,
          safetyRating: 4,
          payFairness: 5,
          workloadRating: 4,
          comment: 'Safety gear was distributed.',
        }),
        createSubmission({
          team: 'Masonry',
          isoWeek: '2026-W43',
          managerRespect: 3,
          safetyRating: 3,
          payFairness: 3,
          workloadRating: 5,
          comment: 'Need more water points.',
        }),
      ];

      const result = computeFeedbackHeatmap(submissions, rosterNames);

      expect(result).toHaveLength(1);
      const masonryResult = result[0];
      expect(masonryResult.team).toBe('Masonry');
      expect(masonryResult.isoWeek).toBe('2026-W43');
      expect(masonryResult.count).toBe(3);
      expect(masonryResult.averages).not.toBeNull();
      expect(masonryResult.averages).toEqual({
        managerRespect: 4, // (4 + 5 + 3) / 3
        safetyRating: 4, // (5 + 4 + 3) / 3
        payFairness: 4, // (4 + 5 + 3) / 3
        workloadRating: 4, // (3 + 4 + 5) / 3
      });
      expect(masonryResult.comments).toHaveLength(3);
      expect(masonryResult.comments?.[0]).toContain('[REDACTED_NAME]');
    });

    it('returns only the most recent ISO week with data for each team', () => {
      const submissions: FeedbackSubmission[] = [
        createSubmission({ team: 'Team A', isoWeek: '2026-W40' }),
        createSubmission({ team: 'Team A', isoWeek: '2026-W43' }),
        createSubmission({ team: 'Team A', isoWeek: '2026-W41' }),
        createSubmission({ team: 'Team B', isoWeek: '2026-W41' }),
        createSubmission({ team: 'Team B', isoWeek: '2026-W39' }),
      ];

      const result = computeFeedbackHeatmap(submissions);

      expect(result).toHaveLength(2);

      const teamA = result.find((r) => r.team === 'Team A');
      expect(teamA).toBeDefined();
      expect(teamA?.isoWeek).toBe('2026-W43');
      expect(teamA?.count).toBe(1);

      const teamB = result.find((r) => r.team === 'Team B');
      expect(teamB).toBeDefined();
      expect(teamB?.isoWeek).toBe('2026-W41');
      expect(teamB?.count).toBe(1);
    });

    it('handles multiple teams across year transitions properly', () => {
      const submissions: FeedbackSubmission[] = [
        createSubmission({ team: 'Team X', isoWeek: '2025-W52' }),
        createSubmission({ team: 'Team X', isoWeek: '2026-W01' }),
      ];

      const result = computeFeedbackHeatmap(submissions);
      expect(result).toHaveLength(1);
      expect(result[0].isoWeek).toBe('2026-W01');
    });
  });

  describe('adminService.getFeedbackHeatmap', () => {
    it('retrieves and aggregates feedback for an organization from repository', async () => {
      const result = await adminService.getFeedbackHeatmap(
        'org-construction',
        'site-skyline-chennai',
      );
      expect(Array.isArray(result)).toBe(true);
      // In seeded data, Masonry has 4 submissions in DEMO_WEEK
      const masonry = result.find((r) => r.team === 'Masonry');
      if (masonry) {
        expect(masonry.count).toBeGreaterThanOrEqual(3);
        expect(masonry.averages).not.toBeNull();
      }
    });
  });
});
