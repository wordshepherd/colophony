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
import { getGlobalRegistry } from '../../adapters/registry-accessor.js';
import type { S3StorageAdapter } from '../../adapters/storage/index.js';
import {
  toServiceContext,
  toUserServiceContext,
} from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';

function getStorage(): S3StorageAdapter {
  return getGlobalRegistry().resolve<S3StorageAdapter>('storage');
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
        return await fileService.getDownloadUrlWithAccess(
          toUserServiceContext(ctx),
          input.fileId,
          getStorage(),
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
        return await fileService.getDownloadUrlWithAccess(
          toServiceContext(ctx),
          input.fileId,
          getStorage(),
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
        return await fileService.deleteAsOwner(
          toUserServiceContext(ctx),
          input.fileId,
          getStorage(),
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),
});
