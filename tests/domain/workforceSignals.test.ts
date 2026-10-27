import { describe, expect, it } from 'vitest';
import {
  calculateAttendanceDrop,
  teamSentimentAverage,
} from '../../src/server/domain/workforceSignals';
import type { FeedbackSubmission, Shift } from '../../src/shared/types';

const now = new Date('2026-10-27T12:00:00.000Z');

function shiftOn(daysAgo: number): Shift {
  const checkIn = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: `s${daysAgo}`,
    workerId: 'w1',
    siteId: 'site',
    orgId: 'org',
    checkIn,
    checkOut: checkIn,
    method: 'qr',
  } as Shift;
}

function feedback(team: string, rating: number): FeedbackSubmission {
  return {
    id: `${team}-${rating}-${Math.random()}`,
    orgId: 'org',
    siteId: 'site',
    team,
    isoWeek: '2026-W44',
    managerRespect: rating,
    safetyRating: rating,
    payFairness: rating,
    workloadRating: rating,
    comment: null,
  };
}

describe('calculateAttendanceDrop', () => {
  it('returns the percentage fall in days attended week over week', () => {
    // previous week: 6 days, last week: 3 days -> 50% drop
    const shifts = [1, 2, 3, 8, 9, 10, 11, 12, 13].map(shiftOn);
    expect(calculateAttendanceDrop(shifts, now)).toBe(50);
  });

  it('counts a day once even with several shifts on it', () => {
    const shifts = [shiftOn(1), shiftOn(1), shiftOn(8), shiftOn(9)];
    expect(calculateAttendanceDrop(shifts, now)).toBe(50);
  });

  it('returns 0 when attendance went up', () => {
    const shifts = [1, 2, 3, 4, 8].map(shiftOn);
    expect(calculateAttendanceDrop(shifts, now)).toBe(0);
  });

  it('returns 0 when there is no earlier week to compare', () => {
    expect(calculateAttendanceDrop([shiftOn(1)], now)).toBe(0);
    expect(calculateAttendanceDrop([], now)).toBe(0);
  });

  it('ignores shifts older than two windows', () => {
    const shifts = [shiftOn(1), shiftOn(20), shiftOn(30)];
    expect(calculateAttendanceDrop(shifts, now)).toBe(0);
  });
});

describe('teamSentimentAverage', () => {
  it('averages all four ratings for the team', () => {
    const subs = [
      feedback('Masonry', 2),
      feedback('Masonry', 3),
      feedback('Masonry', 4),
      feedback('Electrical', 5),
    ];
    expect(teamSentimentAverage(subs, 'Masonry')).toBe(3);
  });

  it('returns 0 below the anonymity threshold', () => {
    const subs = [feedback('Masonry', 1), feedback('Masonry', 1)];
    expect(teamSentimentAverage(subs, 'Masonry')).toBe(0);
  });

  it('respects a custom k', () => {
    const subs = [feedback('Masonry', 2), feedback('Masonry', 4)];
    expect(teamSentimentAverage(subs, 'Masonry', 2)).toBe(3);
  });
});
