import { z } from 'zod';
import {
  fileIdParamSchema,
  fileSchema,
  downloadUrlResponseSchema,
  successResponseSchema,
  manuscriptVersionIdParamSchema,
} from '@colophony/types';
import {
  userProcedure,
  orgProcedure,
  createRouter,
  requireScopes,
} from '../init.js';
import { fileService } from '../../services/file.service.js';
import { createS3Client } from '../../services/s3.js';
import { validateEnv } from '../../config/env.js';
import {
  toServiceContext,
  toUserServiceContext,
} from '../../services/context.js';
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
  /** List files for a manuscript version — owner via RLS. */
  listByManuscriptVersion: userProcedure
    .use(requireScopes('files:read'))
    .input(manuscriptVersionIdParamSchema)
    .output(z.array(fileSchema))
    .query(async ({ ctx, input }) => {
      try {
        return await fileService.listByManuscriptVersionWithAccess(
          toUserServiceContext(ctx),
          input.manuscriptVersionId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Get a presigned download URL for a file — CLEAN only. */
  getDownloadUrl: userProcedure
    .use(requireScopes('files:read'))
    .input(fileIdParamSchema)
    .output(downloadUrlResponseSchema)
    .query(async ({ ctx, input }) => {
      try {
        const env = getEnvConfig();
        return await fileService.getDownloadUrlWithAccess(
          toUserServiceContext(ctx),
          input.fileId,
          getS3Client(),
          env.S3_BUCKET,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Get a presigned download URL — org context (for editors viewing submission files). */
  getDownloadUrlOrg: orgProcedure
    .use(requireScopes('files:read'))
    .input(fileIdParamSchema)
    .output(downloadUrlResponseSchema)
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

  /** Delete a file — manuscript owner only. */
  delete: userProcedure
    .use(requireScopes('files:write'))
    .input(fileIdParamSchema)
    .output(successResponseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const env = getEnvConfig();
        return await fileService.deleteAsOwner(
          toUserServiceContext(ctx),
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
