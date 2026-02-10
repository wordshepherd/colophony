import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadOptions {
  key: string;
  body: Buffer | ReadableStream;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface PresignedUrlOptions {
  key: string;
  expiresIn?: number; // seconds
  contentType?: string;
}

@Injectable()
export class StorageService implements OnModuleInit {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private s3Client!: any; // S3Client type issue with node_modules
  private bucket!: string;
  private quarantineBucket!: string;
  private endpoint!: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.endpoint = this.configService.get<string>(
      'S3_ENDPOINT',
      'http://localhost:9000',
    );
    this.bucket = this.configService.get<string>('S3_BUCKET', 'submissions');
    this.quarantineBucket = this.configService.get<string>(
      'S3_QUARANTINE_BUCKET',
      'quarantine',
    );

    const accessKey = this.configService.get<string>(
      'S3_ACCESS_KEY',
      'minioadmin',
    );
    const secretKey = this.configService.get<string>(
      'S3_SECRET_KEY',
      'minioadmin',
    );
    const region = this.configService.get<string>('S3_REGION', 'us-east-1');

    this.s3Client = new S3Client({
      endpoint: this.endpoint,
      region,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true, // Required for MinIO
    });
  }

  /**
   * Get the main storage bucket name
   */
  getBucket(): string {
    return this.bucket;
  }

  /**
   * Get the quarantine bucket name
   */
  getQuarantineBucket(): string {
    return this.quarantineBucket;
  }

  /**
   * Generate a storage key for a submission file.
   * Format: {orgId}/{submissionId}/{fileId}/{sanitizedFilename}
   */
  generateStorageKey(
    orgId: string,
    submissionId: string,
    fileId: string,
    filename: string,
  ): string {
    return `${orgId}/${submissionId}/${fileId}/${filename}`;
  }

  /**
   * Upload a file to storage
   */
  async upload(options: UploadOptions): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: options.key,
      Body: options.body,
      ContentType: options.contentType,
      Metadata: options.metadata,
    });

    await this.s3Client.send(command);
  }

  /**
   * Upload a file to the quarantine bucket
   */
  async uploadToQuarantine(options: UploadOptions): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.quarantineBucket,
      Key: options.key,
      Body: options.body,
      ContentType: options.contentType,
      Metadata: options.metadata,
    });

    await this.s3Client.send(command);
  }

  /**
   * Get a file from storage
   */
  async getFile(key: string): Promise<ReadableStream | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      return response.Body as ReadableStream;
    } catch (error: unknown) {
      if ((error as { name?: string }).name === 'NoSuchKey') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  /**
   * Delete a file from quarantine bucket
   */
  async deleteFromQuarantine(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.quarantineBucket,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  /**
   * Check if a file exists
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error: unknown) {
      if ((error as { name?: string }).name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Move a file from quarantine to main bucket after scan passes
   */
  async moveFromQuarantine(key: string): Promise<void> {
    // Copy from quarantine to main bucket
    const copyCommand = new CopyObjectCommand({
      Bucket: this.bucket,
      Key: key,
      CopySource: `${this.quarantineBucket}/${key}`,
    });

    await this.s3Client.send(copyCommand);

    // Delete from quarantine
    await this.deleteFromQuarantine(key);
  }

  /**
   * Generate a presigned URL for downloading a file
   */
  async getDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Generate a presigned URL for uploading a file directly to S3
   * This is an alternative to tusd for simpler uploads
   */
  async getUploadUrl(options: PresignedUrlOptions): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.quarantineBucket, // Always upload to quarantine first
      Key: options.key,
      ContentType: options.contentType,
    });

    return getSignedUrl(this.s3Client, command, {
      expiresIn: options.expiresIn || 3600,
    });
  }

  /**
   * Get the S3 endpoint URL for tusd configuration
   */
  getS3Endpoint(): string {
    return this.endpoint;
  }
}
