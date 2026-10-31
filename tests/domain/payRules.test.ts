import { describe, expect, it } from 'vitest';
import {
  PAY_RULE_LIMITS,
  addRuleVersion,
  checkRuleChange,
  policyForDate,
  rulesOn,
  upcomingMondays,
} from '@/src/server/domain/payRules';
import { calculateShiftsOvertime, policyAt } from '@/src/server/domain/overtime';
import type { Org, PayRuleVersion, Shift } from '@/src/shared/types';

// Saturday 31 October 2026, 15:00 IST.
const NOW = new Date('2026-10-31T09:30:00.000Z');

function version(
  effectiveFrom: string,
  over: Partial<PayRuleVersion['rules']> = {},
): PayRuleVersion {
  return {
    id: `rules-${effectiveFrom}`,
    effectiveFrom,
    rules: { dailyHoursLimit: 8, weeklyHoursLimit: 48, otMultiplier: 2, ...over },
    reason: 'Test version of the rules',
    changedBy: 'Tester',
    changedAt: '2026-10-01T00:00:00.000Z',
  };
}

const org: Pick<Org, 'policy' | 'payRuleHistory'> = {
  policy: { pfRate: 0.12 },
  payRuleHistory: [version('2026-10-05'), version('2026-11-02', { otMultiplier: 2.5 })],
};

describe('rules in force', () => {
  it('uses the latest version that has started', () => {
    expect(rulesOn(org, '2026-10-04').otMultiplier).toBe(2); // before any version: defaults
    expect(rulesOn(org, '2026-10-31').otMultiplier).toBe(2);
    expect(rulesOn(org, '2026-11-02').otMultiplier).toBe(2.5);
  });

  it('falls back to the org policy, then the law, with no history', () => {
    expect(rulesOn({ policy: { otMultiplier: 3 } }, '2026-10-31')).toEqual({
      dailyHoursLimit: 8,
      weeklyHoursLimit: 48,
      otMultiplier: 3,
    });
    expect(rulesOn({}, '2026-10-31').otMultiplier).toBe(2);
  });

  it('keeps PF and ESI settings beside the dated rules', () => {
    const at = policyForDate(org)('2026-11-03');
    expect(at).toMatchObject({ pfRate: 0.12, otMultiplier: 2.5 });
    expect(policyForDate(null)('2026-11-03')).toBeUndefined();
    expect(policyAt(policyForDate(org), '2026-11-03')?.otMultiplier).toBe(2.5);
    expect(policyAt({ otMultiplier: 3 }, 'any')?.otMultiplier).toBe(3);
  });
});

describe('scheduling a change', () => {
  it('offers the next four Mondays, never today', () => {
    expect(upcomingMondays(NOW)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']);
    // On a Monday the first choice is next Monday.
    expect(upcomingMondays(new Date('2026-11-02T04:00:00.000Z'), 1)).toEqual(['2026-11-09']);
  });

  const good = {
    rules: { dailyHoursLimit: 8, weeklyHoursLimit: 45, otMultiplier: 2.5 },
    effectiveFrom: '2026-11-09',
    reason: 'Festival season bonus rate agreed with the union',
  };

  it('accepts a change within the law, from a free Monday, with a reason', () => {
    expect(checkRuleChange(org, good, NOW)).toEqual({ ok: true });
  });

  it('refuses rules below the legal floor, naming the law', () => {
    const lowRate = checkRuleChange(
      org,
      { ...good, rules: { ...good.rules, otMultiplier: 1.5 } },
      NOW,
    );
    expect(lowRate).toMatchObject({ ok: false });
    if (!lowRate.ok) expect(lowRate.reason).toContain(PAY_RULE_LIMITS.otMultiplier.law);

    const longDay = checkRuleChange(
      org,
      { ...good, rules: { ...good.rules, dailyHoursLimit: 10 } },
      NOW,
    );
    expect(longDay.ok).toBe(false);
    const nan = checkRuleChange(
      org,
      { ...good, rules: { ...good.rules, weeklyHoursLimit: NaN } },
      NOW,
    );
    expect(nan.ok).toBe(false);
  });

  it('refuses a past week, a non-Monday, a taken Monday and a missing reason', () => {
    expect(checkRuleChange(org, { ...good, effectiveFrom: '2026-10-26' }, NOW).ok).toBe(false);
    expect(checkRuleChange(org, { ...good, effectiveFrom: '2026-11-04' }, NOW).ok).toBe(false);
    expect(checkRuleChange(org, { ...good, effectiveFrom: '2026-11-02' }, NOW)).toEqual({
      ok: false,
      reason: 'A change already starts on that Monday.',
    });
    expect(checkRuleChange(org, { ...good, reason: '  short  ' }, NOW).ok).toBe(false);
  });

  it('keeps the history in date order', () => {
    const history = addRuleVersion(org, version('2026-10-19'));
    expect(history.map((v) => v.effectiveFrom)).toEqual(['2026-10-05', '2026-10-19', '2026-11-02']);
  });
});

describe('overtime under dated rules', () => {
  function day(date: string, hours: number): Shift {
    const start = Date.parse(`${date}T09:00:00+05:30`);
    return {
      id: `s-${date}`,
      workerId: 'w',
      siteId: 's',
      orgId: 'o',
      checkIn: new Date(start).toISOString(),
      checkOut: new Date(start + hours * 3600_000).toISOString(),
      method: 'qr',
    };
  }

  it('pays each week at the rate in force that week', () => {
    // 10 h on a Friday under 2x, 10 h on the next Tuesday under 2.5x: 2 h overtime each.
    const shifts = [day('2026-10-30', 10), day('2026-11-03', 10)];
    const result = calculateShiftsOvertime(shifts, 100, policyForDate(org));
    expect(result.overtimeHours).toBe(4);
    expect(result.overtimePay).toBe(2 * 100 * 2 + 2 * 100 * 2.5);
  });

  it('applies an earlier daily threshold from the week it starts', () => {
    const earlier = { payRuleHistory: [version('2026-11-02', { dailyHoursLimit: 7 })] };
    const before = calculateShiftsOvertime([day('2026-10-30', 8)], 100, policyForDate(earlier));
    const after = calculateShiftsOvertime([day('2026-11-03', 8)], 100, policyForDate(earlier));
    expect(before.overtimeHours).toBe(0);
    expect(after.overtimeHours).toBe(1);
  });
});
