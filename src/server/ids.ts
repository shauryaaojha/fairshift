import { randomUUID } from 'crypto';

/**
 * New record id: a readable prefix plus a v4 UUID, e.g. `hazard-0b8f3a52-…`.
 * Ids are unguessable (122 random bits from the OS CSPRNG) and fit the `recordId` schema.
 */
export function newRecordId(prefix: 'shift' | 'hazard' | 'fb' | 'rules' | 'payq'): string {
  return `${prefix}-${randomUUID()}`;
}
