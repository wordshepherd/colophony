import { fileIdParamSchema } from '@colophony/types';
import { builder } from '../builder.js';
import { requireUserContext, requireScopes } from '../guards.js';
import { toUserServiceContext } from '../../services/context.js';
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
   * Delete a file from a manuscript version (owner only).
   */
  deleteFile: t.field({
    type: SuccessPayload,
    description:
      'Delete a file from a manuscript version. Only the manuscript owner can delete.',
    args: {
      fileId: t.arg.string({
        required: true,
        description: 'ID of the file to delete.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const userCtx = requireUserContext(ctx);
      await requireScopes(ctx, 'files:write');
      const { fileId } = fileIdParamSchema.parse({ fileId: args.fileId });
      try {
        const env = getEnvConfig();
        return await fileService.deleteAsOwner(
          toUserServiceContext(userCtx),
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
