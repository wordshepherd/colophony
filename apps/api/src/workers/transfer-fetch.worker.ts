import { UnrecoverableError } from 'bullmq';
import type { Worker } from 'bullmq';
import pLimit from 'p-limit';
import {
  withRls,
  submissions,
  trustedPeers,
  inboundTransfers,
  eq,
  and,
} from '@colophony/db';
import type { DrizzleDb } from '@colophony/db';
import type { AdapterRegistry } from '@colophony/plugin-sdk';
import { AuditActions, AuditResources } from '@colophony/types';
import type { Env } from '../config/env.js';
import type { TransferFetchJobData } from '../queues/transfer-fetch.queue.js';
import { auditService } from '../services/audit.service.js';
import { validateOutboundUrl } from '../lib/url-validation.js';
import type { S3StorageAdapter } from '../adapters/storage/index.js';
import { createInstrumentedWorker } from '../config/instrumented-worker.js';

let worker: Worker<TransferFetchJobData> | null = null;

export function startTransferFetchWorker(
  env: Env,
  registry: AdapterRegistry,
): Worker<TransferFetchJobData> {
  const storage = registry.resolve<S3StorageAdapter>('storage');

  worker = createInstrumentedWorker<TransferFetchJobData>({
    name: 'transfer-fetch',
    processor: async (job) => {
      const {
        transferId,
        orgId,
        originDomain,
        transferToken,
        tokenExpiresAt,
        fileManifest,
        localSubmissionId,
        inboundTransferId,
      } = job.data;

      // Pre-check: token expiration
      if (new Date(tokenExpiresAt) < new Date()) {
        await auditService.logDirect({
          resource: AuditResources.TRANSFER,
          action: AuditActions.TRANSFER_FILES_FETCH_FAILED,
          resourceId: localSubmissionId,
          organizationId: orgId,
          newValue: { transferId, reason: 'Transfer token expired' },
        });
        throw new UnrecoverableError('Transfer token expired');
      }

      // Phase 1: audit start + mark inbound transfer as fetching
      await auditService.logDirect({
        resource: AuditResources.TRANSFER,
        action: AuditActions.TRANSFER_FILES_FETCH_STARTED,
        resourceId: localSubmissionId,
        organizationId: orgId,
        newValue: { transferId, fileCount: fileManifest.length },
      });

      if (inboundTransferId) {
        await withRls({ orgId }, async (tx: DrizzleDb) => {
          await tx
            .update(inboundTransfers)
            .set({ status: 'FILES_FETCHING' })
            .where(eq(inboundTransfers.id, inboundTransferId));
        });
      }

      // Resolve peer instance URL via RLS
      const peer = await withRls({ orgId }, async (tx: DrizzleDb) => {
        const [row] = await tx
          .select({ instanceUrl: trustedPeers.instanceUrl })
          .from(trustedPeers)
          .where(
            and(
              eq(trustedPeers.domain, originDomain),
              eq(trustedPeers.status, 'active'),
            ),
          )
          .limit(1);
        return row;
      });

      if (!peer) {
        await auditService.logDirect({
          resource: AuditResources.TRANSFER,
          action: AuditActions.TRANSFER_FILES_FETCH_FAILED,
          resourceId: localSubmissionId,
          organizationId: orgId,
          newValue: {
            transferId,
            reason: `No active peer found for domain: ${originDomain}`,
          },
        });
        throw new UnrecoverableError(
          `No active peer found for domain: ${originDomain}`,
        );
      }

      // SSRF check on peer URL before fetching files
      const devMode =
        process.env.NODE_ENV === 'development' ||
        process.env.NODE_ENV === 'test';
      await validateOutboundUrl(peer.instanceUrl, { devMode });

      // Phase 2: fetch files (concurrent with limit of 5)
      const storedFiles: Array<{ fileId: string; storageKey: string }> = [];
      const failedFiles: string[] = [];
      const limit = pLimit(5);

      const results = await Promise.allSettled(
        fileManifest.map((entry) =>
          limit(async () => {
            const url = `${peer.instanceUrl}/federation/v1/transfers/${transferId}/files/${entry.fileId}`;
            const response = await fetch(url, {
              headers: { authorization: `Bearer ${transferToken}` },
              signal: AbortSignal.timeout(60_000),
            });

            if (!response.ok) {
              throw new Error(
                `HTTP ${response.status} for file ${entry.fileId}`,
              );
            }

            const storageKey = `transfers/${localSubmissionId}/${entry.fileId}/${entry.filename}`;
            const buffer = Buffer.from(await response.arrayBuffer());
            await storage.uploadToBucket(
              storage.defaultBucket,
              storageKey,
              buffer,
              entry.mimeType,
            );
            return { fileId: entry.fileId, storageKey };
          }),
        ),
      );

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === 'fulfilled') {
          storedFiles.push(result.value);
        } else {
          failedFiles.push(fileManifest[i].fileId);
        }
      }

      // Phase 3: update submission formData
      const totalSuccess = storedFiles.length === fileManifest.length;
      const hasAnySuccess = storedFiles.length > 0;

      if (hasAnySuccess) {
        await withRls({ orgId }, async (tx: DrizzleDb) => {
          // Read existing formData to preserve other fields (read-modify-write)
          const [existing] = await tx
            .select({ formData: submissions.formData })
            .from(submissions)
            .where(eq(submissions.id, localSubmissionId))
            .limit(1);

          const existingFormData =
            (existing?.formData as Record<string, unknown>) ?? {};

          const enrichedManifest = fileManifest.map((entry) => {
            const stored = storedFiles.find((s) => s.fileId === entry.fileId);
            return { ...entry, storageKey: stored?.storageKey };
          });

          await tx
            .update(submissions)
            .set({
              formData: {
                ...existingFormData,
                _transferFiles: enrichedManifest,
                _transferStatus: totalSuccess ? 'complete' : 'partial',
              } as Record<string, unknown>,
            })
            .where(eq(submissions.id, localSubmissionId));
        });
      }

      if (totalSuccess) {
        if (inboundTransferId) {
          await withRls({ orgId }, async (tx: DrizzleDb) => {
            await tx
              .update(inboundTransfers)
              .set({ status: 'FILES_COMPLETE', completedAt: new Date() })
              .where(eq(inboundTransfers.id, inboundTransferId));
          });
        }

        await auditService.logDirect({
          resource: AuditResources.TRANSFER,
          action: AuditActions.TRANSFER_FILES_FETCH_COMPLETED,
          resourceId: localSubmissionId,
          organizationId: orgId,
          newValue: {
            transferId,
            filesStored: storedFiles.length,
            status: 'complete',
          },
        });
        return;
      }

      if (!hasAnySuccess) {
        // Total failure — no DB update, audit + throw for retry
        // Mark as FAILED only on last attempt
        if (
          inboundTransferId &&
          job.attemptsMade >= (job.opts.attempts ?? 3) - 1
        ) {
          await withRls({ orgId }, async (tx: DrizzleDb) => {
            await tx
              .update(inboundTransfers)
              .set({
                status: 'FAILED',
                failureReason: 'All file fetches failed',
              })
              .where(eq(inboundTransfers.id, inboundTransferId));
          });
        }

        await auditService.logDirect({
          resource: AuditResources.TRANSFER,
          action: AuditActions.TRANSFER_FILES_FETCH_FAILED,
          resourceId: localSubmissionId,
          organizationId: orgId,
          newValue: {
            transferId,
            failedFiles,
            reason: 'All file fetches failed',
          },
        });
        throw new Error(
          `All ${failedFiles.length} file fetches failed for transfer ${transferId}`,
        );
      }

      // Partial failure — DB updated with partial results, audit + throw for retry
      await auditService.logDirect({
        resource: AuditResources.TRANSFER,
        action: AuditActions.TRANSFER_FILES_FETCH_COMPLETED,
        resourceId: localSubmissionId,
        organizationId: orgId,
        newValue: {
          transferId,
          filesStored: storedFiles.length,
          filesFailed: failedFiles.length,
          status: 'partial',
        },
      });
      throw new Error(
        `Partial failure: ${failedFiles.length}/${fileManifest.length} files failed for transfer ${transferId}`,
      );
    },
    workerOpts: {
      connection: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
      },
      concurrency: 3,
    },
  });

  return worker;
}

export async function stopTransferFetchWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
