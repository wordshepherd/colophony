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
import {
  orgProcedure,
  editorProcedure,
  createRouter,
  requireScopes,
} from '../init.js';
import {
  collectionService,
  CollectionNotFoundError,
} from '../../services/collection.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';

const itemIdParam = z.object({
  id: z.string().uuid().describe('Collection ID'),
  itemId: z.string().uuid().describe('Item ID'),
});

export const collectionsRouter = createRouter({
  /** List collections visible to the current user. */
  list: orgProcedure
    .use(requireScopes('collections:read'))
    .input(listCollectionsSchema)
    .output(paginatedResponseSchema(workspaceCollectionSchema))
    .query(async ({ ctx, input }) => {
      return collectionService.list(
        ctx.dbTx,
        input,
        ctx.authContext.orgId,
        ctx.authContext.userId,
      );
    }),

  /** Get collection by ID. */
  getById: orgProcedure
    .use(requireScopes('collections:read'))
    .input(idParamSchema)
    .output(workspaceCollectionSchema)
    .query(async ({ ctx, input }) => {
      try {
        const collection = await collectionService.getById(
          ctx.dbTx,
          input.id,
          ctx.authContext.orgId,
          ctx.authContext.userId,
        );
        if (!collection) throw new CollectionNotFoundError(input.id);
        return collection;
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Get items in a collection. */
  getItems: orgProcedure
    .use(requireScopes('collections:read'))
    .input(idParamSchema)
    .output(z.array(workspaceItemSchema))
    .query(async ({ ctx, input }) => {
      return collectionService.getItems(
        ctx.dbTx,
        input.id,
        ctx.authContext.orgId,
        ctx.authContext.userId,
      );
    }),

  /** Create a collection. */
  create: editorProcedure
    .use(requireScopes('collections:write'))
    .input(createCollectionSchema)
    .output(workspaceCollectionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await collectionService.createWithAudit(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Update a collection. */
  update: editorProcedure
    .use(requireScopes('collections:write'))
    .input(idParamSchema.merge(updateCollectionSchema))
    .output(workspaceCollectionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...data } = input;
        return await collectionService.updateWithAudit(
          toServiceContext(ctx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Delete a collection. */
  delete: editorProcedure
    .use(requireScopes('collections:write'))
    .input(idParamSchema)
    .output(workspaceCollectionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await collectionService.deleteWithAudit(
          toServiceContext(ctx),
          input.id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Add a submission to a collection. */
  addItem: editorProcedure
    .use(requireScopes('collections:write'))
    .input(idParamSchema.merge(addCollectionItemSchema))
    .output(workspaceItemSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...data } = input;
        return await collectionService.addItemWithAudit(
          toServiceContext(ctx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Update item notes/color/icon. */
  updateItem: editorProcedure
    .use(requireScopes('collections:write'))
    .input(itemIdParam.merge(updateCollectionItemSchema))
    .output(workspaceItemSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, itemId, ...data } = input;
        return await collectionService.updateItemWithAudit(
          toServiceContext(ctx),
          id,
          itemId,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Remove an item from a collection. */
  removeItem: editorProcedure
    .use(requireScopes('collections:write'))
    .input(itemIdParam)
    .output(workspaceItemSchema.nullable())
    .mutation(async ({ ctx, input }) => {
      try {
        return await collectionService.removeItemWithAudit(
          toServiceContext(ctx),
          input.id,
          input.itemId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Reorder items within a collection. */
  reorderItems: editorProcedure
    .use(requireScopes('collections:write'))
    .input(idParamSchema.merge(reorderCollectionItemsSchema))
    .output(z.array(workspaceItemSchema))
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...data } = input;
        return await collectionService.reorderItems(
          ctx.dbTx,
          id,
          data,
          ctx.authContext.orgId,
          ctx.authContext.userId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),
});
