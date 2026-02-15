import { Worker } from 'bullmq';
import NodeClam from 'clamscan';
import { withRls } from '@colophony/db';
import type { DrizzleDb } from '@colophony/db';
import { AuditActions, AuditResources } from '@colophony/types';
import type { Env } from '../config/env.js';
import type { FileScanJobData } from '../queues/file-scan.queue.js';
import { fileService } from '../services/file.service.js';
import { auditService } from '../services/audit.service.js';
import {
  createS3Client,
  getObjectStream,
  copyObject,
  deleteS3Object,
} from '../services/s3.js';

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

export function startFileScanWorker(env: Env): Worker<FileScanJobData> {
  const s3Client = createS3Client(env);

  worker = new Worker<FileScanJobData>(
    'file-scan',
    async (job) => {
      const { fileId, storageKey, organizationId } = job.data;

      // Phase 1: Mark as SCANNING
      await withRls({ orgId: organizationId }, async (tx: DrizzleDb) => {
        await fileService.updateScanStatus(tx, fileId, 'SCANNING');
      });

      // Phase 2: Stream from S3 and scan (no DB operations)
      let isInfected: boolean;
      let viruses: string[];
      try {
        const stream = await getObjectStream(
          s3Client,
          env.S3_QUARANTINE_BUCKET,
          storageKey,
        );
        const clam = await getClamClient(env);
        const result = await clam.scanStream(stream);
        isInfected = result.isInfected;
        viruses = result.viruses;
      } catch (err) {
        // Phase 2 error: mark FAILED, audit, re-throw for retry
        await withRls({ orgId: organizationId }, async (tx: DrizzleDb) => {
          await fileService.updateScanStatus(tx, fileId, 'FAILED');
          await auditService.log(tx, {
            resource: AuditResources.FILE,
            action: AuditActions.FILE_SCAN_FAILED,
            resourceId: fileId,
            organizationId,
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
          // CLEAN: copy to submissions bucket, delete from quarantine
          await copyObject(
            s3Client,
            env.S3_QUARANTINE_BUCKET,
            storageKey,
            env.S3_BUCKET,
            storageKey,
          );
          await deleteS3Object(s3Client, env.S3_QUARANTINE_BUCKET, storageKey);

          await withRls({ orgId: organizationId }, async (tx: DrizzleDb) => {
            await fileService.updateScanStatus(tx, fileId, 'CLEAN');
            await auditService.log(tx, {
              resource: AuditResources.FILE,
              action: AuditActions.FILE_SCAN_CLEAN,
              resourceId: fileId,
              organizationId,
            });
          });
        } else {
          // INFECTED: delete from quarantine
          await deleteS3Object(s3Client, env.S3_QUARANTINE_BUCKET, storageKey);

          await withRls({ orgId: organizationId }, async (tx: DrizzleDb) => {
            await fileService.updateScanStatus(tx, fileId, 'INFECTED');
            await auditService.log(tx, {
              resource: AuditResources.FILE,
              action: AuditActions.FILE_SCAN_INFECTED,
              resourceId: fileId,
              organizationId,
              newValue: { viruses },
            });
          });
        }
      } catch (err) {
        // S3 move/delete failed — mark FAILED so file doesn't stay SCANNING
        await withRls({ orgId: organizationId }, async (tx: DrizzleDb) => {
          await fileService.updateScanStatus(tx, fileId, 'FAILED');
          await auditService.log(tx, {
            resource: AuditResources.FILE,
            action: AuditActions.FILE_SCAN_FAILED,
            resourceId: fileId,
            organizationId,
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
    {
      connection: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
      },
      concurrency: 5,
    },
  );

  worker.on('failed', (job, err) => {
    console.error(
      `[file-scan] Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts.attempts}):`,
      err.message,
    );
  });

  return worker;
}

export async function stopFileScanWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
