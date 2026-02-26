import { Worker } from 'bullmq';
import type { AdapterRegistry } from '@colophony/plugin-sdk';
import { AuditActions, AuditResources } from '@colophony/types';
import type { Env } from '../config/env.js';
import type { S3CleanupJobData } from '../queues/s3-cleanup.queue.js';
import type { S3StorageAdapter } from '../adapters/storage/index.js';
import { auditService } from '../services/audit.service.js';

let worker: Worker<S3CleanupJobData> | null = null;

export function startS3CleanupWorker(
  env: Env,
  registry: AdapterRegistry,
): Worker<S3CleanupJobData> {
  const storage = registry.resolve<S3StorageAdapter>('storage');

  worker = new Worker<S3CleanupJobData>(
    's3-cleanup',
    async (job) => {
      const { storageKeys, sourceId } = job.data;
      const errors: Array<{ storageKey: string; error: string }> = [];

      for (const { storageKey, bucket } of storageKeys) {
        const s3Bucket =
          bucket === 'clean' ? storage.defaultBucket : storage.quarantineBucket;
        try {
          await storage.deleteFromBucket(s3Bucket, storageKey);
        } catch (err) {
          errors.push({
            storageKey,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      if (errors.length > 0) {
        await auditService.logDirect({
          resource: AuditResources.FILE,
          action: AuditActions.S3_CLEANUP_FAILED,
          resourceId: sourceId,
          newValue: {
            totalKeys: storageKeys.length,
            failedKeys: errors.length,
            errors,
          },
        });
        throw new Error(
          `S3 cleanup failed for ${errors.length}/${storageKeys.length} keys`,
        );
      }

      await auditService.logDirect({
        resource: AuditResources.FILE,
        action: AuditActions.S3_CLEANUP_COMPLETED,
        resourceId: sourceId,
        newValue: {
          totalKeys: storageKeys.length,
          reason: job.data.reason,
        },
      });
    },
    {
      connection: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
      },
      concurrency: 2,
    },
  );

  worker.on('failed', (job, err) => {
    console.error(
      `[s3-cleanup] Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts.attempts}):`,
      err.message,
    );
  });

  return worker;
}

export async function stopS3CleanupWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
