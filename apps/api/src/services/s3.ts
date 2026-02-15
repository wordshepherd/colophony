import {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env } from '../config/env.js';

export function createS3Client(env: Env): S3Client {
  return new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    },
    forcePathStyle: true, // Required for MinIO
  });
}

export async function getPresignedDownloadUrl(
  client: S3Client,
  bucket: string,
  key: string,
  expiresIn = 900, // 15 minutes
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn });
}

export async function deleteS3Object(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<void> {
  const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
  await client.send(command);
}
