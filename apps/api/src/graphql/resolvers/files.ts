import { fileIdParamSchema } from '@colophony/types';
import { builder } from '../builder.js';
import { requireOrgContext, requireScopes } from '../guards.js';
import { toServiceContext } from '../../services/context.js';
import { fileService } from '../../services/file.service.js';
import { createS3Client } from '../../services/s3.js';
import { validateEnv } from '../../config/env.js';
import { mapServiceError } from '../error-mapper.js';
import { SuccessPayload } from '../types/payloads.js';

// ---------------------------------------------------------------------------
// Lazy S3 client (same pattern as tRPC files router)
// ---------------------------------------------------------------------------

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
// Mutation fields
// ---------------------------------------------------------------------------

builder.mutationFields((t) => ({
  /**
   * Delete a file from a DRAFT submission (owner only).
   */
  deleteFile: t.field({
    type: SuccessPayload,
    args: {
      fileId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'files:write');
      const { fileId } = fileIdParamSchema.parse({ fileId: args.fileId });
      try {
        const env = getEnvConfig();
        return await fileService.deleteAsOwner(
          toServiceContext(orgCtx),
          fileId,
          getS3Client(),
          env.S3_BUCKET,
          env.S3_QUARANTINE_BUCKET,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),
}));
