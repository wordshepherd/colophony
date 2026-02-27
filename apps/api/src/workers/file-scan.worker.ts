import NodeClam from 'clamscan';
import { withRls } from '@colophony/db';
import type { DrizzleDb } from '@colophony/db';
import type { AdapterRegistry } from '@colophony/plugin-sdk';
import { AuditActions, AuditResources } from '@colophony/types';
import type { Env } from '../config/env.js';
import type { FileScanJobData } from '../queues/file-scan.queue.js';
import { fileService } from '../services/file.service.js';
import { auditService } from '../services/audit.service.js';
import type { S3StorageAdapter } from '../adapters/storage/index.js';
import { createInstrumentedWorker } from '../config/instrumented-worker.js';
import type { Worker } from 'bullmq';

let worker: Worker<FileScanJobData> | null = null;
let clamInstance: NodeClam | null = null;

async function getClamClient(env: Env): Promise<NodeClam> {
  if (!clamInstance) {
    const clam = new NodeClam();
    clamInstance = await clam.init({
      clamdscan: {
        host: env.CLAMAV_HOST,
        port: env.CLAMAV_PORT,
        socket: false,
        localFallback: false,
      },
      preference: 'clamdscan',
    });
  }
  return clamInstance;
}

/**
 * Build RLS context for file operations.
 * Files use user-scoped RLS (owner_id = current_user_id()),
 * so we pass userId. orgId is optional.
 */
function buildRlsContext(data: FileScanJobData) {
  return {
    userId: data.userId,
    ...(data.organizationId ? { orgId: data.organizationId } : {}),
  };
}

export function startFileScanWorker(
  env: Env,
  registry: AdapterRegistry,
): Worker<FileScanJobData> {
  const storage = registry.resolve<S3StorageAdapter>('storage');

  worker = createInstrumentedWorker<FileScanJobData>({
    name: 'file-scan',
    processor: async (job) => {
      const { fileId, storageKey } = job.data;
      const rlsCtx = buildRlsContext(job.data);

      // Phase 1: Mark as SCANNING
      await withRls(rlsCtx, async (tx: DrizzleDb) => {
        await fileService.updateScanStatus(tx, fileId, 'SCANNING');
      });

      // Phase 2: Stream from S3 and scan (no DB operations)
      let isInfected: boolean;
      let viruses: string[];
      try {
        const stream = await storage.downloadFromBucket(
          storage.quarantineBucket,
          storageKey,
        );
        const clam = await getClamClient(env);
        const result = await clam.scanStream(stream);
        isInfected = result.isInfected;
        viruses = result.viruses;
      } catch (err) {
        // Phase 2 error: mark FAILED, audit, re-throw for retry
        await withRls(rlsCtx, async (tx: DrizzleDb) => {
          await fileService.updateScanStatus(tx, fileId, 'FAILED');
          await auditService.log(tx, {
            resource: AuditResources.FILE,
            action: AuditActions.FILE_SCAN_FAILED,
            resourceId: fileId,
            organizationId: job.data.organizationId,
            newValue: {
              error: err instanceof Error ? err.message : 'Unknown error',
            },
          });
        });
        throw err;
      }

      // Phase 3: Handle scan result with S3 ops + DB update
      try {
        if (!isInfected) {
          // CLEAN: move from quarantine to clean bucket
          await storage.moveBetweenBuckets(
            storage.quarantineBucket,
            storageKey,
            storage.defaultBucket,
            storageKey,
          );

          await withRls(rlsCtx, async (tx: DrizzleDb) => {
            await fileService.updateScanStatus(tx, fileId, 'CLEAN');
            await auditService.log(tx, {
              resource: AuditResources.FILE,
              action: AuditActions.FILE_SCAN_CLEAN,
              resourceId: fileId,
              organizationId: job.data.organizationId,
            });
          });
        } else {
          // INFECTED: delete from quarantine
          await storage.deleteFromBucket(storage.quarantineBucket, storageKey);

          await withRls(rlsCtx, async (tx: DrizzleDb) => {
            await fileService.updateScanStatus(tx, fileId, 'INFECTED');
            await auditService.log(tx, {
              resource: AuditResources.FILE,
              action: AuditActions.FILE_SCAN_INFECTED,
              resourceId: fileId,
              organizationId: job.data.organizationId,
              newValue: { viruses },
            });
          });
        }
      } catch (err) {
        // S3 move/delete failed — mark FAILED so file doesn't stay SCANNING
        await withRls(rlsCtx, async (tx: DrizzleDb) => {
          await fileService.updateScanStatus(tx, fileId, 'FAILED');
          await auditService.log(tx, {
            resource: AuditResources.FILE,
            action: AuditActions.FILE_SCAN_FAILED,
            resourceId: fileId,
            organizationId: job.data.organizationId,
            newValue: {
              error: err instanceof Error ? err.message : 'Unknown error',
              phase: 'post-scan-s3',
              scanResult: isInfected ? 'INFECTED' : 'CLEAN',
            },
          });
        });
        throw err;
      }
    },
    workerOpts: {
      connection: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
      },
      concurrency: 5,
    },
  });

  return worker;
}

export async function stopFileScanWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
