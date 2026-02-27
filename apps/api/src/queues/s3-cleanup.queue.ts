import { Queue } from 'bullmq';
import type { Env } from '../config/env.js';

export interface S3CleanupJobData {
  storageKeys: Array<{ storageKey: string; bucket: 'clean' | 'quarantine' }>;
  reason: 'user_gdpr_deletion';
  sourceId: string;
}

let queue: Queue<S3CleanupJobData> | null = null;

function getQueue(env: Env): Queue<S3CleanupJobData> {
  if (!queue) {
    queue = new Queue<S3CleanupJobData>('s3-cleanup', {
      connection: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
      },
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: { age: 86_400 }, // 24 hours
        removeOnFail: { age: 2_592_000 }, // 30 days
      },
    });
  }
  return queue;
}

export async function enqueueS3Cleanup(
  env: Env,
  data: S3CleanupJobData,
): Promise<void> {
  await getQueue(env).add('cleanup', data);
}

export function getS3CleanupQueueInstance(): Queue<S3CleanupJobData> | null {
  return queue;
}

export async function closeS3CleanupQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
