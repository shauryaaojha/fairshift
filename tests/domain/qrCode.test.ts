import { describe, it, expect } from 'vitest';
import {
  generateSiteQrCode,
  verifySiteQrCode,
  computeStepCode,
} from '../../src/server/domain/qrCode';

describe('Domain: Rotating QR Code Engine', () => {
  const secret = 'super-secret-site-seed-2026';

  it('generates a 6-digit numeric TOTP code', () => {
    const qr = generateSiteQrCode(secret);
    expect(qr.code).toMatch(/^\d{6}$/);
    expect(qr.validUntil).toBeGreaterThan(qr.validFrom);
  });

  it('generates identical code for the same time window', () => {
    const t0 = 1700000000000;
    const t1 = 1700000010000; // 10 seconds later, same 60s step
    const code0 = generateSiteQrCode(secret, t0).code;
    const code1 = generateSiteQrCode(secret, t1).code;
    expect(code0).toBe(code1);
  });

  it('validates code within current step', () => {
    const now = Date.now();
    const qr = generateSiteQrCode(secret, now);
    expect(verifySiteQrCode(qr.code, secret, now)).toBe(true);
  });

  it('accepts code from ±1 time window (clock drift tolerance)', () => {
    const stepDuration = 60 * 1000;
    const now = 1700000000000;

    // Code from previous window
    const prevCode = computeStepCode(secret, Math.floor(now / stepDuration) - 1);
    expect(verifySiteQrCode(prevCode, secret, now)).toBe(true);

    // Code from next window
    const nextCode = computeStepCode(secret, Math.floor(now / stepDuration) + 1);
    expect(verifySiteQrCode(nextCode, secret, now)).toBe(true);
  });

  it('rejects code outside ±1 time window', () => {
    const stepDuration = 60 * 1000;
    const now = 1700000000000;

    const oldCode = computeStepCode(secret, Math.floor(now / stepDuration) - 3);
    expect(verifySiteQrCode(oldCode, secret, now)).toBe(false);
  });

  it('rejects invalid or wrong-length codes', () => {
    expect(verifySiteQrCode('123', secret)).toBe(false);
    expect(verifySiteQrCode('000000', 'wrong-secret')).toBe(false);
  });
});
