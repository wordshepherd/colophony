import { z } from "zod";

// ---------------------------------------------------------------------------
// Filter schemas
// ---------------------------------------------------------------------------

export const analyticsFilterSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  submissionPeriodId: z.string().uuid().optional(),
});
export type AnalyticsFilter = z.infer<typeof analyticsFilterSchema>;

export const timeSeriesFilterSchema = analyticsFilterSchema.extend({
  granularity: z.enum(["daily", "weekly", "monthly"]).default("monthly"),
});
export type TimeSeriesFilter = z.infer<typeof timeSeriesFilterSchema>;

export const agingFilterSchema = analyticsFilterSchema.extend({
  thresholdDays: z.number().int().min(1).default(14),
});
export type AgingFilter = z.infer<typeof agingFilterSchema>;

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

export const submissionOverviewStatsSchema = z.object({
  totalSubmissions: z.number().int(),
  acceptanceRate: z.number().min(0).max(100),
  avgResponseTimeDays: z.number().nullable(),
  pendingCount: z.number().int(),
  submissionsThisMonth: z.number().int(),
  submissionsLastMonth: z.number().int(),
});
export type SubmissionOverviewStats = z.infer<
  typeof submissionOverviewStatsSchema
>;

export const submissionStatusBreakdownSchema = z.object({
  breakdown: z.array(
    z.object({
      status: z.string(),
      count: z.number().int(),
    }),
  ),
});
export type SubmissionStatusBreakdown = z.infer<
  typeof submissionStatusBreakdownSchema
>;

export const submissionFunnelSchema = z.object({
  stages: z.array(
    z.object({
      stage: z.string(),
      count: z.number().int(),
    }),
  ),
});
export type SubmissionFunnel = z.infer<typeof submissionFunnelSchema>;

export const submissionTimeSeriesSchema = z.object({
  granularity: z.enum(["daily", "weekly", "monthly"]),
  points: z.array(
    z.object({
      date: z.string(),
      count: z.number().int(),
    }),
  ),
});
export type SubmissionTimeSeries = z.infer<typeof submissionTimeSeriesSchema>;

export const responseTimeDistributionSchema = z.object({
  buckets: z.array(
    z.object({
      label: z.string(),
      count: z.number().int(),
      minDays: z.number(),
      maxDays: z.number(),
    }),
  ),
  medianDays: z.number().nullable(),
});
export type ResponseTimeDistribution = z.infer<
  typeof responseTimeDistributionSchema
>;

export const agingSubmissionsSchema = z.object({
  brackets: z.array(
    z.object({
      label: z.string(),
      count: z.number().int(),
      submissions: z.array(
        z.object({
          id: z.string().uuid(),
          title: z.string().nullable(),
          status: z.string(),
          submittedAt: z.coerce.date().nullable(),
          daysPending: z.number().int(),
        }),
      ),
    }),
  ),
  totalAging: z.number().int(),
});
export type AgingSubmissions = z.infer<typeof agingSubmissionsSchema>;
