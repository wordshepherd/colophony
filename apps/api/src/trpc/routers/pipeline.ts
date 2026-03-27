import {
  createPipelineItemSchema,
  updatePipelineStageSchema,
  assignPipelineRoleSchema,
  addPipelineCommentSchema,
  listPipelineItemsSchema,
  pipelineItemSchema,
  pipelineHistoryEntrySchema,
  pipelineCommentSchema,
  saveCopyeditInputSchema,
  copyeditContentSchema,
  productionDashboardInputSchema,
  productionDashboardSchema,
  idParamSchema,
  paginatedResponseSchema,
  manuscriptVersionSchema,
} from '@colophony/types';
import { z } from 'zod';
import {
  orgProcedure,
  adminProcedure,
  createRouter,
  requireScopes,
} from '../init.js';
import {
  pipelineService,
  PipelineItemNotFoundError,
} from '../../services/pipeline.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';

export const pipelineRouter = createRouter({
  /** List pipeline items in the org. */
  list: orgProcedure
    .use(requireScopes('pipeline:read'))
    .input(listPipelineItemsSchema)
    .output(paginatedResponseSchema(pipelineItemSchema))
    .query(async ({ ctx, input }) => {
      return pipelineService.list(ctx.dbTx, input, ctx.authContext.orgId);
    }),

  /** Get pipeline item by ID. */
  getById: orgProcedure
    .use(requireScopes('pipeline:read'))
    .input(idParamSchema)
    .output(pipelineItemSchema)
    .query(async ({ ctx, input }) => {
      try {
        const item = await pipelineService.getById(
          ctx.dbTx,
          input.id,
          ctx.authContext.orgId,
        );
        if (!item) throw new PipelineItemNotFoundError(input.id);
        return item;
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Create a pipeline item (editor/admin). */
  create: adminProcedure
    .use(requireScopes('pipeline:write'))
    .input(createPipelineItemSchema)
    .output(pipelineItemSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await pipelineService.createWithAudit(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Advance/change pipeline stage (editor/admin). */
  updateStage: adminProcedure
    .use(requireScopes('pipeline:write'))
    .input(idParamSchema.merge(updatePipelineStageSchema))
    .output(pipelineItemSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      try {
        return await pipelineService.updateStageWithAudit(
          toServiceContext(ctx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Assign a copyeditor (editor/admin). */
  assignCopyeditor: adminProcedure
    .use(requireScopes('pipeline:write'))
    .input(idParamSchema.merge(assignPipelineRoleSchema))
    .output(pipelineItemSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      try {
        return await pipelineService.assignCopyeditorWithAudit(
          toServiceContext(ctx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Assign a proofreader (editor/admin). */
  assignProofreader: adminProcedure
    .use(requireScopes('pipeline:write'))
    .input(idParamSchema.merge(assignPipelineRoleSchema))
    .output(pipelineItemSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      try {
        return await pipelineService.assignProofreaderWithAudit(
          toServiceContext(ctx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Add a comment to a pipeline item. */
  addComment: orgProcedure
    .use(requireScopes('pipeline:write'))
    .input(idParamSchema.merge(addPipelineCommentSchema))
    .output(pipelineCommentSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      try {
        return await pipelineService.addCommentWithAudit(
          toServiceContext(ctx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** List comments for a pipeline item. */
  listComments: orgProcedure
    .use(requireScopes('pipeline:read'))
    .input(idParamSchema)
    .output(z.array(pipelineCommentSchema))
    .query(async ({ ctx, input }) => {
      return pipelineService.listComments(
        ctx.dbTx,
        input.id,
        ctx.authContext.orgId,
      );
    }),

  /** Get stage transition history for a pipeline item. */
  getHistory: orgProcedure
    .use(requireScopes('pipeline:read'))
    .input(idParamSchema)
    .output(z.array(pipelineHistoryEntrySchema))
    .query(async ({ ctx, input }) => {
      return pipelineService.getHistory(
        ctx.dbTx,
        input.id,
        ctx.authContext.orgId,
      );
    }),

  /** Get manuscript content for the copyedit tab. */
  getCopyeditContent: orgProcedure
    .use(requireScopes('pipeline:read'))
    .input(idParamSchema)
    .output(copyeditContentSchema)
    .query(async ({ ctx, input }) => {
      return pipelineService.getCopyeditContent(
        ctx.dbTx,
        input.id,
        ctx.authContext.orgId,
      );
    }),

  /** Save copyedited content as a new manuscript version. */
  saveCopyedit: orgProcedure
    .use(requireScopes('pipeline:write'))
    .input(idParamSchema.merge(saveCopyeditInputSchema))
    .output(manuscriptVersionSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      try {
        return await pipelineService.saveCopyeditWithAudit(
          toServiceContext(ctx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Production dashboard: issue-centric pipeline overview. */
  dashboard: orgProcedure
    .use(requireScopes('pipeline:read'))
    .input(productionDashboardInputSchema)
    .output(productionDashboardSchema.nullable())
    .query(async ({ ctx, input }) => {
      return pipelineService.dashboard(ctx.dbTx, input, ctx.authContext.orgId);
    }),
});
