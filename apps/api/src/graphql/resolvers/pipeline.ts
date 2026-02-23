import type { PipelineItem } from '@colophony/types';
import {
  listPipelineItemsSchema,
  createPipelineItemSchema,
  updatePipelineStageSchema,
  assignPipelineRoleSchema,
  addPipelineCommentSchema,
  idParamSchema,
} from '@colophony/types';
import { builder } from '../builder.js';
import { requireOrgContext, requireScopes } from '../guards.js';
import { toServiceContext } from '../../services/context.js';
import {
  pipelineService,
  PipelineItemNotFoundError,
} from '../../services/pipeline.service.js';
import { mapServiceError } from '../error-mapper.js';
import {
  PipelineItemType,
  PipelineHistoryEntryType,
  PipelineCommentType,
} from '../types/index.js';

// ---------------------------------------------------------------------------
// Paginated response type
// ---------------------------------------------------------------------------

const PaginatedPipelineItems = builder
  .objectRef<{
    items: PipelineItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>('PaginatedPipelineItems')
  .implement({
    fields: (t) => ({
      items: t.field({
        type: [PipelineItemType],
        resolve: (r) => r.items,
      }),
      total: t.exposeInt('total'),
      page: t.exposeInt('page'),
      limit: t.exposeInt('limit'),
      totalPages: t.exposeInt('totalPages'),
    }),
  });

// ---------------------------------------------------------------------------
// Query fields
// ---------------------------------------------------------------------------

builder.queryFields((t) => ({
  /** List pipeline items in the org. */
  pipelineItems: t.field({
    type: PaginatedPipelineItems,
    description: 'List pipeline items in the organization.',
    args: {
      stage: t.arg.string({
        required: false,
        description: 'Filter by pipeline stage.',
      }),
      publicationId: t.arg.string({
        required: false,
        description: 'Filter by publication.',
      }),
      assignedCopyeditorId: t.arg.string({
        required: false,
        description: 'Filter by assigned copyeditor.',
      }),
      assignedProofreaderId: t.arg.string({
        required: false,
        description: 'Filter by assigned proofreader.',
      }),
      search: t.arg.string({
        required: false,
        description: 'Search by submission title.',
      }),
      page: t.arg.int({
        required: false,
        defaultValue: 1,
        description: 'Page number (1-based).',
      }),
      limit: t.arg.int({
        required: false,
        defaultValue: 20,
        description: 'Items per page (1-100).',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'pipeline:read');
      const input = listPipelineItemsSchema.parse({
        stage: args.stage ?? undefined,
        publicationId: args.publicationId ?? undefined,
        assignedCopyeditorId: args.assignedCopyeditorId ?? undefined,
        assignedProofreaderId: args.assignedProofreaderId ?? undefined,
        search: args.search ?? undefined,
        page: args.page,
        limit: args.limit,
      });
      return pipelineService.list(orgCtx.dbTx, input);
    },
  }),

  /** Get a single pipeline item by ID. */
  pipelineItem: t.field({
    type: PipelineItemType,
    nullable: true,
    description: 'Get a pipeline item by ID.',
    args: {
      id: t.arg.string({ required: true, description: 'Pipeline item ID.' }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'pipeline:read');
      const { id } = idParamSchema.parse({ id: args.id });
      try {
        const item = await pipelineService.getById(orgCtx.dbTx, id);
        if (!item) throw new PipelineItemNotFoundError(id);
        return item;
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Get stage transition history for a pipeline item. */
  pipelineHistory: t.field({
    type: [PipelineHistoryEntryType],
    description: 'Get the stage transition history for a pipeline item.',
    args: {
      id: t.arg.string({ required: true, description: 'Pipeline item ID.' }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'pipeline:read');
      const { id } = idParamSchema.parse({ id: args.id });
      return pipelineService.getHistory(orgCtx.dbTx, id);
    },
  }),

  /** List comments for a pipeline item. */
  pipelineComments: t.field({
    type: [PipelineCommentType],
    description: 'List all comments for a pipeline item.',
    args: {
      id: t.arg.string({ required: true, description: 'Pipeline item ID.' }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'pipeline:read');
      const { id } = idParamSchema.parse({ id: args.id });
      return pipelineService.listComments(orgCtx.dbTx, id);
    },
  }),
}));

// ---------------------------------------------------------------------------
// Mutation fields
// ---------------------------------------------------------------------------

builder.mutationFields((t) => ({
  /** Create a pipeline item from an accepted submission. */
  createPipelineItem: t.field({
    type: PipelineItemType,
    description: 'Move an accepted submission into the publication pipeline.',
    args: {
      submissionId: t.arg.string({
        required: true,
        description: 'Submission ID.',
      }),
      publicationId: t.arg.string({
        required: false,
        description: 'Target publication ID.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'pipeline:write');
      const input = createPipelineItemSchema.parse({
        submissionId: args.submissionId,
        publicationId: args.publicationId ?? undefined,
      });
      try {
        return await pipelineService.createWithAudit(
          toServiceContext(orgCtx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Advance or change the pipeline stage. */
  updatePipelineStage: t.field({
    type: PipelineItemType,
    description: 'Advance or change the pipeline stage for an item.',
    args: {
      id: t.arg.string({ required: true, description: 'Pipeline item ID.' }),
      stage: t.arg.string({
        required: true,
        description: 'Target pipeline stage.',
      }),
      comment: t.arg.string({
        required: false,
        description: 'Optional comment for the transition.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'pipeline:write');
      const { id } = idParamSchema.parse({ id: args.id });
      const data = updatePipelineStageSchema.parse({
        stage: args.stage,
        comment: args.comment ?? undefined,
      });
      try {
        return await pipelineService.updateStageWithAudit(
          toServiceContext(orgCtx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Assign a copyeditor to a pipeline item. */
  assignPipelineCopyeditor: t.field({
    type: PipelineItemType,
    description: 'Assign a copyeditor to a pipeline item.',
    args: {
      id: t.arg.string({ required: true, description: 'Pipeline item ID.' }),
      userId: t.arg.string({
        required: true,
        description: 'User ID to assign.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'pipeline:write');
      const { id } = idParamSchema.parse({ id: args.id });
      const data = assignPipelineRoleSchema.parse({ userId: args.userId });
      try {
        return await pipelineService.assignCopyeditorWithAudit(
          toServiceContext(orgCtx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Assign a proofreader to a pipeline item. */
  assignPipelineProofreader: t.field({
    type: PipelineItemType,
    description: 'Assign a proofreader to a pipeline item.',
    args: {
      id: t.arg.string({ required: true, description: 'Pipeline item ID.' }),
      userId: t.arg.string({
        required: true,
        description: 'User ID to assign.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'pipeline:write');
      const { id } = idParamSchema.parse({ id: args.id });
      const data = assignPipelineRoleSchema.parse({ userId: args.userId });
      try {
        return await pipelineService.assignProofreaderWithAudit(
          toServiceContext(orgCtx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Add a comment to a pipeline item. */
  addPipelineComment: t.field({
    type: PipelineCommentType,
    description: 'Add a comment to a pipeline item.',
    args: {
      id: t.arg.string({ required: true, description: 'Pipeline item ID.' }),
      content: t.arg.string({
        required: true,
        description: 'Comment text.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'pipeline:write');
      const { id } = idParamSchema.parse({ id: args.id });
      const data = addPipelineCommentSchema.parse({ content: args.content });
      try {
        return await pipelineService.addCommentWithAudit(
          toServiceContext(orgCtx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),
}));
