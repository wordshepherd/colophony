import type { SubmissionPeriod } from '@colophony/types';
import {
  listSubmissionPeriodsSchema,
  createSubmissionPeriodSchema,
  updateSubmissionPeriodSchema,
  idParamSchema,
} from '@colophony/types';
import { builder } from '../builder.js';
import { requireOrgContext, requireScopes } from '../guards.js';
import { toServiceContext } from '../../services/context.js';
import {
  periodService,
  PeriodNotFoundError,
} from '../../services/period.service.js';
import { mapServiceError } from '../error-mapper.js';
import { SubmissionPeriodType } from '../types/index.js';
import { SuccessPayload } from '../types/payloads.js';

// ---------------------------------------------------------------------------
// Paginated response type
// ---------------------------------------------------------------------------

const PaginatedSubmissionPeriods = builder
  .objectRef<{
    items: SubmissionPeriod[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>('PaginatedSubmissionPeriods')
  .implement({
    fields: (t) => ({
      items: t.field({
        type: [SubmissionPeriodType],
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
  /** List submission periods in the org. */
  submissionPeriods: t.field({
    type: PaginatedSubmissionPeriods,
    description: 'List submission periods in the organization.',
    args: {
      status: t.arg.string({
        required: false,
        description: 'Filter by computed status (UPCOMING, OPEN, CLOSED).',
      }),
      search: t.arg.string({
        required: false,
        description: 'Search by name.',
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
      await requireScopes(ctx, 'periods:read');
      const input = listSubmissionPeriodsSchema.parse({
        status: args.status ?? undefined,
        search: args.search ?? undefined,
        page: args.page,
        limit: args.limit,
      });
      return periodService.list(orgCtx.dbTx, input);
    },
  }),

  /** Get a single submission period by ID. */
  submissionPeriod: t.field({
    type: SubmissionPeriodType,
    nullable: true,
    description: 'Get a submission period by ID.',
    args: {
      id: t.arg.string({
        required: true,
        description: 'Submission period ID.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'periods:read');
      const { id } = idParamSchema.parse({ id: args.id });
      try {
        const period = await periodService.getById(orgCtx.dbTx, id);
        if (!period) throw new PeriodNotFoundError(id);
        return period;
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
  /** Create a new submission period. */
  createSubmissionPeriod: t.field({
    type: SubmissionPeriodType,
    description:
      'Create a new submission period — a time window for accepting submissions.',
    args: {
      name: t.arg.string({
        required: true,
        description: 'Display name for the period.',
      }),
      description: t.arg.string({
        required: false,
        description: 'Description of the period.',
      }),
      opensAt: t.arg({ type: 'DateTime', required: true }),
      closesAt: t.arg({ type: 'DateTime', required: true }),
      fee: t.arg.float({
        required: false,
        description: 'Submission fee in cents (omit for free).',
      }),
      maxSubmissions: t.arg.int({
        required: false,
        description: 'Maximum submissions (omit for unlimited).',
      }),
      formDefinitionId: t.arg.string({
        required: false,
        description: 'Form definition to link.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'periods:write');
      const input = createSubmissionPeriodSchema.parse({
        name: args.name,
        description: args.description ?? undefined,
        opensAt: args.opensAt,
        closesAt: args.closesAt,
        fee: args.fee ?? undefined,
        maxSubmissions: args.maxSubmissions ?? undefined,
        formDefinitionId: args.formDefinitionId ?? undefined,
      });
      try {
        return await periodService.createWithAudit(
          toServiceContext(orgCtx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Update a submission period. */
  updateSubmissionPeriod: t.field({
    type: SubmissionPeriodType,
    description: 'Update a submission period.',
    args: {
      id: t.arg.string({ required: true, description: 'Period ID.' }),
      name: t.arg.string({ required: false, description: 'New name.' }),
      description: t.arg.string({
        required: false,
        description: 'New description.',
      }),
      opensAt: t.arg({ type: 'DateTime', required: false }),
      closesAt: t.arg({ type: 'DateTime', required: false }),
      fee: t.arg.float({
        required: false,
        description: 'New fee in cents.',
      }),
      maxSubmissions: t.arg.int({
        required: false,
        description: 'New max submissions.',
      }),
      formDefinitionId: t.arg.string({
        required: false,
        description: 'Form definition to link (null to unlink).',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'periods:write');
      const { id } = idParamSchema.parse({ id: args.id });
      const data = updateSubmissionPeriodSchema.parse({
        name: args.name ?? undefined,
        description: args.description ?? undefined,
        opensAt: args.opensAt ?? undefined,
        closesAt: args.closesAt ?? undefined,
        fee: args.fee ?? undefined,
        maxSubmissions: args.maxSubmissions ?? undefined,
        formDefinitionId:
          args.formDefinitionId === null
            ? null
            : (args.formDefinitionId ?? undefined),
      });
      try {
        return await periodService.updateWithAudit(
          toServiceContext(orgCtx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Delete a submission period. */
  deleteSubmissionPeriod: t.field({
    type: SuccessPayload,
    description:
      'Delete a submission period. Fails if the period has submissions.',
    args: {
      id: t.arg.string({ required: true, description: 'Period ID.' }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'periods:write');
      const { id } = idParamSchema.parse({ id: args.id });
      try {
        return await periodService.deleteWithAudit(
          toServiceContext(orgCtx),
          id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),
}));
