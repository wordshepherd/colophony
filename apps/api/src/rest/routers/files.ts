import { z } from 'zod';
import { fileService } from '../../services/file.service.js';
import { createS3Client } from '../../services/s3.js';
import { validateEnv } from '../../config/env.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';
import { orgProcedure } from '../context.js';

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

// ---------------------------------------------------------------------------
// Path param schemas
// ---------------------------------------------------------------------------

const submissionIdParam = z.object({ submissionId: z.string().uuid() });
const fileIdParam = z.object({ fileId: z.string().uuid() });

// ---------------------------------------------------------------------------
// File routes
// ---------------------------------------------------------------------------

const list = orgProcedure
  .route({ method: 'GET', path: '/submissions/{submissionId}/files' })
  .input(submissionIdParam)
  .handler(async ({ input, context }) => {
    try {
      return await fileService.listBySubmissionWithAccess(
        toServiceContext(context),
        input.submissionId,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const download = orgProcedure
  .route({ method: 'GET', path: '/files/{fileId}/download' })
  .input(fileIdParam)
  .handler(async ({ input, context }) => {
    try {
      const env = getEnvConfig();
      return await fileService.getDownloadUrlWithAccess(
        toServiceContext(context),
        input.fileId,
        getS3Client(),
        env.S3_BUCKET,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const del = orgProcedure
  .route({ method: 'DELETE', path: '/files/{fileId}' })
  .input(fileIdParam)
  .handler(async ({ input, context }) => {
    try {
      const env = getEnvConfig();
      return await fileService.deleteAsOwner(
        toServiceContext(context),
        input.fileId,
        getS3Client(),
        env.S3_BUCKET,
        env.S3_QUARANTINE_BUCKET,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

// ---------------------------------------------------------------------------
// Assembled router
// ---------------------------------------------------------------------------

export const filesRouter = {
  list,
  download,
  delete: del,
};
