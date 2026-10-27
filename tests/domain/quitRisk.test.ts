import { describe, it, expect } from 'vitest';
import { calculateQuitRisk } from '../../src/server/domain/quitRisk';
import type { FatigueFlag } from '../../src/shared/types';

describe('Domain: Quit Risk Engine', () => {
  it('returns baseline for normal safe working conditions', () => {
    const res = calculateQuitRisk({
      weeklyHours: 40,
      fatigueFlags: [],
      attendanceDropPct: 0,
      unresolvedComplaints: 0,
      teamFeedbackTrend: 4.5,
    });

    expect(res.score).toBe(0);
    expect(res.topReasons.length).toBeGreaterThan(0);
    expect(res.topReasons[0].factor).toBe('normal_conditions');
  });

  it('calculates elevated risk and top 3 reasons when multiple adverse factors are present', () => {
    const fatigueFlags: FatigueFlag[] = [
      {
        type: 'short_rest',
        messageKey: 'fatigue.short_rest',
        params: { gapHours: 6 },
      },
      {
        type: 'long_shift',
        messageKey: 'fatigue.long_shift',
        params: { hours: 12 },
      },
    ];

    const res = calculateQuitRisk({
      weeklyHours: 58, // +10h excess -> ot_load ~25 pts
      fatigueFlags, // 2 flags -> ~16 pts
      attendanceDropPct: 20, // drop -> ~16 pts
      unresolvedComplaints: 2, // complaints -> 10 pts
      teamFeedbackTrend: 2.1, // low team sentiment -> ~6 pts
    });

    expect(res.score).toBeGreaterThan(50);
    expect(res.topReasons.length).toBe(3);
    // Highest contributing factor should be first
    expect(res.topReasons[0].weight).toBeGreaterThanOrEqual(res.topReasons[1].weight);
    expect(res.topReasons[1].weight).toBeGreaterThanOrEqual(res.topReasons[2].weight);
  });

  it('caps risk score at 100', () => {
    const manyFlags: FatigueFlag[] = Array(10).fill({
      type: 'short_rest',
      messageKey: 'test',
      params: {},
    });

    const res = calculateQuitRisk({
      weeklyHours: 80,
      fatigueFlags: manyFlags,
      attendanceDropPct: 80,
      unresolvedComplaints: 10,
      teamFeedbackTrend: 1.0,
    });

    expect(res.score).toBe(100);
  });
});
