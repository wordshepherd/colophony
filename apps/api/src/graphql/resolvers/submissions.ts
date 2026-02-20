import type { Submission } from '@colophony/db';
import { listSubmissionsSchema } from '@colophony/types';
import { builder } from '../builder.js';
import { requireOrgContext, requireScopes } from '../guards.js';
import { toServiceContext } from '../../services/context.js';
import { assertEditorOrAdmin } from '../../services/errors.js';
import { submissionService } from '../../services/submission.service.js';
import { mapServiceError } from '../error-mapper.js';
import { SubmissionType, SubmissionHistoryType } from '../types/index.js';

// ---------------------------------------------------------------------------
// Paginated response types
// ---------------------------------------------------------------------------

const PaginatedSubmissions = builder
  .objectRef<{
    items: Submission[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>('PaginatedSubmissions')
  .implement({
    fields: (t) => ({
      items: t.field({ type: [SubmissionType], resolve: (r) => r.items }),
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
  /**
   * List all submissions (editor/admin view).
   * Requires editor or admin role.
   */
  submissions: t.field({
    type: PaginatedSubmissions,
    args: {
      status: t.arg.string({ required: false }),
      submissionPeriodId: t.arg.string({ required: false }),
      search: t.arg.string({ required: false }),
      page: t.arg.int({ required: false, defaultValue: 1 }),
      limit: t.arg.int({ required: false, defaultValue: 20 }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'submissions:read');
      const input = listSubmissionsSchema.parse({
        status: args.status ?? undefined,
        submissionPeriodId: args.submissionPeriodId ?? undefined,
        search: args.search ?? undefined,
        page: args.page,
        limit: args.limit,
      });
      try {
        assertEditorOrAdmin(orgCtx.authContext.role);
        return await submissionService.listAll(orgCtx.dbTx, input);
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /**
   * List current user's own submissions.
   */
  mySubmissions: t.field({
    type: PaginatedSubmissions,
    args: {
      status: t.arg.string({ required: false }),
      submissionPeriodId: t.arg.string({ required: false }),
      search: t.arg.string({ required: false }),
      page: t.arg.int({ required: false, defaultValue: 1 }),
      limit: t.arg.int({ required: false, defaultValue: 20 }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'submissions:read');
      const input = listSubmissionsSchema.parse({
        status: args.status ?? undefined,
        submissionPeriodId: args.submissionPeriodId ?? undefined,
        search: args.search ?? undefined,
        page: args.page,
        limit: args.limit,
      });
      return submissionService.listBySubmitter(
        orgCtx.dbTx,
        orgCtx.authContext.userId,
        input,
      );
    },
  }),

  /**
   * Get a single submission by ID (with access check).
   */
  submission: t.field({
    type: SubmissionType,
    nullable: true,
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'submissions:read');
      try {
        return await submissionService.getByIdWithAccess(
          toServiceContext(orgCtx),
          args.id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /**
   * Get submission status history.
   */
  submissionHistory: t.field({
    type: [SubmissionHistoryType],
    args: {
      submissionId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'submissions:read');
      try {
        return await submissionService.getHistoryWithAccess(
          toServiceContext(orgCtx),
          args.submissionId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),
}));
