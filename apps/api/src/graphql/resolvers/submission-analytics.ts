import { builder } from '../builder.js';
import { requireOrgContext, requireScopes } from '../guards.js';
import { assertEditorOrAdmin } from '../../services/errors.js';
import { submissionAnalyticsService } from '../../services/submission-analytics.service.js';
import { mapServiceError } from '../error-mapper.js';
import {
  SubmissionOverviewStatsType,
  SubmissionStatusBreakdownType,
  SubmissionFunnelType,
  SubmissionTimeSeriesType,
  ResponseTimeDistributionType,
  AgingSubmissionsType,
} from '../types/index.js';

// ---------------------------------------------------------------------------
// Helper to extract filter from args
// ---------------------------------------------------------------------------

function extractFilter(args: {
  startDate?: Date | null;
  endDate?: Date | null;
  submissionPeriodId?: string | null;
}) {
  return {
    startDate: args.startDate ?? undefined,
    endDate: args.endDate ?? undefined,
    submissionPeriodId: args.submissionPeriodId ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Query fields
// ---------------------------------------------------------------------------

builder.queryFields((t) => {
  const filterArgs = {
    startDate: t.arg({ type: 'DateTime', required: false }),
    endDate: t.arg({ type: 'DateTime', required: false }),
    submissionPeriodId: t.arg.string({ required: false }),
  } as const;

  return {
    submissionAnalyticsOverview: t.field({
      type: SubmissionOverviewStatsType,
      description:
        'Key submission statistics: totals, acceptance rate, avg response time.',
      args: filterArgs,
      resolve: async (_root, args, ctx) => {
        try {
          const orgCtx = requireOrgContext(ctx);
          await requireScopes(ctx, 'submissions:read');
          assertEditorOrAdmin(orgCtx.authContext.role);
          return await submissionAnalyticsService.getOverviewStats(
            orgCtx.dbTx,
            extractFilter(args),
          );
        } catch (e) {
          mapServiceError(e);
        }
      },
    }),

    submissionAnalyticsStatusBreakdown: t.field({
      type: SubmissionStatusBreakdownType,
      description: 'Submission counts grouped by status.',
      args: filterArgs,
      resolve: async (_root, args, ctx) => {
        try {
          const orgCtx = requireOrgContext(ctx);
          await requireScopes(ctx, 'submissions:read');
          assertEditorOrAdmin(orgCtx.authContext.role);
          return await submissionAnalyticsService.getStatusBreakdown(
            orgCtx.dbTx,
            extractFilter(args),
          );
        } catch (e) {
          mapServiceError(e);
        }
      },
    }),

    submissionAnalyticsFunnel: t.field({
      type: SubmissionFunnelType,
      description: 'Submission workflow funnel — count at each stage.',
      args: filterArgs,
      resolve: async (_root, args, ctx) => {
        try {
          const orgCtx = requireOrgContext(ctx);
          await requireScopes(ctx, 'submissions:read');
          assertEditorOrAdmin(orgCtx.authContext.role);
          return await submissionAnalyticsService.getFunnel(
            orgCtx.dbTx,
            extractFilter(args),
          );
        } catch (e) {
          mapServiceError(e);
        }
      },
    }),

    submissionAnalyticsTimeSeries: t.field({
      type: SubmissionTimeSeriesType,
      description: 'Submission counts over time by granularity.',
      args: {
        ...filterArgs,
        granularity: t.arg.string({
          required: false,
          description: 'Time series granularity: daily, weekly, monthly.',
        }),
      },
      resolve: async (_root, args, ctx) => {
        try {
          const orgCtx = requireOrgContext(ctx);
          await requireScopes(ctx, 'submissions:read');
          assertEditorOrAdmin(orgCtx.authContext.role);
          const granularity =
            args.granularity === 'daily' || args.granularity === 'weekly'
              ? args.granularity
              : ('monthly' as const);
          return await submissionAnalyticsService.getTimeSeries(orgCtx.dbTx, {
            ...extractFilter(args),
            granularity,
          });
        } catch (e) {
          mapServiceError(e);
        }
      },
    }),

    submissionAnalyticsResponseTime: t.field({
      type: ResponseTimeDistributionType,
      description: 'Response time histogram buckets and median.',
      args: filterArgs,
      resolve: async (_root, args, ctx) => {
        try {
          const orgCtx = requireOrgContext(ctx);
          await requireScopes(ctx, 'submissions:read');
          assertEditorOrAdmin(orgCtx.authContext.role);
          return await submissionAnalyticsService.getResponseTimeDistribution(
            orgCtx.dbTx,
            extractFilter(args),
          );
        } catch (e) {
          mapServiceError(e);
        }
      },
    }),

    submissionAnalyticsAging: t.field({
      type: AgingSubmissionsType,
      description: 'Non-terminal submissions older than threshold.',
      args: {
        ...filterArgs,
        thresholdDays: t.arg.int({
          required: false,
          defaultValue: 14,
          description: 'Age threshold in days.',
        }),
      },
      resolve: async (_root, args, ctx) => {
        try {
          const orgCtx = requireOrgContext(ctx);
          await requireScopes(ctx, 'submissions:read');
          assertEditorOrAdmin(orgCtx.authContext.role);
          return await submissionAnalyticsService.getAgingSubmissions(
            orgCtx.dbTx,
            {
              ...extractFilter(args),
              thresholdDays: args.thresholdDays ?? 14,
              maxPerBracket: 25,
            },
          );
        } catch (e) {
          mapServiceError(e);
        }
      },
    }),
  };
});
