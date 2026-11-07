import { createHmac } from 'node:crypto';

import env from '@/lib/config/env';
import { InternalError } from '@/lib/errors';

import type { StorageService, UploadResult } from './types';

/**
 * S3-compatible storage using the AWS SigV4 REST API with Node's built-in crypto.
 * Works with any S3-compatible endpoint (MinIO, AWS S3, Cloudflare R2, etc.).
 */
export class S3StorageService implements StorageService {
  private readonly endpoint: string;
  private readonly region: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly publicEndpoint?: string;

  constructor() {
    if (!env.STORAGE_ENDPOINT || !env.STORAGE_ACCESS_KEY || !env.STORAGE_SECRET_KEY) {
      throw new InternalError(
        'S3 storage requires STORAGE_ENDPOINT, STORAGE_ACCESS_KEY, and STORAGE_SECRET_KEY',
      );
    }
    this.endpoint = env.STORAGE_ENDPOINT.replace(/\/$/, '');
    this.region = env.STORAGE_REGION;
    this.accessKey = env.STORAGE_ACCESS_KEY;
    this.secretKey = env.STORAGE_SECRET_KEY;
    this.publicEndpoint = env.STORAGE_PUBLIC_ENDPOINT;
  }

  private get host(): string {
    return new URL(this.endpoint).host;
  }

  private signKey(secret: string, date: string, region: string, service: string): Buffer {
    const kDate = createHmac('sha256', `AWS4${secret}`).update(date).digest();
    const kRegion = createHmac('sha256', kDate).update(region).digest();
    const kService = createHmac('sha256', kRegion).update(service).digest();
    return createHmac('sha256', kService).update('aws4_request').digest();
  }

  private buildAuthorization(
    method: string,
    path: string,
    query: Record<string, string>,
    headers: Record<string, string>,
    payloadHash: string,
    now: Date,
  ): string {
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const service = 's3';

    const canonicalQuerystring = Object.keys(query)
      .sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k] ?? '')}`)
      .join('&');

    const signedHeaders = Object.keys(headers)
      .map((h) => h.toLowerCase())
      .sort()
      .join(';');

    const canonicalHeaders = Object.keys(headers)
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .map((h) => `${h.toLowerCase()}:${headers[h]}\n`)
      .join('');

    const canonicalRequest = [
      method,
      path,
      canonicalQuerystring,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${this.region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      createHmac('sha256', canonicalRequest).digest('hex'),
    ].join('\n');

    const signingKey = this.signKey(this.secretKey, dateStamp, this.region, service);
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    return `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  }

  private async request(
    method: string,
    key: string,
    options: {
      body?: Buffer | string;
      contentType?: string;
      query?: Record<string, string>;
    } = {},
  ): Promise<Response> {
    const path = `/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');

    const payloadHash = options.body
      ? createHmac('sha256', '').update(Buffer.from(options.body)).digest('hex')
      : 'UNSIGNED-PAYLOAD';

    const headers: Record<string, string> = {
      host: this.host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
    };
    if (options.contentType) headers['content-type'] = options.contentType;

    const authorization = this.buildAuthorization(
      method,
      path,
      options.query ?? {},
      headers,
      payloadHash,
      now,
    );
    headers.authorization = authorization;

    const url = `${this.endpoint}${path}${
      options.query ? '?' + new URLSearchParams(options.query).toString() : ''
    }`;

    const res = await fetch(url, {
      method,
      headers,
      body: options.body as BodyInit | undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new InternalError(`S3 ${method} ${key} failed: ${res.status} ${text}`);
    }
    return res;
  }

  async upload(
    key: string,
    body: Buffer | string | NodeJS.ReadableStream,
    contentType = 'application/octet-stream',
  ): Promise<UploadResult> {
    let buffer: Buffer;
    if (body instanceof Buffer) {
      buffer = body;
    } else if (typeof body === 'string') {
      buffer = Buffer.from(body);
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of body) {
        if (Buffer.isBuffer(chunk)) {
          chunks.push(chunk);
        } else if (typeof chunk === 'string') {
          chunks.push(Buffer.from(chunk));
        } else if (typeof chunk === 'number') {
          chunks.push(Buffer.from([chunk]));
        } else {
          chunks.push(Buffer.from(chunk as ArrayLike<number>));
        }
      }
      buffer = Buffer.concat(chunks);
    }

    await this.request('PUT', key, { body: buffer, contentType });
    return {
      key,
      url: this.getPublicUrl(key),
      size: buffer.length,
      contentType,
    };
  }

  async download(key: string): Promise<Buffer> {
    const res = await this.request('GET', key);
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async delete(key: string): Promise<void> {
    await this.request('DELETE', key);
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const path = `/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    const query: Record<string, string> = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.accessKey}/${dateStamp}/${this.region}/s3/aws4_request`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expiresInSeconds),
      'X-Amz-SignedHeaders': 'host',
    };

    const canonicalHeaders = `host:${this.host}\n`;
    const canonicalRequest = [
      'GET',
      path,
      Object.keys(query)
        .sort()
        .map((k) => `${k}=${query[k]}`)
        .join('&'),
      canonicalHeaders,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');

    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      createHmac('sha256', canonicalRequest).digest('hex'),
    ].join('\n');

    const signingKey = this.signKey(this.secretKey, dateStamp, this.region, 's3');
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    query['X-Amz-Signature'] = signature;

    const qs = Object.keys(query)
      .map((k) => `${k}=${query[k]}`)
      .join('&');
    return `${this.endpoint}${path}?${qs}`;
  }

  getPublicUrl(key: string): string {
    const base = this.publicEndpoint ?? this.endpoint;
    return `${base.replace(/\/$/, '')}/${key}`;
  }
}
