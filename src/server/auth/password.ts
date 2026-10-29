/**
 * scrypt hashing for worker PINs and admin passwords, with a per-secret random salt and a
 * constant-time comparison.
 */

import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

/**
 * Hashes a plaintext password or 4-digit PIN using scrypt.
 * Output format: `<salt_hex>:<hash_hex>`
 */
export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(secret, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verifies a plaintext password or 4-digit PIN against a stored scrypt hash.
 */
export async function verifySecret(secret: string, storedHash: string): Promise<boolean> {
  if (!secret || !storedHash) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;

  const [salt, hashHex] = parts;
  const keyBuffer = Buffer.from(hashHex, 'hex');
  const derivedKey = (await scryptAsync(secret, salt, keyBuffer.length)) as Buffer;

  if (keyBuffer.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(keyBuffer, derivedKey);
}
