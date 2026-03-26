import type { Worker } from 'bullmq';
import { withRls } from '@colophony/db';
import type { DrizzleDb } from '@colophony/db';
import type { AdapterRegistry } from '@colophony/plugin-sdk';
import { AuditActions, AuditResources } from '@colophony/types';
import type {
  ProseMirrorDoc,
  ProseMirrorNode,
  GenreHint,
} from '@colophony/types';
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

/**
 * Merge multiple ProseMirror documents into one, separated by section breaks.
 * The first document's genre_hint and smart_typography_applied are used for the merged doc.
 * submission_metadata lists all source files.
 */
function mergeDocuments(
  docs: Array<{ doc: ProseMirrorDoc; filename: string; mimeType: string }>,
): ProseMirrorDoc {
  if (docs.length === 0) {
    return { type: 'doc', content: [] };
  }
  if (docs.length === 1) {
    return docs[0].doc;
  }

  const merged: ProseMirrorNode[] = [];
  for (let i = 0; i < docs.length; i++) {
    if (i > 0) {
      merged.push({ type: 'section_break' });
    }
    merged.push(...docs[i].doc.content);
  }

  const first = docs[0].doc;
  return {
    type: 'doc',
    attrs: {
      ...first.attrs,
      submission_metadata: {
        original_filename: docs.map((d) => d.filename).join(', '),
        original_format: [...new Set(docs.map((d) => d.mimeType))].join(', '),
        converted_at: new Date().toISOString(),
        converter_version:
          first.attrs?.submission_metadata?.converter_version ?? '1.0.0',
      },
    },
    content: merged,
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
      const { manuscriptVersionId, userId } = job.data;
      const rlsCtx = buildRlsContext(job.data);

      // Phase 1: Mark EXTRACTING + get genre hint + get all clean supported files
      let genreHint: GenreHint | null = null;
      let filesToExtract: Array<{
        id: string;
        filename: string;
        mimeType: string;
        storageKey: string;
      }> = [];

      await withRls(rlsCtx, async (tx: DrizzleDb) => {
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
        filesToExtract = await contentExtractionService.getCleanSupportedFiles(
          tx,
          manuscriptVersionId,
          userId,
        );
      });

      if (filesToExtract.length === 0) {
        // No supported clean files — mark UNSUPPORTED
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
            actorId: userId,
            newValue: { reason: 'no supported clean files' },
          });
        });
        return;
      }

      // Phase 2: Download and convert each file (outside withRls)
      const extractedDocs: Array<{
        doc: ProseMirrorDoc;
        filename: string;
        mimeType: string;
      }> = [];

      try {
        for (const file of filesToExtract) {
          const stream = await storage.downloadFromBucket(
            storage.defaultBucket,
            file.storageKey,
          );
          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          const buffer = Buffer.concat(chunks);

          const result = await convertFile(
            buffer,
            file.mimeType,
            file.filename,
            genreHint ?? undefined,
          );

          if (result.status === 'success') {
            extractedDocs.push({
              doc: result.doc,
              filename: file.filename,
              mimeType: file.mimeType,
            });
          }
          // Skip unsupported files silently — they passed the MIME filter
          // but may have failed conversion (e.g., corrupt .docx)
        }
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
            actorId: userId,
            newValue: {
              error: err instanceof Error ? err.message : 'Unknown error',
              phase: 'download-convert',
              filesAttempted: filesToExtract.length,
            },
          });
        });
        throw err;
      }

      // Phase 3: Merge and store
      if (extractedDocs.length === 0) {
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
            actorId: userId,
            newValue: {
              error: 'All file conversions failed',
              filesAttempted: filesToExtract.length,
            },
          });
        });
        return;
      }

      const mergedDoc = mergeDocuments(extractedDocs);

      await withRls(rlsCtx, async (tx: DrizzleDb) => {
        await contentExtractionService.storeContent(
          tx,
          manuscriptVersionId,
          userId,
          mergedDoc,
        );
        await auditService.log(tx, {
          resource: AuditResources.MANUSCRIPT,
          action: AuditActions.CONTENT_EXTRACT_COMPLETE,
          resourceId: manuscriptVersionId,
          actorId: userId,
          newValue: {
            contentFormat: 'prosemirror_v1',
            nodeCount: mergedDoc.content.length,
            filesExtracted: extractedDocs.map((d) => d.filename),
            totalFiles: filesToExtract.length,
          },
        });
      });
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
