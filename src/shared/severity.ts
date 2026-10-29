import type { HazardSeverity } from './types';

/** Most severe first, the order the safety queue and the forms use. */
export const HAZARD_SEVERITIES = [
  'critical',
  'high',
  'medium',
  'low',
] as const satisfies readonly HazardSeverity[];

export const SEVERITY_RANK: Record<HazardSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/** The more severe of two ratings. Suggestions use it so they can raise a report, never lower it. */
export function higherSeverity(a: HazardSeverity, b: HazardSeverity): HazardSeverity {
  return SEVERITY_RANK[b] > SEVERITY_RANK[a] ? b : a;
}
