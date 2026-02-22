import { z } from 'zod';
import {
  createManuscriptSchema,
  updateManuscriptSchema,
  listManuscriptsSchema,
} from '@colophony/types';
import { toUserServiceContext } from '../../services/context.js';
import {
  manuscriptService,
  ManuscriptNotFoundError,
} from '../../services/manuscript.service.js';
import { mapServiceError } from '../error-mapper.js';
import { userProcedure, requireScopes } from '../context.js';

// ---------------------------------------------------------------------------
// Manuscript routes (user-scoped, no org required)
// ---------------------------------------------------------------------------

const list = userProcedure
  .use(requireScopes('manuscripts:read'))
  .route({
    method: 'GET',
    path: '/manuscripts',
    summary: 'List manuscripts',
    description: 'Returns all manuscripts owned by the authenticated user.',
    operationId: 'listManuscripts',
    tags: ['Manuscripts'],
  })
  .input(listManuscriptsSchema)
  .handler(async ({ input, context }) => {
    try {
      return await manuscriptService.list(
        context.dbTx,
        context.authContext.userId,
        input,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const getById = userProcedure
  .use(requireScopes('manuscripts:read'))
  .route({
    method: 'GET',
    path: '/manuscripts/{manuscriptId}',
    summary: 'Get manuscript by ID',
    description: 'Returns a single manuscript with versions and files.',
    operationId: 'getManuscript',
    tags: ['Manuscripts'],
  })
  .input(z.object({ manuscriptId: z.string().uuid() }))
  .handler(async ({ input, context }) => {
    try {
      const detail = await manuscriptService.getDetail(
        context.dbTx,
        input.manuscriptId,
      );
      if (!detail) throw new ManuscriptNotFoundError(input.manuscriptId);
      return detail;
    } catch (e) {
      mapServiceError(e);
    }
  });

const create = userProcedure
  .use(requireScopes('manuscripts:write'))
  .route({
    method: 'POST',
    path: '/manuscripts',
    summary: 'Create manuscript',
    description: 'Creates a new manuscript with an initial version.',
    operationId: 'createManuscript',
    tags: ['Manuscripts'],
  })
  .input(createManuscriptSchema)
  .handler(async ({ input, context }) => {
    try {
      return await manuscriptService.createWithAudit(
        toUserServiceContext(context),
        input,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const update = userProcedure
  .use(requireScopes('manuscripts:write'))
  .route({
    method: 'PATCH',
    path: '/manuscripts/{manuscriptId}',
    summary: 'Update manuscript',
    description: 'Updates manuscript title and/or description.',
    operationId: 'updateManuscript',
    tags: ['Manuscripts'],
  })
  .input(
    z.object({ manuscriptId: z.string().uuid() }).merge(updateManuscriptSchema),
  )
  .handler(async ({ input, context }) => {
    try {
      const { manuscriptId, ...data } = input;
      return await manuscriptService.updateWithAudit(
        toUserServiceContext(context),
        manuscriptId,
        data,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const del = userProcedure
  .use(requireScopes('manuscripts:write'))
  .route({
    method: 'DELETE',
    path: '/manuscripts/{manuscriptId}',
    summary: 'Delete manuscript',
    description: 'Deletes a manuscript and all its versions and files.',
    operationId: 'deleteManuscript',
    tags: ['Manuscripts'],
  })
  .input(z.object({ manuscriptId: z.string().uuid() }))
  .handler(async ({ input, context }) => {
    try {
      await manuscriptService.deleteWithAudit(
        toUserServiceContext(context),
        input.manuscriptId,
      );
      return { success: true as const };
    } catch (e) {
      mapServiceError(e);
    }
  });

const createVersion = userProcedure
  .use(requireScopes('manuscripts:write'))
  .route({
    method: 'POST',
    path: '/manuscripts/{manuscriptId}/versions',
    summary: 'Create version',
    description: 'Creates a new version of a manuscript.',
    operationId: 'createManuscriptVersion',
    tags: ['Manuscripts'],
  })
  .input(
    z.object({
      manuscriptId: z.string().uuid(),
      label: z.string().max(255).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      return await manuscriptService.createVersionWithAudit(
        toUserServiceContext(context),
        input.manuscriptId,
        input.label,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const listVersions = userProcedure
  .use(requireScopes('manuscripts:read'))
  .route({
    method: 'GET',
    path: '/manuscripts/{manuscriptId}/versions',
    summary: 'List versions',
    description: 'Returns all versions of a manuscript.',
    operationId: 'listManuscriptVersions',
    tags: ['Manuscripts'],
  })
  .input(z.object({ manuscriptId: z.string().uuid() }))
  .handler(async ({ input, context }) => {
    try {
      const manuscript = await manuscriptService.getById(
        context.dbTx,
        input.manuscriptId,
      );
      if (!manuscript) throw new ManuscriptNotFoundError(input.manuscriptId);
      return await manuscriptService.listVersions(
        context.dbTx,
        input.manuscriptId,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const getRelatedSubmissions = userProcedure
  .use(requireScopes('manuscripts:read'))
  .route({
    method: 'GET',
    path: '/manuscripts/{manuscriptId}/submissions',
    summary: 'Related submissions',
    description:
      'Returns all submissions across all orgs that reference any version of this manuscript.',
    operationId: 'getManuscriptRelatedSubmissions',
    tags: ['Manuscripts'],
  })
  .input(z.object({ manuscriptId: z.string().uuid() }))
  .handler(async ({ input, context }) => {
    try {
      const manuscript = await manuscriptService.getById(
        context.dbTx,
        input.manuscriptId,
      );
      if (!manuscript) throw new ManuscriptNotFoundError(input.manuscriptId);
      return await manuscriptService.getRelatedSubmissions(
        context.dbTx,
        input.manuscriptId,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

// ---------------------------------------------------------------------------
// Assembled router
// ---------------------------------------------------------------------------

export const manuscriptsRouter = {
  list,
  getById,
  create,
  update,
  delete: del,
  createVersion,
  listVersions,
  getRelatedSubmissions,
};
