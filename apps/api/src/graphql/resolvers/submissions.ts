import type { Submission } from '@colophony/db';
import {
  listSubmissionsSchema,
  createSubmissionSchema,
  updateSubmissionSchema,
  updateSubmissionStatusSchema,
  idParamSchema,
} from '@colophony/types';
import { builder } from '../builder.js';
import { requireOrgContext, requireScopes } from '../guards.js';
import { toServiceContext } from '../../services/context.js';
import { assertEditorOrAdmin } from '../../services/errors.js';
import { submissionService } from '../../services/submission.service.js';
import { mapServiceError } from '../error-mapper.js';
import { SubmissionType, SubmissionHistoryType } from '../types/index.js';
import {
  SubmissionStatusChangePayload,
  SuccessPayload,
} from '../types/payloads.js';

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

// ---------------------------------------------------------------------------
// Mutation fields
// ---------------------------------------------------------------------------

builder.mutationFields((t) => ({
  /**
   * Create a new submission in DRAFT status.
   */
  createSubmission: t.field({
    type: SubmissionType,
    args: {
      title: t.arg.string({ required: true }),
      content: t.arg.string({ required: false }),
      coverLetter: t.arg.string({ required: false }),
      submissionPeriodId: t.arg.string({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'submissions:write');
      const input = createSubmissionSchema.parse({
        title: args.title,
        content: args.content ?? undefined,
        coverLetter: args.coverLetter ?? undefined,
        submissionPeriodId: args.submissionPeriodId ?? undefined,
      });
      try {
        return await submissionService.createWithAudit(
          toServiceContext(orgCtx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /**
   * Update a DRAFT submission (owner only).
   */
  updateSubmission: t.field({
    type: SubmissionType,
    args: {
      id: t.arg.string({ required: true }),
      title: t.arg.string({ required: false }),
      content: t.arg.string({ required: false }),
      coverLetter: t.arg.string({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'submissions:write');
      const { id } = idParamSchema.parse({ id: args.id });
      const data = updateSubmissionSchema.parse({
        title: args.title ?? undefined,
        content: args.content ?? undefined,
        coverLetter: args.coverLetter ?? undefined,
      });
      try {
        return await submissionService.updateAsOwner(
          toServiceContext(orgCtx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /**
   * Submit a DRAFT submission (DRAFT → SUBMITTED, owner only).
   */
  submitSubmission: t.field({
    type: SubmissionStatusChangePayload,
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'submissions:write');
      const { id } = idParamSchema.parse({ id: args.id });
      try {
        return await submissionService.submitAsOwner(
          toServiceContext(orgCtx),
          id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /**
   * Delete a DRAFT submission (owner only).
   */
  deleteSubmission: t.field({
    type: SuccessPayload,
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'submissions:write');
      const { id } = idParamSchema.parse({ id: args.id });
      try {
        return await submissionService.deleteAsOwner(
          toServiceContext(orgCtx),
          id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /**
   * Withdraw a submission (owner only).
   */
  withdrawSubmission: t.field({
    type: SubmissionStatusChangePayload,
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'submissions:write');
      const { id } = idParamSchema.parse({ id: args.id });
      try {
        return await submissionService.withdrawAsOwner(
          toServiceContext(orgCtx),
          id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /**
   * Update submission status (editor/admin transition with comment).
   */
  updateSubmissionStatus: t.field({
    type: SubmissionStatusChangePayload,
    args: {
      id: t.arg.string({ required: true }),
      status: t.arg.string({ required: true }),
      comment: t.arg.string({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'submissions:write');
      const { id } = idParamSchema.parse({ id: args.id });
      const { status, comment } = updateSubmissionStatusSchema.parse({
        status: args.status,
        comment: args.comment ?? undefined,
      });
      try {
        return await submissionService.updateStatusAsEditor(
          toServiceContext(orgCtx),
          id,
          status,
          comment,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),
}));
