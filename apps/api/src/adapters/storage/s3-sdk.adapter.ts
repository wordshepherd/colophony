import {
  S3Client,
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'node:stream';
import { z } from 'zod';
import type {
  StorageAdapter,
  UploadOptions,
  UploadResult,
  AdapterHealthResult,
} from '@colophony/plugin-sdk';

export class S3StorageAdapter implements StorageAdapter {
  readonly id = 'colophony-s3';
  readonly name = 'S3 Storage';
  readonly version = '1.0.0';
  readonly configSchema = z.object({
    endpoint: z.string(),
    region: z.string().default('us-east-1'),
    accessKey: z.string(),
    secretKey: z.string(),
    bucket: z.string(),
    quarantineBucket: z.string().optional(),
    forcePathStyle: z.boolean().default(true),
  });

  private client: S3Client | null = null;
  private _bucket = '';
  private _quarantineBucket = '';

  get defaultBucket(): string {
    return this._bucket;
  }

  get quarantineBucket(): string {
    return this._quarantineBucket;
  }

  async initialize(config: Record<string, unknown>): Promise<void> {
    const parsed = this.configSchema.parse(config);
    this._bucket = parsed.bucket;
    this._quarantineBucket = parsed.quarantineBucket ?? parsed.bucket;
    this.client = new S3Client({
      endpoint: parsed.endpoint,
      region: parsed.region,
      credentials: {
        accessKeyId: parsed.accessKey,
        secretAccessKey: parsed.secretKey,
      },
      forcePathStyle: parsed.forcePathStyle,
    });
  }

  private getClient(): S3Client {
    if (!this.client) {
      throw new Error('S3StorageAdapter not initialized');
    }
    return this.client;
  }

  // --- SDK StorageAdapter methods (default bucket) ---

  async upload(options: UploadOptions): Promise<UploadResult> {
    const client = this.getClient();
    const command = new PutObjectCommand({
      Bucket: this._bucket,
      Key: options.key,
      Body: options.body,
      ContentType: options.contentType,
      Metadata: options.metadata,
    });
    await client.send(command);

    const size = options.body instanceof Buffer ? options.body.length : 0;

    return { key: options.key, size };
  }

  async download(key: string): Promise<Readable> {
    return this.downloadFromBucket(this._bucket, key);
  }

  async delete(key: string): Promise<void> {
    return this.deleteFromBucket(this._bucket, key);
  }

  async exists(key: string): Promise<boolean> {
    const client = this.getClient();
    try {
      await client.send(
        new HeadObjectCommand({ Bucket: this._bucket, Key: key }),
      );
      return true;
    } catch (err) {
      if (
        err instanceof Error &&
        (('name' in err && err.name === 'NotFound') ||
          ('$metadata' in err &&
            (err as { $metadata: { httpStatusCode?: number } }).$metadata
              .httpStatusCode === 404))
      ) {
        return false;
      }
      throw err;
    }
  }

  async getSignedUrl(key: string, expiresInSeconds = 900): Promise<string> {
    return this.getSignedUrlFromBucket(this._bucket, key, expiresInSeconds);
  }

  async move(sourceKey: string, destinationKey: string): Promise<void> {
    const client = this.getClient();
    await client.send(
      new CopyObjectCommand({
        CopySource: `${this._bucket}/${sourceKey}`,
        Bucket: this._bucket,
        Key: destinationKey,
      }),
    );
    await this.delete(sourceKey);
  }

  // --- Extension methods for multi-bucket operations ---

  async downloadFromBucket(bucket: string, key: string): Promise<Readable> {
    const client = this.getClient();
    const response = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    if (!response.Body) {
      throw new Error(`S3 object ${bucket}/${key} has no body`);
    }
    return response.Body as Readable;
  }

  async deleteFromBucket(bucket: string, key: string): Promise<void> {
    const client = this.getClient();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  async uploadToBucket(
    bucket: string,
    key: string,
    body: Buffer | Uint8Array,
    contentType?: string,
  ): Promise<void> {
    const client = this.getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getSignedUrlFromBucket(
    bucket: string,
    key: string,
    expiresInSeconds = 900,
  ): Promise<string> {
    const client = this.getClient();
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  }

  async moveBetweenBuckets(
    srcBucket: string,
    srcKey: string,
    destBucket: string,
    destKey: string,
  ): Promise<void> {
    const client = this.getClient();
    await client.send(
      new CopyObjectCommand({
        CopySource: `${srcBucket}/${srcKey}`,
        Bucket: destBucket,
        Key: destKey,
      }),
    );
    await this.deleteFromBucket(srcBucket, srcKey);
  }

  async healthCheck(): Promise<AdapterHealthResult> {
    const client = this.getClient();
    const start = Date.now();
    try {
      await client.send(new HeadBucketCommand({ Bucket: this._bucket }));
      return {
        healthy: true,
        message: `Bucket "${this._bucket}" accessible`,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        healthy: false,
        message: err instanceof Error ? err.message : 'HeadBucket failed',
        latencyMs: Date.now() - start,
      };
    }
  }

  async destroy(): Promise<void> {
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
  }
}
