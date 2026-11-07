import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';

import env from '@/lib/config/env';
import { NotFoundError } from '@/lib/errors';

import type { StorageService, UploadResult } from './types';

/**
 * Local filesystem-backed storage. Used when no S3-compatible endpoint is configured.
 * Files are stored under ./uploads in the project root.
 */
export class LocalStorageService implements StorageService {
  private readonly rootDir: string;

  constructor(rootDir?: string) {
    this.rootDir = resolve(rootDir ?? process.cwd(), 'uploads');
    if (!existsSync(this.rootDir)) {
      mkdirSync(this.rootDir, { recursive: true });
    }
  }

  private fullPath(key: string): string {
    const sanitized = key.replace(/^\/+/, '').replace(/\.\./g, '');
    return join(this.rootDir, sanitized);
  }

  async upload(
    key: string,
    body: Buffer | string | NodeJS.ReadableStream,
    contentType = 'application/octet-stream',
  ): Promise<UploadResult> {
    const target = this.fullPath(key);
    const parent = target.slice(0, target.lastIndexOf('/'));
    if (!existsSync(parent)) {
      mkdirSync(parent, { recursive: true });
    }

    let buffer: Buffer;
    if (body instanceof Buffer) {
      buffer = body;
    } else if (typeof body === 'string') {
      buffer = Buffer.from(body);
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      buffer = Buffer.concat(chunks);
    }

    writeFileSync(target, buffer);
    return {
      key,
      url: `${env.APP_URL}/uploads/${key}`,
      size: buffer.length,
      contentType,
    };
  }

  async download(key: string): Promise<Buffer> {
    const target = this.fullPath(key);
    if (!existsSync(target)) {
      throw new NotFoundError(`File not found: ${key}`);
    }
    return readFileSync(target);
  }

  async delete(key: string): Promise<void> {
    const target = this.fullPath(key);
    if (existsSync(target)) {
      rmSync(target, { force: true });
    }
  }

  async getSignedUrl(key: string, _expiresInSeconds = 3600): Promise<string> {
    return this.getPublicUrl(key);
  }

  getPublicUrl(key: string): string {
    return `${env.APP_URL}/uploads/${key}`;
  }

  /**
   * Provides a readable stream for a stored file.
   */
  createReadStream(key: string): NodeJS.ReadableStream {
    const target = this.fullPath(key);
    if (!existsSync(target)) {
      throw new NotFoundError(`File not found: ${key}`);
    }
    return createReadStream(target);
  }

  /**
   * Helper to pipe a stored file into a writable stream.
   */
  async pipe(key: string, destination: NodeJS.WritableStream): Promise<void> {
    await pipeline(this.createReadStream(key), destination);
  }
}
