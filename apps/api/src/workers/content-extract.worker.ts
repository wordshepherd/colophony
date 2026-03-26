import type { Worker } from 'bullmq';
import { withRls } from '@colophony/db';
import type { DrizzleDb } from '@colophony/db';
import type { AdapterRegistry } from '@colophony/plugin-sdk';
import { AuditActions, AuditResources } from '@colophony/types';
import type { Env } from '../config/env.js';
import type { ContentExtractJobData } from '../queues/content-extract.queue.js';
import { contentExtractionService } from '../services/content-extraction.service.js';
import { auditService } from '../services/audit.service.js';
import type { S3StorageAdapter } from '../adapters/storage/index.js';
import { createInstrumentedWorker } from '../config/instrumented-worker.js';
import { convertFile } from '../converters/index.js';

let worker: Worker<ContentExtractJobData> | null = null;

function buildRlsContext(data: ContentExtractJobData) {
  return {
    userId: data.userId,
    ...(data.organizationId ? { orgId: data.organizationId } : {}),
  };
}

export function startContentExtractWorker(
  env: Env,
  registry: AdapterRegistry,
): Worker<ContentExtractJobData> {
  const storage = registry.resolve<S3StorageAdapter>('storage');

  worker = createInstrumentedWorker<ContentExtractJobData>({
    name: 'content-extract',
    processor: async (job) => {
      const {
        fileId,
        storageKey,
        manuscriptVersionId,
        mimeType,
        filename,
        userId,
      } = job.data;
      const rlsCtx = buildRlsContext(job.data);

      // Phase 1: Idempotency check + mark EXTRACTING + get genre hint
      let genreHint: import('@colophony/types').GenreHint | null = null;
      const shouldSkip = await withRls(rlsCtx, async (tx: DrizzleDb) => {
        const status = await contentExtractionService.getStatus(
          tx,
          manuscriptVersionId,
          userId,
        );
        // Skip if another file already completed or is being extracted
        if (status === 'COMPLETE' || status === 'EXTRACTING') return true;
        await contentExtractionService.updateStatus(
          tx,
          manuscriptVersionId,
          userId,
          'EXTRACTING',
        );
        genreHint = await contentExtractionService.getGenreHintForVersion(
          tx,
          manuscriptVersionId,
          userId,
        );
        return false;
      });

      if (shouldSkip) return;

      // Phase 2: Download from S3 (outside withRls)
      let buffer: Buffer;
      try {
        const stream = await storage.downloadFromBucket(
          storage.defaultBucket,
          storageKey,
        );
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        buffer = Buffer.concat(chunks);
      } catch (err) {
        await withRls(rlsCtx, async (tx: DrizzleDb) => {
          await contentExtractionService.updateStatus(
            tx,
            manuscriptVersionId,
            userId,
            'FAILED',
          );
          await auditService.log(tx, {
            resource: AuditResources.MANUSCRIPT,
            action: AuditActions.CONTENT_EXTRACT_FAILED,
            resourceId: manuscriptVersionId,
            actorId: job.data.userId,
            newValue: {
              fileId,
              error: err instanceof Error ? err.message : 'Unknown error',
              phase: 'download',
            },
          });
        });
        throw err;
      }

      // Phase 3: Convert
      try {
        const result = await convertFile(
          buffer,
          mimeType,
          filename,
          genreHint ?? undefined,
        );

        // Phase 4: Store result
        if (result.status === 'unsupported') {
          await withRls(rlsCtx, async (tx: DrizzleDb) => {
            await contentExtractionService.updateStatus(
              tx,
              manuscriptVersionId,
              userId,
              'UNSUPPORTED',
            );
            await auditService.log(tx, {
              resource: AuditResources.MANUSCRIPT,
              action: AuditActions.CONTENT_EXTRACT_UNSUPPORTED,
              resourceId: manuscriptVersionId,
              actorId: job.data.userId,
              newValue: { fileId, mimeType: result.mimeType },
            });
          });
          return;
        }

        await withRls(rlsCtx, async (tx: DrizzleDb) => {
          await contentExtractionService.storeContent(
            tx,
            manuscriptVersionId,
            userId,
            result.doc,
          );
          await auditService.log(tx, {
            resource: AuditResources.MANUSCRIPT,
            action: AuditActions.CONTENT_EXTRACT_COMPLETE,
            resourceId: manuscriptVersionId,
            actorId: job.data.userId,
            newValue: {
              fileId,
              filename,
              mimeType,
              contentFormat: 'prosemirror_v1',
              nodeCount: result.doc.content.length,
            },
          });
        });
      } catch (err) {
        await withRls(rlsCtx, async (tx: DrizzleDb) => {
          await contentExtractionService.updateStatus(
            tx,
            manuscriptVersionId,
            userId,
            'FAILED',
          );
          await auditService.log(tx, {
            resource: AuditResources.MANUSCRIPT,
            action: AuditActions.CONTENT_EXTRACT_FAILED,
            resourceId: manuscriptVersionId,
            actorId: job.data.userId,
            newValue: {
              fileId,
              error: err instanceof Error ? err.message : 'Unknown error',
              phase: 'conversion',
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
      concurrency: 3,
    },
  });

  return worker;
}

export async function stopContentExtractWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
