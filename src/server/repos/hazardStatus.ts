/**
 * Hazard helpers shared by both stores: the live (computed-on-read) status and newest-first order.
 */

import type { HazardReport } from '../../shared/types';
import { computeHazardStatus } from '../domain/hazardSla';

/** Returns the hazard with its live (SLA-aware) status applied. */
export function withLiveHazardStatus(hazard: HazardReport): HazardReport {
  return { ...hazard, status: computeHazardStatus(hazard) };
}

/** Newest-reported first; shared sort order for hazard lists. */
export function sortHazardsNewestFirst(hazards: HazardReport[]): HazardReport[] {
  return hazards.sort(
    (a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime(),
  );
}
