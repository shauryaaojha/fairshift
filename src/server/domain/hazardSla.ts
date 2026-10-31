/**
 * Hazard response deadlines by severity (1 h / 4 h / 24 h / 72 h). Escalation is computed on read,
 * so a missed deadline escalates without a scheduler. Pure.
 */

import type {
  HazardReport,
  HazardSeverity,
  HazardStatus,
  HazardSlaConfig,
} from '../../shared/types';
import { DEFAULT_HAZARD_SLA } from '../../shared/types';

/**
 * Returns acknowledgement deadline in hours for a given severity.
 */
export function getSlaHours(
  severity: HazardSeverity,
  config: HazardSlaConfig = DEFAULT_HAZARD_SLA,
): number {
  return config[severity] ?? DEFAULT_HAZARD_SLA.medium;
}

/**
 * Computes live hazard status based on reported time and acknowledgement status.
 * If not acknowledged within SLA window, automatically marks status as 'escalated'.
 */
export function computeHazardStatus(
  hazard: Pick<
    HazardReport,
    'status' | 'severity' | 'reportedAt' | 'acknowledgedAt' | 'reopenedAt'
  >,
  nowInput?: Date | string,
  config: HazardSlaConfig = DEFAULT_HAZARD_SLA,
): HazardStatus {
  // If already resolved, status remains resolved
  if (hazard.status === 'resolved') {
    return 'resolved';
  }

  // If acknowledged, status is acknowledged
  if (hazard.acknowledgedAt !== null) {
    return 'acknowledged';
  }

  // The reporter said a "fix" did not work: that goes straight to the manager.
  if (hazard.reopenedAt) {
    return 'escalated';
  }

  // If not acknowledged, evaluate against SLA window
  const now = nowInput ? new Date(nowInput).getTime() : Date.now();
  const reportedTime = new Date(hazard.reportedAt).getTime();

  if (isNaN(reportedTime) || isNaN(now)) {
    return hazard.status;
  }

  const slaHours = getSlaHours(hazard.severity, config);
  const deadline = reportedTime + slaHours * 60 * 60 * 1000;

  if (now > deadline) {
    return 'escalated';
  }

  return 'reported';
}

/**
 * Calculates remaining seconds before acknowledgement SLA expires.
 * Returns negative number if expired.
 */
export function getRemainingSlaSeconds(
  hazard: Pick<HazardReport, 'severity' | 'reportedAt' | 'acknowledgedAt'>,
  nowInput?: Date | string,
  config: HazardSlaConfig = DEFAULT_HAZARD_SLA,
): number {
  if (hazard.acknowledgedAt) {
    return 0;
  }

  const now = nowInput ? new Date(nowInput).getTime() : Date.now();
  const reportedTime = new Date(hazard.reportedAt).getTime();
  const slaHours = getSlaHours(hazard.severity, config);
  const deadline = reportedTime + slaHours * 60 * 60 * 1000;

  return Math.floor((deadline - now) / 1000);
}

/**
 * Formats remaining SLA time into a concise human-readable string.
 */
export function formatSlaRemaining(remainingSeconds: number): string {
  if (remainingSeconds <= 0) {
    const overdueSeconds = Math.abs(remainingSeconds);
    const overdueMinutes = Math.floor(overdueSeconds / 60);
    const overdueHours = Math.floor(overdueMinutes / 60);
    if (overdueHours > 0) {
      return `Overdue by ${overdueHours}h ${overdueMinutes % 60}m`;
    }
    return `Overdue by ${overdueMinutes}m`;
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m remaining`;
  }
  return `${minutes}m remaining`;
}
