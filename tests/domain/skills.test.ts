import { describe, it, expect } from 'vitest';
import {
  generateSkillVerifyToken,
  isSkillExpired,
  getSkillStatus,
} from '../../src/server/domain/skills';
import type { SkillRecord } from '../../src/shared/types';

describe('Domain: Skill Passport Engine', () => {
  it('generates consistent verification tokens', () => {
    const token1 = generateSkillVerifyToken(
      'worker-123',
      'Scaffolding Safety Level 2',
      '2025-05-10',
      'secret-a',
    );
    const token2 = generateSkillVerifyToken(
      'worker-123',
      'Scaffolding Safety Level 2',
      '2025-05-10',
      'secret-a',
    );
    expect(token1).toBe(token2);
    expect(token1.length).toBe(16);
    // A different server secret gives a different token, so tokens cannot be forged offline.
    expect(
      generateSkillVerifyToken(
        'worker-123',
        'Scaffolding Safety Level 2',
        '2025-05-10',
        'secret-b',
      ),
    ).not.toBe(token1);
  });

  it('determines skill expiration correctly', () => {
    expect(isSkillExpired(null)).toBe(false);
    expect(isSkillExpired('invalid-date')).toBe(false);
    expect(isSkillExpired('2025-01-01', '2026-10-27')).toBe(true);
    expect(isSkillExpired('2028-01-01', '2026-10-27')).toBe(false);
  });

  it('evaluates overall skill status', () => {
    const activeSkill: SkillRecord = {
      id: 'sk1',
      workerId: 'w1',
      orgId: 'o1',
      title: 'Electrical Compliance',
      issuer: 'National Skill Development Corp',
      issuedDate: '2025-01-01',
      expiryDate: '2027-01-01',
      verifyToken: 'token123',
      verified: true,
    };

    expect(getSkillStatus(activeSkill, '2026-10-27')).toBe('active');

    const expiredSkill: SkillRecord = {
      ...activeSkill,
      expiryDate: '2026-01-01',
    };
    expect(getSkillStatus(expiredSkill, '2026-10-27')).toBe('expired');

    const unverifiedSkill: SkillRecord = {
      ...activeSkill,
      verified: false,
    };
    expect(getSkillStatus(unverifiedSkill, '2026-10-27')).toBe('unverified');
  });
});
