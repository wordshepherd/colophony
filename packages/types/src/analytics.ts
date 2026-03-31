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
  maxPerBracket: z.number().int().min(1).max(100).default(25),
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

// ---------------------------------------------------------------------------
// Editorial analytics — filter
// ---------------------------------------------------------------------------

export const editorialAnalyticsFilterSchema = analyticsFilterSchema.extend({
  genre: z.string().optional(),
});
export type EditorialAnalyticsFilter = z.infer<
  typeof editorialAnalyticsFilterSchema
>;

// ---------------------------------------------------------------------------
// Editorial analytics — response schemas
// ---------------------------------------------------------------------------

export const acceptanceByGenreSchema = z.object({
  genres: z.array(
    z.object({
      genre: z.string(),
      total: z.number().int(),
      accepted: z.number().int(),
      rejected: z.number().int(),
      rate: z.number().min(0).max(100),
    }),
  ),
});
export type AcceptanceByGenre = z.infer<typeof acceptanceByGenreSchema>;

export const acceptanceByPeriodSchema = z.object({
  periods: z.array(
    z.object({
      periodId: z.string().uuid(),
      periodName: z.string(),
      total: z.number().int(),
      accepted: z.number().int(),
      rejected: z.number().int(),
      rate: z.number().min(0).max(100),
    }),
  ),
});
export type AcceptanceByPeriod = z.infer<typeof acceptanceByPeriodSchema>;

export const responseTimeStatsSchema = z.object({
  avgDays: z.number().nullable(),
  medianDays: z.number().nullable(),
  p90Days: z.number().nullable(),
  trend: z.array(
    z.object({
      month: z.string(),
      medianDays: z.number().nullable(),
    }),
  ),
});
export type ResponseTimeStats = z.infer<typeof responseTimeStatsSchema>;

// ---------------------------------------------------------------------------
// Public response time transparency
// ---------------------------------------------------------------------------

export const publicResponseTimeStatsSchema = z.object({
  medianDays: z.number().nullable(),
  buckets: z.array(
    z.object({
      label: z.string(),
      count: z.number().int(),
      percentage: z.number().min(0).max(100),
      minDays: z.number(),
      maxDays: z.number().nullable(),
    }),
  ),
  trend: z.array(
    z.object({
      month: z.string(),
      medianDays: z.number().nullable(),
    }),
  ),
  sampleSize: z.number().int(),
  source: z.enum(["local", "federated"]),
  updatedAt: z.string().datetime(),
});
export type PublicResponseTimeStats = z.infer<
  typeof publicResponseTimeStatsSchema
>;

export const publicResponseTimeResponseSchema = z.object({
  responseTimeStats: publicResponseTimeStatsSchema.nullable(),
});
export type PublicResponseTimeResponse = z.infer<
  typeof publicResponseTimeResponseSchema
>;

export const pipelineHealthSchema = z.object({
  stages: z.array(
    z.object({
      stage: z.string(),
      count: z.number().int(),
      avgDaysInStage: z.number().nullable(),
      stuckCount: z.number().int(),
    }),
  ),
});
export type PipelineHealth = z.infer<typeof pipelineHealthSchema>;

export const genreDistributionSchema = z.object({
  distribution: z.array(
    z.object({
      genre: z.string(),
      count: z.number().int(),
    }),
  ),
});
export type GenreDistribution = z.infer<typeof genreDistributionSchema>;

export const contributorDiversitySchema = z.object({
  newVsReturning: z.array(
    z.object({
      periodName: z.string(),
      newCount: z.number().int(),
      returningCount: z.number().int(),
    }),
  ),
  genreSpread: z.array(
    z.object({
      genre: z.string(),
      count: z.number().int(),
    }),
  ),
});
export type ContributorDiversity = z.infer<typeof contributorDiversitySchema>;

export const readerAlignmentSchema = z.object({
  totalDecided: z.number().int(),
  totalWithVotes: z.number().int(),
  consensusMatches: z.number().int(),
  consensusRate: z.number().min(0).max(100),
  breakdown: z.array(
    z.object({
      submissionId: z.string().uuid(),
      title: z.string().nullable(),
      finalStatus: z.string(),
      majorityVote: z.string(),
      matched: z.boolean(),
      voteCount: z.number().int(),
    }),
  ),
});
export type ReaderAlignment = z.infer<typeof readerAlignmentSchema>;
