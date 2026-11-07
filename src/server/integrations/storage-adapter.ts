import env from '@/lib/config/env';
import logger from '@/lib/logging/logger';
import { LocalStorageService } from '@/lib/storage/local-storage';
import { S3StorageService } from '@/lib/storage/s3-storage';
import type { StorageService } from '@/lib/storage/types';

export class StorageAdapter {
  private service: StorageService;

  constructor() {
    if (env.STORAGE_ENDPOINT && env.STORAGE_ACCESS_KEY && env.STORAGE_SECRET_KEY) {
      this.service = new S3StorageService();
      logger.info('Using S3 storage adapter');
    } else {
      this.service = new LocalStorageService();
      logger.info('Using local storage adapter');
    }
  }

  async upload(key: string, body: Buffer | string, contentType?: string) {
    return this.service.upload(key, body, contentType);
  }

  async download(key: string) {
    return this.service.download(key);
  }

  async delete(key: string) {
    return this.service.delete(key);
  }

  async getSignedUrl(key: string, expiresInSeconds?: number) {
    return this.service.getSignedUrl(key, expiresInSeconds);
  }

  getPublicUrl(key: string) {
    return this.service.getPublicUrl(key);
  }
}

export const storageAdapter = new StorageAdapter();
