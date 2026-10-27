import { describe, it, expect } from 'vitest';
import { scrubPii, calculateIsoWeek, aggregateFeedback } from '../../src/server/domain/anonymity';
import type { FeedbackSubmission } from '../../src/shared/types';

describe('Domain: Anonymity & PII Scrubbing Engine', () => {
  describe('scrubPii', () => {
    it('handles empty or whitespace strings', () => {
      expect(scrubPii('')).toBe('');
      expect(scrubPii('hello', ['', '   ', 'a'])).toBe('hello');
    });

    it('redacts phone numbers', () => {
      const input = 'Call me at 9876543210 or +91-9123456789 regarding safety.';
      const output = scrubPii(input);
      expect(output).not.toContain('9876543210');
      expect(output).not.toContain('9123456789');
      expect(output).toContain('[REDACTED_PHONE]');
    });

    it('redacts email addresses', () => {
      const input = 'Reach out to supervisor.john@example.com immediately.';
      const output = scrubPii(input);
      expect(output).not.toContain('supervisor.john@example.com');
      expect(output).toContain('[REDACTED_EMAIL]');
    });

    it('redacts worker names from roster', () => {
      const input = 'Ramesh and Murugan did not get drinking water on site.';
      const output = scrubPii(input, ['Ramesh Kumar', 'Ramesh', 'Murugan']);
      expect(output).not.toContain('Ramesh');
      expect(output).not.toContain('Murugan');
      expect(output).toContain('[REDACTED_NAME]');
    });

    it('redacts first name alone when roster contains full name', () => {
      const input = 'Ramesh shouts at us';
      const output = scrubPii(input, ['Ramesh Kumar']);
      expect(output).toBe('[REDACTED_NAME] shouts at us');
      expect(output).not.toContain('Ramesh');
    });

    it('redacts Devanagari names', () => {
      const input = 'रमेश हमें डांटता है';
      const output = scrubPii(input, ['रमेश कुमार']);
      expect(output).toBe('[REDACTED_NAME] हमें डांटता है');
      expect(output).not.toContain('रमेश');
    });

    it('redacts Tamil names', () => {
      const input = 'முருகன் வேலை செய்கிறார்';
      const output = scrubPii(input, ['முருகன்']);
      expect(output).toBe('[REDACTED_NAME] வேலை செய்கிறார்');
      expect(output).not.toContain('முருகன்');
    });

    it('redacts Devanagari-digit phone numbers', () => {
      const input = '९८७६५४३२१०';
      const output = scrubPii(input);
      expect(output).toBe('[REDACTED_PHONE]');
      expect(output).not.toContain('९८७६५४३२१०');
    });

    it('does not redact words that merely contain a name inside them', () => {
      const input = 'Rameshwaram is a city';
      const output = scrubPii(input, ['Ramesh Kumar']);
      expect(output).toBe('Rameshwaram is a city');
      expect(output).not.toContain('[REDACTED_NAME]');
    });
  });

  describe('calculateIsoWeek', () => {
    it('calculates ISO week string correctly from string or Date', () => {
      const date = new Date('2026-10-27T12:00:00.000Z');
      const isoWeek = calculateIsoWeek(date);
      expect(isoWeek).toMatch(/^2026-W\d{2}$/);
      expect(calculateIsoWeek('2026-01-05T00:00:00.000Z')).toMatch(/^2026-W\d{2}$/);
    });
  });

  describe('aggregateFeedback', () => {
    const submissions: FeedbackSubmission[] = [
      {
        id: 'f1',
        orgId: 'o1',
        siteId: 's1',
        team: 'Masonry',
        isoWeek: '2026-W43',
        managerRespect: 4,
        safetyRating: 5,
        payFairness: 4,
        workloadRating: 3,
        comment: 'Site manager was helpful today.',
      },
      {
        id: 'f2',
        orgId: 'o1',
        siteId: 's1',
        team: 'Masonry',
        isoWeek: '2026-W43',
        managerRespect: 3,
        safetyRating: 4,
        payFairness: 3,
        workloadRating: 4,
        comment: 'Need better gloves.',
      },
      {
        id: 'f3',
        orgId: 'o1',
        siteId: 's1',
        team: 'Masonry',
        isoWeek: '2026-W43',
        managerRespect: 5,
        safetyRating: 5,
        payFairness: 5,
        workloadRating: 5,
        comment: 'Call 9876543210 for more info.',
      },
    ];

    it('suppresses feedback when count is below k = 3', () => {
      const result = aggregateFeedback(submissions.slice(0, 2), 'Masonry', '2026-W43', 3);
      expect(result.count).toBe(2);
      expect(result.averages).toBeNull();
      expect(result.comments).toBeNull();
    });

    it('displays averages and scrubs comments when count >= k = 3', () => {
      const result = aggregateFeedback(submissions, 'Masonry', '2026-W43', 3);
      expect(result.count).toBe(3);
      expect(result.averages).not.toBeNull();
      expect(result.averages?.managerRespect).toBe(4);
      expect(result.averages?.safetyRating).toBe(4.7);
      expect(result.comments?.length).toBe(3);
      expect(result.comments?.[2]).toContain('[REDACTED_PHONE]');
    });

    it('handles submissions with null or empty comments', () => {
      const noCommentSubs: FeedbackSubmission[] = submissions.map((s) => ({
        ...s,
        comment: null,
      }));
      const result = aggregateFeedback(noCommentSubs, 'Masonry', '2026-W43', 3);
      expect(result.comments).toBeNull();
    });
  });
});
