/**
 * Rotating 6-digit gate codes (HMAC of the 60-second window, TOTP style), accepting one window
 * either side, and verification at an offline capture time. Pure.
 */

import { createHmac } from 'crypto';
import type { QrCodeResult } from '../../shared/types';

/** Rotation period in seconds for dynamic TOTP site QR codes (accepted within ±1 window). */
export const QR_ROTATION_INTERVAL_SECONDS = 60;

/**
 * Computes a deterministic 6-digit TOTP-like code for a given time step.
 */
export function computeStepCode(secret: string, timeStep: number): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(timeStep));

  const hmac = createHmac('sha256', secret);
  hmac.update(buffer);
  const digest = hmac.digest();

  // Dynamic truncation (RFC 4226)
  const offset = digest[digest.length - 1] & 0x0f;
  const binaryCode =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = binaryCode % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Generates the active QR code and validity window for a site.
 */
export function generateSiteQrCode(
  secret: string,
  timestampMs: number = Date.now(),
  intervalSeconds: number = QR_ROTATION_INTERVAL_SECONDS,
): QrCodeResult {
  const step = Math.floor(timestampMs / (intervalSeconds * 1000));
  const code = computeStepCode(secret, step);

  const validFrom = step * intervalSeconds;
  const validUntil = (step + 1) * intervalSeconds;

  return {
    code,
    validFrom,
    validUntil,
  };
}

/**
 * Verifies a submitted 6-digit check-in code against the site secret with a ±1 window.
 */
export function verifySiteQrCode(
  submittedCode: string,
  secret: string,
  timestampMs: number = Date.now(),
  intervalSeconds: number = QR_ROTATION_INTERVAL_SECONDS,
): boolean {
  if (!submittedCode || submittedCode.length !== 6) {
    return false;
  }

  const currentStep = Math.floor(timestampMs / (intervalSeconds * 1000));

  // Check windows: -1 (previous), 0 (current), +1 (next)
  for (let offset = -1; offset <= 1; offset++) {
    const validCode = computeStepCode(secret, currentStep + offset);
    if (submittedCode === validCode) {
      return true;
    }
  }

  return false;
}

/**
 * Verifies a submitted 6-digit check-in code against the site secret at a given timestamp (with a ±1 window).
 */
export function verifySiteQrCodeAt(
  submittedCode: string,
  secret: string,
  timestampMs: number,
  intervalSeconds: number = QR_ROTATION_INTERVAL_SECONDS,
): boolean {
  return verifySiteQrCode(submittedCode, secret, timestampMs, intervalSeconds);
}
