import type { Issue } from '@colophony/types';
import {
  listIssuesSchema,
  createIssueSchema,
  updateIssueSchema,
  addIssueItemSchema,
  addIssueSectionSchema,
  idParamSchema,
} from '@colophony/types';
import { builder } from '../builder.js';
import { requireOrgContext, requireAdmin, requireScopes } from '../guards.js';
import { toServiceContext } from '../../services/context.js';
import {
  issueService,
  IssueNotFoundError,
} from '../../services/issue.service.js';
import { mapServiceError } from '../error-mapper.js';
import { IssueType, IssueSectionType, IssueItemType } from '../types/index.js';

// ---------------------------------------------------------------------------
// Paginated response type
// ---------------------------------------------------------------------------

const PaginatedIssues = builder
  .objectRef<{
    items: Issue[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>('PaginatedIssues')
  .implement({
    fields: (t) => ({
      items: t.field({
        type: [IssueType],
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
  /** List issues in the org. */
  issues: t.field({
    type: PaginatedIssues,
    description: 'List issues in the organization.',
    args: {
      publicationId: t.arg.string({
        required: false,
        description: 'Filter by publication.',
      }),
      status: t.arg.string({
        required: false,
        description: 'Filter by status.',
      }),
      search: t.arg.string({
        required: false,
        description: 'Search by title.',
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
      await requireScopes(ctx, 'issues:read');
      const input = listIssuesSchema.parse({
        publicationId: args.publicationId ?? undefined,
        status: args.status ?? undefined,
        search: args.search ?? undefined,
        page: args.page,
        limit: args.limit,
      });
      return issueService.list(orgCtx.dbTx, input);
    },
  }),

  /** Get an issue by ID. */
  issue: t.field({
    type: IssueType,
    nullable: true,
    description: 'Get an issue by ID.',
    args: {
      id: t.arg.string({ required: true, description: 'Issue ID.' }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'issues:read');
      const { id } = idParamSchema.parse({ id: args.id });
      try {
        const issue = await issueService.getById(orgCtx.dbTx, id);
        if (!issue) throw new IssueNotFoundError(id);
        return issue;
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Get items in an issue. */
  issueItems: t.field({
    type: [IssueItemType],
    description: 'Get items in an issue, ordered by sort order.',
    args: {
      id: t.arg.string({ required: true, description: 'Issue ID.' }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'issues:read');
      const { id } = idParamSchema.parse({ id: args.id });
      return issueService.getItems(orgCtx.dbTx, id);
    },
  }),

  /** Get sections in an issue. */
  issueSections: t.field({
    type: [IssueSectionType],
    description: 'Get sections in an issue.',
    args: {
      id: t.arg.string({ required: true, description: 'Issue ID.' }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'issues:read');
      const { id } = idParamSchema.parse({ id: args.id });
      return issueService.getSections(orgCtx.dbTx, id);
    },
  }),
}));

// ---------------------------------------------------------------------------
// Mutation fields
// ---------------------------------------------------------------------------

builder.mutationFields((t) => ({
  /** Create an issue. */
  createIssue: t.field({
    type: IssueType,
    description: 'Create a new issue for a publication.',
    args: {
      publicationId: t.arg.string({
        required: true,
        description: 'Publication ID.',
      }),
      title: t.arg.string({ required: true, description: 'Issue title.' }),
      volume: t.arg.int({ required: false, description: 'Volume number.' }),
      issueNumber: t.arg.int({
        required: false,
        description: 'Issue number.',
      }),
      description: t.arg.string({
        required: false,
        description: 'Issue description.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireAdmin(ctx);
      await requireScopes(ctx, 'issues:write');
      const input = createIssueSchema.parse({
        publicationId: args.publicationId,
        title: args.title,
        volume: args.volume ?? undefined,
        issueNumber: args.issueNumber ?? undefined,
        description: args.description ?? undefined,
      });
      try {
        return await issueService.createWithAudit(
          toServiceContext(orgCtx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Update an issue. */
  updateIssue: t.field({
    type: IssueType,
    description: 'Update an existing issue.',
    args: {
      id: t.arg.string({ required: true, description: 'Issue ID.' }),
      title: t.arg.string({ required: false, description: 'New title.' }),
      description: t.arg.string({
        required: false,
        description: 'New description.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireAdmin(ctx);
      await requireScopes(ctx, 'issues:write');
      const { id } = idParamSchema.parse({ id: args.id });
      const data = updateIssueSchema.parse({
        title: args.title ?? undefined,
        description: args.description ?? undefined,
      });
      try {
        return await issueService.updateWithAudit(
          toServiceContext(orgCtx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Publish an issue. */
  publishIssue: t.field({
    type: IssueType,
    description: 'Publish an issue.',
    args: {
      id: t.arg.string({ required: true, description: 'Issue ID.' }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireAdmin(ctx);
      await requireScopes(ctx, 'issues:write');
      const { id } = idParamSchema.parse({ id: args.id });
      try {
        return await issueService.publishWithAudit(
          toServiceContext(orgCtx),
          id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Archive an issue. */
  archiveIssue: t.field({
    type: IssueType,
    description: 'Archive an issue.',
    args: {
      id: t.arg.string({ required: true, description: 'Issue ID.' }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireAdmin(ctx);
      await requireScopes(ctx, 'issues:write');
      const { id } = idParamSchema.parse({ id: args.id });
      try {
        return await issueService.archiveWithAudit(
          toServiceContext(orgCtx),
          id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Add a pipeline item to an issue. */
  addIssueItem: t.field({
    type: IssueItemType,
    description: 'Add a pipeline item to an issue.',
    args: {
      id: t.arg.string({ required: true, description: 'Issue ID.' }),
      pipelineItemId: t.arg.string({
        required: true,
        description: 'Pipeline item ID.',
      }),
      issueSectionId: t.arg.string({
        required: false,
        description: 'Section ID.',
      }),
      sortOrder: t.arg.int({
        required: false,
        description: 'Sort order.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireAdmin(ctx);
      await requireScopes(ctx, 'issues:write');
      const { id } = idParamSchema.parse({ id: args.id });
      const data = addIssueItemSchema.parse({
        pipelineItemId: args.pipelineItemId,
        issueSectionId: args.issueSectionId ?? undefined,
        sortOrder: args.sortOrder ?? undefined,
      });
      try {
        return await issueService.addItemWithAudit(
          toServiceContext(orgCtx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Add a section to an issue. */
  addIssueSection: t.field({
    type: IssueSectionType,
    description: 'Add a section to an issue.',
    args: {
      id: t.arg.string({ required: true, description: 'Issue ID.' }),
      title: t.arg.string({
        required: true,
        description: 'Section title.',
      }),
      sortOrder: t.arg.int({
        required: false,
        description: 'Sort order.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireAdmin(ctx);
      await requireScopes(ctx, 'issues:write');
      const { id } = idParamSchema.parse({ id: args.id });
      const data = addIssueSectionSchema.parse({
        title: args.title,
        sortOrder: args.sortOrder ?? undefined,
      });
      return issueService.addSection(orgCtx.dbTx, id, data);
    },
  }),
}));
