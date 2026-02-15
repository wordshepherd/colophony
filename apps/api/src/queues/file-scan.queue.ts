import { Queue } from 'bullmq';
import type { Env } from '../config/env.js';

export interface FileScanJobData {
  fileId: string;
  storageKey: string;
  organizationId: string;
}

let queue: Queue<FileScanJobData> | null = null;

function getQueue(env: Env): Queue<FileScanJobData> {
  if (!queue) {
    queue = new Queue<FileScanJobData>('file-scan', {
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

export async function enqueueFileScan(
  env: Env,
  data: FileScanJobData,
): Promise<void> {
  await getQueue(env).add('scan', data, { jobId: data.fileId });
}

export async function closeFileScanQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
