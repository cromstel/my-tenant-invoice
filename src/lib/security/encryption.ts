import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import env from '@/lib/config/env';
import { InternalError } from '@/lib/errors';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  if (!env.ENCRYPTION_KEY) {
    throw new InternalError('ENCRYPTION_KEY is not configured');
  }
  // Derive a 32-byte key from the provided secret
  return createHash('sha256').update(env.ENCRYPTION_KEY).digest();
}

/**
 * Encrypts a string using AES-256-GCM.
 * Output format: base64(iv) + '.' + base64(tag) + '.' + base64(ciphertext)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

/**
 * Decrypts a string previously encrypted with `encrypt`.
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const [ivB64, tagB64, dataB64] = ciphertext.split('.');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new InternalError('Invalid encrypted data format');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Encrypts a value only if the encryption key is configured; otherwise returns the original.
 * Use this for optional encryption of non-critical fields.
 */
export function encryptIfConfigured(plaintext: string): string {
  if (!env.ENCRYPTION_KEY) return plaintext;
  return encrypt(plaintext);
}

export function decryptIfConfigured(ciphertext: string): string {
  if (!env.ENCRYPTION_KEY) return ciphertext;
  try {
    return decrypt(ciphertext);
  } catch {
    return ciphertext;
  }
}
