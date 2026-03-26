import { Queue } from 'bullmq';
import type { Env } from '../config/env.js';

export interface ContentExtractJobData {
  fileId: string;
  storageKey: string;
  manuscriptVersionId: string;
  /** User who owns the manuscript — for user-scoped RLS. */
  userId: string;
  /** Organization context — optional (manuscripts are user-scoped). */
  organizationId?: string;
  /** MIME type of the file. */
  mimeType: string;
  /** Original filename. */
  filename: string;
}

let queue: Queue<ContentExtractJobData> | null = null;

function getQueue(env: Env): Queue<ContentExtractJobData> {
  if (!queue) {
    queue = new Queue<ContentExtractJobData>('content-extract', {
      connection: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: { age: 86_400 }, // 24 hours
        removeOnFail: { age: 604_800 }, // 7 days
      },
    });
  }
  return queue;
}

export async function enqueueContentExtract(
  env: Env,
  data: ContentExtractJobData,
): Promise<void> {
  await getQueue(env).add('extract', data, { jobId: data.fileId });
}

export function getContentExtractQueueInstance(): Queue<ContentExtractJobData> | null {
  return queue;
}

export async function closeContentExtractQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
