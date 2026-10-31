import { describe, expect, it } from 'vitest';
import {
  applyReporterVerdict,
  canGiveVerdict,
  closureState,
  markResolved,
} from '@/src/server/domain/hazardClosure';
import { computeHazardStatus } from '@/src/server/domain/hazardSla';
import type { HazardReport } from '@/src/shared/types';

const NOW = new Date('2026-10-27T10:00:00Z');

const named: HazardReport = {
  id: 'hazard-x',
  orgId: 'org-1',
  siteId: 'site-1',
  reporterId: 'worker-1',
  category: 'Fall',
  description: 'Broken ladder rung',
  severity: 'high',
  status: 'resolved',
  reportedAt: '2026-10-27T06:00:00Z',
  acknowledgedAt: '2026-10-27T06:30:00Z',
  resolvedAt: '2026-10-27T09:00:00Z',
  aiSummary: null,
  aiSuggestedSeverity: null,
  anonymous: false,
  reporterVerdict: null,
};

describe('closureState', () => {
  it('is open until a supervisor resolves the report', () => {
    expect(closureState({ ...named, status: 'acknowledged' })).toBe('open');
    expect(closureState({ ...named, status: 'escalated' })).toBe('open');
  });

  it('waits for a named reporter after the supervisor resolves it', () => {
    expect(closureState(named)).toBe('awaiting_reporter');
    // Records stored before two-key closure have no verdict field at all.
    expect(closureState({ ...named, reporterVerdict: undefined })).toBe('awaiting_reporter');
  });

  it('is confirmed once the reporter says fixed', () => {
    expect(closureState({ ...named, reporterVerdict: 'fixed' })).toBe('confirmed');
  });

  it('closes an anonymous report on the supervisor word alone', () => {
    expect(closureState({ ...named, reporterId: null })).toBe('closed');
  });
});

describe('canGiveVerdict', () => {
  it('lets only the reporter answer, and only while the report waits', () => {
    expect(canGiveVerdict(named, 'worker-1')).toBe(true);
    expect(canGiveVerdict(named, 'worker-2')).toBe(false);
    expect(canGiveVerdict({ ...named, reporterVerdict: 'fixed' }, 'worker-1')).toBe(false);
    expect(canGiveVerdict({ ...named, status: 'acknowledged' }, 'worker-1')).toBe(false);
    expect(canGiveVerdict({ ...named, reporterId: null }, 'worker-1')).toBe(false);
  });
});

describe('applyReporterVerdict', () => {
  it('"fixed" keeps the report resolved and records when', () => {
    const h = applyReporterVerdict(named, 'fixed', NOW);
    expect(h).toMatchObject({
      status: 'resolved',
      resolvedAt: named.resolvedAt,
      reporterVerdict: 'fixed',
      verdictAt: NOW.toISOString(),
    });
    expect(closureState(h)).toBe('confirmed');
  });

  it('"not fixed" reopens the report as escalated and counts it', () => {
    const h = applyReporterVerdict(named, 'not_fixed', NOW);
    expect(h).toMatchObject({
      status: 'escalated',
      acknowledgedAt: null,
      resolvedAt: null,
      reporterVerdict: 'not_fixed',
      reopenedAt: NOW.toISOString(),
      reopenCount: 1,
    });
    expect(applyReporterVerdict(markResolved(h, NOW), 'not_fixed', NOW).reopenCount).toBe(2);
  });

  it('a reopened report is escalated even inside its original SLA window', () => {
    const fresh = { ...named, reportedAt: '2026-10-27T09:59:00Z' };
    const h = applyReporterVerdict(fresh, 'not_fixed', NOW);
    expect(computeHazardStatus(h, NOW)).toBe('escalated');
    // Acknowledging it again takes it back off the escalation list.
    expect(computeHazardStatus({ ...h, acknowledgedAt: NOW.toISOString() }, NOW)).toBe(
      'acknowledged',
    );
  });

  it('does not change the original report object', () => {
    applyReporterVerdict(named, 'not_fixed', NOW);
    expect(named.status).toBe('resolved');
  });
});

describe('markResolved', () => {
  it('resolves and asks the reporter again', () => {
    const h = markResolved({ ...named, status: 'escalated', reporterVerdict: 'not_fixed' }, NOW);
    expect(h).toMatchObject({
      status: 'resolved',
      resolvedAt: NOW.toISOString(),
      reporterVerdict: null,
      verdictAt: null,
    });
    expect(closureState(h)).toBe('awaiting_reporter');
  });
});
