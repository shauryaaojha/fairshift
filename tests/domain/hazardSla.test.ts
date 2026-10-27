import { describe, it, expect } from 'vitest';
import {
  computeHazardStatus,
  getSlaHours,
  getRemainingSlaSeconds,
  formatSlaRemaining,
} from '../../src/server/domain/hazardSla';
import type { HazardReport, HazardSeverity } from '../../src/shared/types';

describe('Domain: Hazard SLA & Escalation Engine', () => {
  it('returns standard SLA thresholds', () => {
    expect(getSlaHours('critical')).toBe(1);
    expect(getSlaHours('high')).toBe(4);
    expect(getSlaHours('medium')).toBe(24);
    expect(getSlaHours('low')).toBe(72);
    // fallback
    expect(getSlaHours('unknown' as unknown as HazardSeverity)).toBe(24);
  });

  it('keeps resolved status regardless of timestamps', () => {
    const hazard: Pick<HazardReport, 'status' | 'severity' | 'reportedAt' | 'acknowledgedAt'> = {
      status: 'resolved',
      severity: 'critical',
      reportedAt: '2026-10-20T00:00:00.000Z',
      acknowledgedAt: '2026-10-20T00:30:00.000Z',
    };
    expect(computeHazardStatus(hazard, '2026-10-25T00:00:00.000Z')).toBe('resolved');
  });

  it('keeps acknowledged status if acknowledged within or after SLA', () => {
    const hazard: Pick<HazardReport, 'status' | 'severity' | 'reportedAt' | 'acknowledgedAt'> = {
      status: 'acknowledged',
      severity: 'critical',
      reportedAt: '2026-10-20T00:00:00.000Z',
      acknowledgedAt: '2026-10-20T00:45:00.000Z',
    };
    expect(computeHazardStatus(hazard, '2026-10-25T00:00:00.000Z')).toBe('acknowledged');
  });

  it('handles invalid dates gracefully in computeHazardStatus', () => {
    const hazard: Pick<HazardReport, 'status' | 'severity' | 'reportedAt' | 'acknowledgedAt'> = {
      status: 'reported',
      severity: 'critical',
      reportedAt: 'invalid-date',
      acknowledgedAt: null,
    };
    expect(computeHazardStatus(hazard)).toBe('reported');
  });

  it('computes status as escalated when critical hazard is unacknowledged after 1 hour', () => {
    const reportedAt = '2026-10-27T10:00:00.000Z';
    const hazard: Pick<HazardReport, 'status' | 'severity' | 'reportedAt' | 'acknowledgedAt'> = {
      status: 'reported',
      severity: 'critical',
      reportedAt,
      acknowledgedAt: null,
    };

    // 45 minutes later -> still 'reported'
    const at45m = '2026-10-27T10:45:00.000Z';
    expect(computeHazardStatus(hazard, at45m)).toBe('reported');

    // 65 minutes later -> automatically 'escalated'
    const at65m = '2026-10-27T11:05:00.000Z';
    expect(computeHazardStatus(hazard, at65m)).toBe('escalated');
  });

  it('computes remaining SLA seconds and formats display text', () => {
    const reportedAt = '2026-10-27T10:00:00.000Z';
    const hazard = {
      severity: 'high' as const, // 4 hours SLA
      reportedAt,
      acknowledgedAt: null,
    };

    // Acknowledged case
    expect(getRemainingSlaSeconds({ ...hazard, acknowledgedAt: '2026-10-27T10:15:00Z' })).toBe(0);

    // 2 hours in: 2 hours remaining
    const now2h = '2026-10-27T12:00:00.000Z';
    const remainingSec = getRemainingSlaSeconds(hazard, now2h);
    expect(remainingSec).toBe(7200); // 2 * 3600
    expect(formatSlaRemaining(remainingSec)).toBe('2h 0m remaining');

    // 3h 40m in: 20 minutes remaining (< 1 hour)
    const now3h40 = '2026-10-27T13:40:00.000Z';
    const remaining20m = getRemainingSlaSeconds(hazard, now3h40);
    expect(formatSlaRemaining(remaining20m)).toBe('20m remaining');

    // 4h 15m in: overdue by 15 minutes (< 1 hour overdue)
    const now4h15 = '2026-10-27T14:15:00.000Z';
    const overdue15m = getRemainingSlaSeconds(hazard, now4h15);
    expect(formatSlaRemaining(overdue15m)).toBe('Overdue by 15m');

    // 5 hours in: overdue by 1 hour
    const now5h = '2026-10-27T15:00:00.000Z';
    const overdueSec = getRemainingSlaSeconds(hazard, now5h);
    expect(overdueSec).toBe(-3600);
    expect(formatSlaRemaining(overdueSec)).toBe('Overdue by 1h 0m');
  });
});
