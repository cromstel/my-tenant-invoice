import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const API_KEY_PREFIX = 'mt_';
const KEY_LENGTH = 32;

export interface GeneratedApiKey {
  plaintext: string;
  hash: string;
  prefix: string;
}

/**
 * Generates a new API key. Returns the plaintext (shown once) and its SHA-256 hash (stored).
 */
export function generateApiKey(): GeneratedApiKey {
  const raw = randomBytes(KEY_LENGTH).toString('base64url');
  const plaintext = `${API_KEY_PREFIX}${raw}`;
  const hash = hashApiKey(plaintext);
  const prefix = plaintext.slice(0, 8);
  return { plaintext, hash, prefix };
}

/**
 * Hashes an API key using SHA-256 (hex digest).
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Verifies a plaintext API key against a stored hash using constant-time comparison.
 */
export function verifyApiKey(plaintext: string, storedHash: string): boolean {
  const candidate = hashApiKey(plaintext);
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Masks an API key for display, showing only the first 8 chars.
 */
export function maskApiKey(prefix: string): string {
  return `${prefix}••••••••••••`;
}
