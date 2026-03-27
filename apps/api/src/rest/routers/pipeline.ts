import { z } from 'zod';
import {
  listPipelineItemsSchema,
  createPipelineItemSchema,
  updatePipelineStageSchema,
  assignPipelineRoleSchema,
  addPipelineCommentSchema,
  idParamSchema,
  pipelineItemSchema,
  pipelineCommentSchema,
  pipelineHistoryEntrySchema,
  paginatedResponseSchema,
} from '@colophony/types';
import { restPaginationQuery } from '@colophony/api-contracts';
import {
  pipelineService,
  PipelineItemNotFoundError,
} from '../../services/pipeline.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';
import {
  orgProcedure,
  productionProcedure,
  requireScopes,
} from '../context.js';

// ---------------------------------------------------------------------------
// Query schemas — override page/limit with z.coerce for REST query strings
// ---------------------------------------------------------------------------

const paginatedPipelineSchema = paginatedResponseSchema(pipelineItemSchema);

const restListPipelineQuery = listPipelineItemsSchema
  .omit({ page: true, limit: true })
  .merge(restPaginationQuery);

// ---------------------------------------------------------------------------
// Pipeline routes
// ---------------------------------------------------------------------------

const list = orgProcedure
  .use(requireScopes('pipeline:read'))
  .route({
    method: 'GET',
    path: '/pipeline',
    summary: 'List pipeline items',
    description:
      'Returns a paginated list of pipeline items in the organization.',
    operationId: 'listPipelineItems',
    tags: ['Pipeline'],
  })
  .input(restListPipelineQuery)
  .output(paginatedPipelineSchema)
  .handler(async ({ input, context }) => {
    return pipelineService.list(context.dbTx, input, context.authContext.orgId);
  });

const create = productionProcedure
  .use(requireScopes('pipeline:write'))
  .route({
    method: 'POST',
    path: '/pipeline',
    successStatus: 201,
    summary: 'Create a pipeline item',
    description: 'Move an accepted submission into the publication pipeline.',
    operationId: 'createPipelineItem',
    tags: ['Pipeline'],
  })
  .input(createPipelineItemSchema)
  .output(pipelineItemSchema)
  .handler(async ({ input, context }) => {
    try {
      return await pipelineService.createWithAudit(
        toServiceContext(context),
        input,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const get = orgProcedure
  .use(requireScopes('pipeline:read'))
  .route({
    method: 'GET',
    path: '/pipeline/{id}',
    summary: 'Get a pipeline item',
    description: 'Retrieve a pipeline item by ID.',
    operationId: 'getPipelineItem',
    tags: ['Pipeline'],
  })
  .input(idParamSchema)
  .output(pipelineItemSchema)
  .handler(async ({ input, context }) => {
    try {
      const item = await pipelineService.getById(
        context.dbTx,
        input.id,
        context.authContext.orgId,
      );
      if (!item) throw new PipelineItemNotFoundError(input.id);
      return item;
    } catch (e) {
      mapServiceError(e);
    }
  });

const updateStage = productionProcedure
  .use(requireScopes('pipeline:write'))
  .route({
    method: 'PATCH',
    path: '/pipeline/{id}/stage',
    summary: 'Update pipeline stage',
    description: 'Advance or change the pipeline stage for an item.',
    operationId: 'updatePipelineStage',
    tags: ['Pipeline'],
  })
  .input(idParamSchema.merge(updatePipelineStageSchema))
  .output(pipelineItemSchema)
  .handler(async ({ input, context }) => {
    const { id, ...data } = input;
    try {
      return await pipelineService.updateStageWithAudit(
        toServiceContext(context),
        id,
        data,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const assignCopyeditor = productionProcedure
  .use(requireScopes('pipeline:write'))
  .route({
    method: 'PUT',
    path: '/pipeline/{id}/copyeditor',
    summary: 'Assign copyeditor',
    description: 'Assign a copyeditor to a pipeline item.',
    operationId: 'assignPipelineCopyeditor',
    tags: ['Pipeline'],
  })
  .input(idParamSchema.merge(assignPipelineRoleSchema))
  .output(pipelineItemSchema)
  .handler(async ({ input, context }) => {
    const { id, ...data } = input;
    try {
      return await pipelineService.assignCopyeditorWithAudit(
        toServiceContext(context),
        id,
        data,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const assignProofreader = productionProcedure
  .use(requireScopes('pipeline:write'))
  .route({
    method: 'PUT',
    path: '/pipeline/{id}/proofreader',
    summary: 'Assign proofreader',
    description: 'Assign a proofreader to a pipeline item.',
    operationId: 'assignPipelineProofreader',
    tags: ['Pipeline'],
  })
  .input(idParamSchema.merge(assignPipelineRoleSchema))
  .output(pipelineItemSchema)
  .handler(async ({ input, context }) => {
    const { id, ...data } = input;
    try {
      return await pipelineService.assignProofreaderWithAudit(
        toServiceContext(context),
        id,
        data,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const addComment = productionProcedure
  .use(requireScopes('pipeline:write'))
  .route({
    method: 'POST',
    path: '/pipeline/{id}/comments',
    successStatus: 201,
    summary: 'Add a comment',
    description: 'Add a comment to a pipeline item.',
    operationId: 'addPipelineComment',
    tags: ['Pipeline'],
  })
  .input(idParamSchema.merge(addPipelineCommentSchema))
  .output(pipelineCommentSchema)
  .handler(async ({ input, context }) => {
    const { id, ...data } = input;
    try {
      return await pipelineService.addCommentWithAudit(
        toServiceContext(context),
        id,
        data,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const listComments = orgProcedure
  .use(requireScopes('pipeline:read'))
  .route({
    method: 'GET',
    path: '/pipeline/{id}/comments',
    summary: 'List comments',
    description: 'List all comments for a pipeline item.',
    operationId: 'listPipelineComments',
    tags: ['Pipeline'],
  })
  .input(idParamSchema)
  .output(z.array(pipelineCommentSchema))
  .handler(async ({ input, context }) => {
    return pipelineService.listComments(
      context.dbTx,
      input.id,
      context.authContext.orgId,
    );
  });

const getHistory = orgProcedure
  .use(requireScopes('pipeline:read'))
  .route({
    method: 'GET',
    path: '/pipeline/{id}/history',
    summary: 'Get stage history',
    description: 'Get the stage transition history for a pipeline item.',
    operationId: 'getPipelineHistory',
    tags: ['Pipeline'],
  })
  .input(idParamSchema)
  .output(z.array(pipelineHistoryEntrySchema))
  .handler(async ({ input, context }) => {
    return pipelineService.getHistory(
      context.dbTx,
      input.id,
      context.authContext.orgId,
    );
  });

// ---------------------------------------------------------------------------
// Assembled router
// ---------------------------------------------------------------------------

export const pipelineRouter = {
  list,
  create,
  get,
  updateStage,
  assignCopyeditor,
  assignProofreader,
  addComment,
  listComments,
  getHistory,
};
