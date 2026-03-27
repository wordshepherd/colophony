import { z } from 'zod';
import {
  createCollectionSchema,
  updateCollectionSchema,
  listCollectionsSchema,
  addCollectionItemSchema,
  updateCollectionItemSchema,
  reorderCollectionItemsSchema,
  workspaceCollectionSchema,
  workspaceItemSchema,
  idParamSchema,
  paginatedResponseSchema,
} from '@colophony/types';
import { restPaginationQuery } from '@colophony/api-contracts';
import {
  collectionService,
  CollectionNotFoundError,
} from '../../services/collection.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';
import { orgProcedure, requireScopes } from '../context.js';

// ---------------------------------------------------------------------------
// Query schemas
// ---------------------------------------------------------------------------

const restListQuery = listCollectionsSchema
  .omit({ page: true, limit: true })
  .merge(restPaginationQuery);

const itemIdParam = z.object({
  id: z.string().uuid().describe('Collection ID'),
  itemId: z.string().uuid().describe('Item ID'),
});

// ---------------------------------------------------------------------------
// Collection routes
// ---------------------------------------------------------------------------

const list = orgProcedure
  .use(requireScopes('collections:read'))
  .route({
    method: 'GET',
    path: '/collections',
    summary: 'List collections',
    description:
      'Returns a paginated list of collections visible to the current user.',
    operationId: 'listCollections',
    tags: ['Collections'],
  })
  .input(restListQuery)
  .output(paginatedResponseSchema(workspaceCollectionSchema))
  .handler(async ({ input, context }) => {
    return collectionService.list(
      context.dbTx,
      input,
      context.authContext.orgId,
      context.authContext.userId,
    );
  });

const get = orgProcedure
  .use(requireScopes('collections:read'))
  .route({
    method: 'GET',
    path: '/collections/{id}',
    summary: 'Get a collection',
    description: 'Retrieve a collection by ID.',
    operationId: 'getCollection',
    tags: ['Collections'],
  })
  .input(idParamSchema)
  .output(workspaceCollectionSchema)
  .handler(async ({ input, context }) => {
    try {
      const collection = await collectionService.getById(
        context.dbTx,
        input.id,
        context.authContext.orgId,
      );
      if (!collection) throw new CollectionNotFoundError(input.id);
      return collection;
    } catch (e) {
      mapServiceError(e);
    }
  });

const getItems = orgProcedure
  .use(requireScopes('collections:read'))
  .route({
    method: 'GET',
    path: '/collections/{id}/items',
    summary: 'Get collection items',
    description: 'Retrieve all items in a collection, ordered by position.',
    operationId: 'getCollectionItems',
    tags: ['Collections'],
  })
  .input(idParamSchema)
  .output(z.array(workspaceItemSchema))
  .handler(async ({ input, context }) => {
    return collectionService.getItems(
      context.dbTx,
      input.id,
      context.authContext.orgId,
    );
  });

const create = orgProcedure
  .use(requireScopes('collections:write'))
  .route({
    method: 'POST',
    path: '/collections',
    successStatus: 201,
    summary: 'Create a collection',
    description: 'Create a new workspace collection.',
    operationId: 'createCollection',
    tags: ['Collections'],
  })
  .input(createCollectionSchema)
  .output(workspaceCollectionSchema)
  .handler(async ({ input, context }) => {
    try {
      return await collectionService.createWithAudit(
        toServiceContext(context),
        input,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const update = orgProcedure
  .use(requireScopes('collections:write'))
  .route({
    method: 'PATCH',
    path: '/collections/{id}',
    summary: 'Update a collection',
    description: 'Update collection name, description, visibility, or type.',
    operationId: 'updateCollection',
    tags: ['Collections'],
  })
  .input(idParamSchema.merge(updateCollectionSchema))
  .output(workspaceCollectionSchema)
  .handler(async ({ input, context }) => {
    try {
      const { id, ...data } = input;
      return await collectionService.updateWithAudit(
        toServiceContext(context),
        id,
        data,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const del = orgProcedure
  .use(requireScopes('collections:write'))
  .route({
    method: 'DELETE',
    path: '/collections/{id}',
    summary: 'Delete a collection',
    description: 'Delete a collection and all its items.',
    operationId: 'deleteCollection',
    tags: ['Collections'],
  })
  .input(idParamSchema)
  .output(workspaceCollectionSchema)
  .handler(async ({ input, context }) => {
    try {
      return await collectionService.deleteWithAudit(
        toServiceContext(context),
        input.id,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const addItem = orgProcedure
  .use(requireScopes('collections:write'))
  .route({
    method: 'POST',
    path: '/collections/{id}/items',
    successStatus: 201,
    summary: 'Add item to collection',
    description: 'Add a submission to a collection.',
    operationId: 'addCollectionItem',
    tags: ['Collections'],
  })
  .input(idParamSchema.merge(addCollectionItemSchema))
  .output(workspaceItemSchema)
  .handler(async ({ input, context }) => {
    try {
      const { id, ...data } = input;
      return await collectionService.addItemWithAudit(
        toServiceContext(context),
        id,
        data,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const updateItem = orgProcedure
  .use(requireScopes('collections:write'))
  .route({
    method: 'PATCH',
    path: '/collections/{id}/items/{itemId}',
    summary: 'Update collection item',
    description: 'Update notes, color, or icon on a collection item.',
    operationId: 'updateCollectionItem',
    tags: ['Collections'],
  })
  .input(itemIdParam.merge(updateCollectionItemSchema))
  .output(workspaceItemSchema)
  .handler(async ({ input, context }) => {
    try {
      const { id, itemId, ...data } = input;
      return await collectionService.updateItemWithAudit(
        toServiceContext(context),
        id,
        itemId,
        data,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const removeItem = orgProcedure
  .use(requireScopes('collections:write'))
  .route({
    method: 'DELETE',
    path: '/collections/{id}/items/{itemId}',
    summary: 'Remove item from collection',
    description: 'Remove a submission from a collection.',
    operationId: 'removeCollectionItem',
    tags: ['Collections'],
  })
  .input(itemIdParam)
  .output(workspaceItemSchema.nullable())
  .handler(async ({ input, context }) => {
    try {
      return await collectionService.removeItemWithAudit(
        toServiceContext(context),
        input.id,
        input.itemId,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const reorderItems = orgProcedure
  .use(requireScopes('collections:write'))
  .route({
    method: 'PUT',
    path: '/collections/{id}/items/reorder',
    summary: 'Reorder collection items',
    description: 'Update the sort positions of items in a collection.',
    operationId: 'reorderCollectionItems',
    tags: ['Collections'],
  })
  .input(idParamSchema.merge(reorderCollectionItemsSchema))
  .output(z.array(workspaceItemSchema))
  .handler(async ({ input, context }) => {
    try {
      const { id, ...data } = input;
      return await collectionService.reorderItems(
        context.dbTx,
        id,
        data,
        context.authContext.orgId,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

export const collectionsRouter = {
  list,
  get,
  getItems,
  create,
  update,
  delete: del,
  addItem,
  updateItem,
  removeItem,
  reorderItems,
};
