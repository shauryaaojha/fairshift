/**
 * Skill passport: verification tokens and certificate status (active, expired, unverified). Pure.
 */

import { createHmac } from 'crypto';
import type { SkillRecord } from '../../shared/types';

/**
 * Generates a deterministic public verification token for a skill record.
 */
export function generateSkillVerifyToken(
  workerId: string,
  title: string,
  issuedDate: string,
  secret: string,
): string {
  // Keyed with a server secret, so a token cannot be recomputed from public facts.
  const mac = createHmac('sha256', secret);
  mac.update(`${workerId}:${title}:${issuedDate}`);
  return mac.digest('hex').slice(0, 16);
}

/**
 * Checks if a skill record has expired.
 */
export function isSkillExpired(expiryDateIso: string | null, nowInput?: Date | string): boolean {
  if (!expiryDateIso) return false;
  const now = nowInput ? new Date(nowInput).getTime() : Date.now();
  const expiry = new Date(expiryDateIso).getTime();
  if (isNaN(expiry)) return false;
  return now > expiry;
}

/**
 * Formats skill credential status for display.
 */
export function getSkillStatus(
  skill: SkillRecord,
  nowInput?: Date | string,
): 'active' | 'expired' | 'unverified' {
  if (!skill.verified) return 'unverified';
  if (isSkillExpired(skill.expiryDate, nowInput)) return 'expired';
  return 'active';
}
