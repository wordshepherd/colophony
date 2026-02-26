import { Queue } from 'bullmq';
import type { TransferFileManifestEntry } from '@colophony/types';
import type { Env } from '../config/env.js';

export interface TransferFetchJobData {
  transferId: string;
  orgId: string;
  originDomain: string;
  transferToken: string;
  tokenExpiresAt: string;
  fileManifest: TransferFileManifestEntry[];
  localSubmissionId: string;
}

let queue: Queue<TransferFetchJobData> | null = null;

function getQueue(env: Env): Queue<TransferFetchJobData> {
  if (!queue) {
    queue = new Queue<TransferFetchJobData>('transfer-fetch', {
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

export async function enqueueTransferFetch(
  env: Env,
  data: TransferFetchJobData,
): Promise<void> {
  await getQueue(env).add('fetch', data, { jobId: data.transferId });
}

export async function closeTransferFetchQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
