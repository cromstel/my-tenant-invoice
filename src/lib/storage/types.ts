/**
 * Storage service interface for S3-compatible object storage.
 * The default implementation uses the local filesystem; configure STORAGE_ENDPOINT
 * to use an S3-compatible service (MinIO, AWS S3, Cloudflare R2, etc.).
 */

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
}

export interface StorageService {
  upload(
    key: string,
    body: Buffer | string | NodeJS.ReadableStream,
    contentType?: string,
  ): Promise<UploadResult>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  getPublicUrl(key: string): string;
}
