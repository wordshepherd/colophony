import { z } from 'zod';
import { orgProcedure, createRouter } from '../init.js';
import { fileService } from '../../services/file.service.js';
import { createS3Client } from '../../services/s3.js';
import { validateEnv } from '../../config/env.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';

// Lazily create S3 client (avoid creating at module load for tests)
let s3ClientInstance: ReturnType<typeof createS3Client> | null = null;

function getS3Client() {
  if (!s3ClientInstance) {
    const env = validateEnv();
    s3ClientInstance = createS3Client(env);
  }
  return s3ClientInstance;
}

function getEnvConfig() {
  return validateEnv();
}

export const filesRouter = createRouter({
  /** List files for a submission — owner or editor/admin. */
  listBySubmission: orgProcedure
    .input(z.object({ submissionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        return await fileService.listBySubmissionWithAccess(
          toServiceContext(ctx),
          input.submissionId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Get a presigned download URL for a file — owner or editor/admin, CLEAN only. */
  getDownloadUrl: orgProcedure
    .input(z.object({ fileId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const env = getEnvConfig();
        return await fileService.getDownloadUrlWithAccess(
          toServiceContext(ctx),
          input.fileId,
          getS3Client(),
          env.S3_BUCKET,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Delete a file — submission owner only, DRAFT only. */
  delete: orgProcedure
    .input(z.object({ fileId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const env = getEnvConfig();
        return await fileService.deleteAsOwner(
          toServiceContext(ctx),
          input.fileId,
          getS3Client(),
          env.S3_BUCKET,
          env.S3_QUARANTINE_BUCKET,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),
});
