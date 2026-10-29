/**
 * Anonymity rules for feedback: k-anonymous aggregation per team and ISO week, and PII scrubbing
 * (phones, emails, ID numbers and roster names, including Hindi and Tamil spellings). Pure.
 */

import type { FeedbackSubmission, AggregatedFeedback } from '../../shared/types';
import { DAY_MS } from './time';

export const DEFAULT_ANONYMITY_K = 3;

// Regular expressions for PII detection
const PHONE_REGEX =
  /(?:(?<![\p{L}\p{M}\p{N}])(?:\+?(?:91|[०-९]{2}|[௦-௯]{2})[\-\s]?)?[6-9६-९௬-௯][0-9०-९௦-௯]{9}(?![\p{L}\p{M}\p{N}]))|(?<![\p{L}\p{M}\p{N}])[0-9०-९௦-௯]{3}[-.\s]?[0-9०-९௦-௯]{3}[-.\s]?[0-9०-९௦-௯]{4}(?![\p{L}\p{M}\p{N}])/giu;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const AADHAAR_REGEX = /\b\d{4}\s\d{4}\s\d{4}\b|\b\d{12}\b/g;

/**
 * Scrubs Personally Identifiable Information (PII) from free-text comments.
 * Removes phone numbers, emails, Aadhaar/ID numbers, and known worker names.
 */
export function scrubPii(text: string, knownWorkerNames: string[] = []): string {
  if (!text) return '';

  let scrubbed = text
    .replace(EMAIL_REGEX, '[REDACTED_EMAIL]')
    .replace(PHONE_REGEX, '[REDACTED_PHONE]')
    .replace(AADHAAR_REGEX, '[REDACTED_ID]');

  // Collect full names (length >= 2) and tokens (length >= 3)
  const targets = new Set<string>();
  for (const rawName of knownWorkerNames) {
    if (!rawName || typeof rawName !== 'string') continue;
    const trimmed = rawName.trim();
    if (trimmed.length >= 2) {
      targets.add(trimmed);
    }
    const tokens = trimmed.split(/\s+/);
    for (const token of tokens) {
      if (token.length >= 3) {
        targets.add(token);
      }
    }
  }

  // Sort descending by length so longer phrases are replaced first
  const sortedTargets = Array.from(targets).sort((a, b) => b.length - a.length);

  for (const target of sortedTargets) {
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nameRegex = new RegExp(
      '(?<![\\p{L}\\p{M}\\p{N}])' + escaped + '(?![\\p{L}\\p{M}\\p{N}])',
      'giu',
    );
    scrubbed = scrubbed.replace(nameRegex, '[REDACTED_NAME]');
  }

  return scrubbed;
}

/**
 * Returns the ISO 8601 week string (e.g., '2026-W43') for a given date.
 */
export function calculateIsoWeek(dateInput: Date | string): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput.getTime());
  // Thursday in current week decides the year.
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  const weekNumber =
    1 +
    Math.round(((date.getTime() - week1.getTime()) / DAY_MS - 3 + ((week1.getDay() + 6) % 7)) / 7);
  const weekStr = weekNumber < 10 ? `0${weekNumber}` : `${weekNumber}`;
  return `${date.getFullYear()}-W${weekStr}`;
}

/**
 * Aggregates feedback submissions adhering to k-anonymity (k = 3).
 * If count < k, individual ratings and comments are suppressed to prevent retaliation.
 */
export function aggregateFeedback(
  submissions: FeedbackSubmission[],
  team: string,
  isoWeek: string,
  minK: number = DEFAULT_ANONYMITY_K,
  rosterNames: string[] = [],
): AggregatedFeedback {
  const count = submissions.length;

  if (count < minK) {
    return {
      team,
      isoWeek,
      count,
      averages: null,
      comments: null,
    };
  }

  // Calculate averages
  const sumRespect = submissions.reduce((sum, s) => sum + s.managerRespect, 0);
  const sumSafety = submissions.reduce((sum, s) => sum + s.safetyRating, 0);
  const sumPay = submissions.reduce((sum, s) => sum + s.payFairness, 0);
  const sumWorkload = submissions.reduce((sum, s) => sum + s.workloadRating, 0);

  const averages = {
    managerRespect: Math.round((sumRespect / count) * 10) / 10,
    safetyRating: Math.round((sumSafety / count) * 10) / 10,
    payFairness: Math.round((sumPay / count) * 10) / 10,
    workloadRating: Math.round((sumWorkload / count) * 10) / 10,
  };

  // Collect and scrub free-text comments
  const comments = submissions
    .map((s) => s.comment)
    .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
    .map((c) => scrubPii(c, rosterNames));

  return {
    team,
    isoWeek,
    count,
    averages,
    comments: comments.length > 0 ? comments : null,
  };
}
