import {
  fileIdParamSchema,
  manuscriptVersionIdParamSchema,
} from '@colophony/types';
import { fileService } from '../../services/file.service.js';
import { getGlobalRegistry } from '../../adapters/registry-accessor.js';
import type { S3StorageAdapter } from '../../adapters/storage/index.js';
import { toUserServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';
import { userProcedure, requireScopes } from '../context.js';

function getStorage(): S3StorageAdapter {
  return getGlobalRegistry().resolve<S3StorageAdapter>('storage');
}

// ---------------------------------------------------------------------------
// File routes (user-scoped — files belong to manuscript versions)
// ---------------------------------------------------------------------------

const list = userProcedure
  .use(requireScopes('files:read'))
  .route({
    method: 'GET',
    path: '/manuscript-versions/{manuscriptVersionId}/files',
    summary: 'List files for a manuscript version',
    description: 'Returns all files attached to a manuscript version.',
    operationId: 'listManuscriptVersionFiles',
    tags: ['Files'],
  })
  .input(manuscriptVersionIdParamSchema)
  .handler(async ({ input, context }) => {
    try {
      return await fileService.listByManuscriptVersionWithAccess(
        toUserServiceContext(context),
        input.manuscriptVersionId,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const download = userProcedure
  .use(requireScopes('files:read'))
  .route({
    method: 'GET',
    path: '/files/{fileId}/download',
    summary: 'Get file download URL',
    description:
      'Returns a pre-signed download URL for a file. Only available for files with CLEAN scan status.',
    operationId: 'getFileDownloadUrl',
    tags: ['Files'],
  })
  .input(fileIdParamSchema)
  .handler(async ({ input, context }) => {
    try {
      return await fileService.getDownloadUrlWithAccess(
        toUserServiceContext(context),
        input.fileId,
        getStorage(),
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const del = userProcedure
  .use(requireScopes('files:write'))
  .route({
    method: 'DELETE',
    path: '/files/{fileId}',
    summary: 'Delete a file',
    description:
      'Delete a file from a manuscript version. Only the manuscript owner can delete files.',
    operationId: 'deleteFile',
    tags: ['Files'],
  })
  .input(fileIdParamSchema)
  .handler(async ({ input, context }) => {
    try {
      return await fileService.deleteAsOwner(
        toUserServiceContext(context),
        input.fileId,
        getStorage(),
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
