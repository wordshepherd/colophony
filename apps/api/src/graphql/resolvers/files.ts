import { fileIdParamSchema } from '@colophony/types';
import { builder } from '../builder.js';
import { requireUserContext, requireScopes } from '../guards.js';
import { toUserServiceContext } from '../../services/context.js';
import { fileService } from '../../services/file.service.js';
import { getGlobalRegistry } from '../../adapters/registry-accessor.js';
import type { S3StorageAdapter } from '../../adapters/storage/index.js';
import { mapServiceError } from '../error-mapper.js';
import { SuccessPayload } from '../types/payloads.js';

function getStorage(): S3StorageAdapter {
  return getGlobalRegistry().resolve<S3StorageAdapter>('storage');
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
        return await fileService.deleteAsOwner(
          toUserServiceContext(userCtx),
          fileId,
          getStorage(),
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),
}));
