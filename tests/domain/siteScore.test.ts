import { describe, expect, it } from 'vitest';
import {
  bandFor,
  respectFrom,
  siteScore,
  type SiteScoreInput,
} from '@/src/server/domain/siteScore';

const base: SiteScoreInput = {
  workers: 20,
  fatigued: 0,
  likelyToLeave: 0,
  hazards: 10,
  escalated: 0,
  respect: 5,
  wagesOwed: 20,
  wagesOverdue: 0,
};

describe('siteScore', () => {
  it('is 100 when every part is perfect', () => {
    expect(siteScore(base)).toMatchObject({ score: 100, band: 'good', missing: [] });
  });

  it('is the plain average of the parts, each traceable to a count', () => {
    const s = siteScore({
      ...base,
      fatigued: 5, // hours 75
      escalated: 5, // safety 50
      respect: 3, // respect 50
      wagesOverdue: 10, // wages 50
      likelyToLeave: 2, // retention 90
    });
    expect(Object.fromEntries(s.parts.map((p) => [p.key, p.value]))).toEqual({
      safety: 50,
      hours: 75,
      wages: 50,
      respect: 50,
      retention: 90,
    });
    expect(s.score).toBe(63);
    expect(s.band).toBe('fair');
    expect(s.parts.find((p) => p.key === 'wages')!.detail).toBe(
      '10 of 20 workers were not paid last month by the 7th.',
    );
  });

  it('leaves out a part with nothing to measure instead of scoring it 0 or 100', () => {
    const s = siteScore({ ...base, hazards: 0, respect: null, wagesOwed: 0, fatigued: 10 });
    expect(s.parts.map((p) => p.key)).toEqual(['hours', 'retention']);
    expect(s.missing.map((m) => m.key)).toEqual(['safety', 'wages', 'respect']);
    expect(s.score).toBe(75);
  });

  it('has no score with no workers and no reports', () => {
    expect(
      siteScore({ ...base, workers: 0, hazards: 0, respect: null, wagesOwed: 0 }),
    ).toMatchObject({ score: null, band: null });
  });

  it('keeps out-of-range ratings inside 0 to 100', () => {
    expect(siteScore({ ...base, respect: 9 }).parts.find((p) => p.key === 'respect')!.value).toBe(
      100,
    );
  });

  it.each([
    [80, 'good'],
    [79, 'fair'],
    [60, 'fair'],
    [59, 'poor'],
  ] as const)('%i is %s', (score, band) => {
    expect(bandFor(score)).toBe(band);
  });
});

describe('respectFrom', () => {
  it('weights each team by how many answered, and skips hidden teams', () => {
    expect(
      respectFrom([
        { count: 3, averages: { managerRespect: 2 } },
        { count: 1, averages: { managerRespect: 4 } },
        { count: 2, averages: null },
      ]),
    ).toBe(2.5);
  });

  it('is null when no team has enough answers to show', () => {
    expect(respectFrom([{ count: 2, averages: null }])).toBeNull();
    expect(respectFrom([])).toBeNull();
  });
});
