import { z } from "zod";

// ---------------------------------------------------------------------------
// Filter schemas
// ---------------------------------------------------------------------------

export const writerAnalyticsFilterSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});
export type WriterAnalyticsFilter = z.infer<typeof writerAnalyticsFilterSchema>;

export const writerTimeSeriesFilterSchema = writerAnalyticsFilterSchema.extend({
  granularity: z.enum(["daily", "weekly", "monthly"]).default("monthly"),
});
export type WriterTimeSeriesFilter = z.infer<
  typeof writerTimeSeriesFilterSchema
>;

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

export const writerOverviewStatsSchema = z.object({
  totalSubmissions: z.number().int(),
  nativeCount: z.number().int(),
  externalCount: z.number().int(),
  acceptanceRate: z.number().min(0).max(100),
  avgResponseTimeDays: z.number().nullable(),
  pendingCount: z.number().int(),
  submissionsThisMonth: z.number().int(),
  submissionsLastMonth: z.number().int(),
});
export type WriterOverviewStats = z.infer<typeof writerOverviewStatsSchema>;

export const writerStatusBreakdownSchema = z.object({
  breakdown: z.array(
    z.object({
      status: z.string(),
      count: z.number().int(),
    }),
  ),
});
export type WriterStatusBreakdown = z.infer<typeof writerStatusBreakdownSchema>;

export const writerTimeSeriesSchema = z.object({
  granularity: z.enum(["daily", "weekly", "monthly"]),
  points: z.array(
    z.object({
      date: z.string(),
      count: z.number().int(),
      nativeCount: z.number().int(),
      externalCount: z.number().int(),
    }),
  ),
});
export type WriterTimeSeries = z.infer<typeof writerTimeSeriesSchema>;

export const writerResponseTimeSchema = z.object({
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
export type WriterResponseTime = z.infer<typeof writerResponseTimeSchema>;
