import { submissionIdParamSchema, fileIdParamSchema } from '@colophony/types';
import { fileService } from '../../services/file.service.js';
import { createS3Client } from '../../services/s3.js';
import { validateEnv } from '../../config/env.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';
import { orgProcedure, requireScopes } from '../context.js';

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
// File routes
// ---------------------------------------------------------------------------

const list = orgProcedure
  .use(requireScopes('files:read'))
  .route({ method: 'GET', path: '/submissions/{submissionId}/files' })
  .input(submissionIdParamSchema)
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
  .use(requireScopes('files:read'))
  .route({ method: 'GET', path: '/files/{fileId}/download' })
  .input(fileIdParamSchema)
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
  .use(requireScopes('files:write'))
  .route({ method: 'DELETE', path: '/files/{fileId}' })
  .input(fileIdParamSchema)
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
