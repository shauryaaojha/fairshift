/**
 * Versioned pay rules. An admin can change the overtime threshold and rate, but only within the
 * law, only from a coming Monday, and only with a written reason. Past weeks keep the rules they
 * were worked under, so a change can never cut pay that is already earned. Pure.
 */

import { DAY_MS, istDateKey } from './time';
import {
  DEFAULT_DAILY_HOURS_LIMIT,
  DEFAULT_OT_MULTIPLIER,
  DEFAULT_WEEKLY_HOURS_LIMIT,
} from './overtime';
import type { Org, OrgPolicy, PayRuleVersion, PayRules } from '../../shared/types';

/**
 * What the law allows. Overtime starts after at most 8 hours a day (OSH Code 2020, s. 25) and 48
 * a week, and is paid at no less than twice the normal rate (Code on Wages 2019, s. 14). An
 * employer may be more generous: start overtime earlier or pay more for it.
 */
export const PAY_RULE_LIMITS: Record<keyof PayRules, { min: number; max: number; law: string }> = {
  dailyHoursLimit: { min: 4, max: 8, law: 'OSH Code 2020, s. 25' },
  weeklyHoursLimit: { min: 24, max: 48, law: 'OSH Code 2020, s. 25' },
  otMultiplier: { min: 2, max: 3, law: 'Code on Wages 2019, s. 14' },
};

export const PAY_RULE_LABELS: Record<keyof PayRules, string> = {
  dailyHoursLimit: 'Overtime after (hours a day)',
  weeklyHoursLimit: 'Overtime after (hours a week)',
  otMultiplier: 'Overtime rate (times normal pay)',
};

export const REASON_MIN = 10;
export const REASON_MAX = 500;

/** How many Mondays ahead a change can be scheduled. */
export const SCHEDULE_WEEKS = 4;

/** The rules in force on an IST day: the latest version starting on or before it. */
export function rulesOn(org: Pick<Org, 'policy' | 'payRuleHistory'>, dateKey: string): PayRules {
  const version = (org.payRuleHistory ?? [])
    .filter((v) => v.effectiveFrom <= dateKey)
    .reduce<PayRuleVersion | null>(
      (latest, v) => (!latest || v.effectiveFrom >= latest.effectiveFrom ? v : latest),
      null,
    );
  if (version) return version.rules;
  return {
    dailyHoursLimit: org.policy?.dailyHoursLimit ?? DEFAULT_DAILY_HOURS_LIMIT,
    weeklyHoursLimit: org.policy?.weeklyHoursLimit ?? DEFAULT_WEEKLY_HOURS_LIMIT,
    otMultiplier: org.policy?.otMultiplier ?? DEFAULT_OT_MULTIPLIER,
  };
}

/**
 * The full policy for each IST day: the statutory PF and ESI settings, with the pay rules that
 * applied that day. Pass it wherever a calculation takes a `PolicySource`.
 */
export function policyForDate(
  org: Pick<Org, 'policy' | 'payRuleHistory'> | null | undefined,
): (dateKey: string) => OrgPolicy | undefined {
  if (!org) return () => undefined;
  return (dateKey) => ({ ...org.policy, ...rulesOn(org, dateKey) });
}

/** The next `count` Mondays after today (IST), as `YYYY-MM-DD`. Today never counts. */
export function upcomingMondays(now: Date, count: number = SCHEDULE_WEEKS): string[] {
  const today = Date.parse(`${istDateKey(now)}T00:00:00Z`);
  const weekday = new Date(today).getUTCDay(); // 0 = Sunday
  const daysToMonday = (8 - weekday) % 7 || 7;
  return Array.from({ length: count }, (_, i) =>
    new Date(today + (daysToMonday + 7 * i) * DAY_MS).toISOString().slice(0, 10),
  );
}

export interface RuleChangeInput {
  rules: PayRules;
  effectiveFrom: string;
  reason: string;
}

export type RuleChangeCheck = { ok: true } | { ok: false; reason: string };

/** Why a proposed change is not allowed, or ok. */
export function checkRuleChange(
  org: Pick<Org, 'payRuleHistory'>,
  input: RuleChangeInput,
  now: Date,
): RuleChangeCheck {
  for (const key of Object.keys(PAY_RULE_LIMITS) as (keyof PayRules)[]) {
    const { min, max, law } = PAY_RULE_LIMITS[key];
    const value = input.rules[key];
    if (!Number.isFinite(value) || value < min || value > max) {
      return { ok: false, reason: `${PAY_RULE_LABELS[key]} must be ${min} to ${max} (${law}).` };
    }
  }
  if (!upcomingMondays(now).includes(input.effectiveFrom)) {
    return {
      ok: false,
      reason: 'Changes start on one of the next four Mondays, never on a week already worked.',
    };
  }
  if ((org.payRuleHistory ?? []).some((v) => v.effectiveFrom === input.effectiveFrom)) {
    return { ok: false, reason: 'A change already starts on that Monday.' };
  }
  const reason = input.reason.trim();
  if (reason.length < REASON_MIN || reason.length > REASON_MAX) {
    return { ok: false, reason: `Write a reason of ${REASON_MIN} to ${REASON_MAX} characters.` };
  }
  return { ok: true };
}

/** The history with the new version added, oldest first. Call `checkRuleChange` first. */
export function addRuleVersion(
  org: Pick<Org, 'policy' | 'payRuleHistory'>,
  version: PayRuleVersion,
): PayRuleVersion[] {
  return [...(org.payRuleHistory ?? []), version].sort((a, b) =>
    a.effectiveFrom.localeCompare(b.effectiveFrom),
  );
}
