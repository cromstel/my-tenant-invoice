import env from '@/lib/config/env';

import { LocalStorageService } from './local-storage';
import { S3StorageService } from './s3-storage';
import type { StorageService } from './types';

export type { StorageService, UploadResult } from './types';

let instance: StorageService | null = null;

/**
 * Returns the configured storage service singleton.
 * Uses S3-compatible storage when STORAGE_ENDPOINT is set, otherwise local filesystem.
 */
export function getStorageService(): StorageService {
  if (instance) return instance;

  if (env.STORAGE_ENDPOINT && env.STORAGE_ACCESS_KEY && env.STORAGE_SECRET_KEY) {
    instance = new S3StorageService();
  } else {
    instance = new LocalStorageService();
  }
  return instance;
}

/**
 * Resets the singleton (used in tests).
 */
export function resetStorageService(): void {
  instance = null;
}

export { LocalStorageService, S3StorageService };
