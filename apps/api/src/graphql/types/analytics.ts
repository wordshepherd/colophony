import type {
  SubmissionOverviewStats,
  SubmissionStatusBreakdown,
  SubmissionFunnel,
  SubmissionTimeSeries,
  ResponseTimeDistribution,
  AgingSubmissions,
} from '@colophony/types';
import { builder } from '../builder.js';

// ---------------------------------------------------------------------------
// Nested object types
// ---------------------------------------------------------------------------

const StatusBreakdownItem = builder
  .objectRef<{ status: string; count: number }>('StatusBreakdownItem')
  .implement({
    fields: (t) => ({
      status: t.exposeString('status'),
      count: t.exposeInt('count'),
    }),
  });

const FunnelStage = builder
  .objectRef<{ stage: string; count: number }>('FunnelStage')
  .implement({
    fields: (t) => ({
      stage: t.exposeString('stage'),
      count: t.exposeInt('count'),
    }),
  });

const TimeSeriesPoint = builder
  .objectRef<{ date: string; count: number }>('TimeSeriesPoint')
  .implement({
    fields: (t) => ({
      date: t.exposeString('date'),
      count: t.exposeInt('count'),
    }),
  });

const ResponseTimeBucket = builder
  .objectRef<{
    label: string;
    count: number;
    minDays: number;
    maxDays: number;
  }>('ResponseTimeBucket')
  .implement({
    fields: (t) => ({
      label: t.exposeString('label'),
      count: t.exposeInt('count'),
      minDays: t.exposeFloat('minDays'),
      maxDays: t.exposeFloat('maxDays'),
    }),
  });

const AgingSubmissionItem = builder
  .objectRef<{
    id: string;
    title: string | null;
    status: string;
    submittedAt: Date | null;
    daysPending: number;
  }>('AgingSubmissionItem')
  .implement({
    fields: (t) => ({
      id: t.exposeString('id'),
      title: t.exposeString('title', { nullable: true }),
      status: t.exposeString('status'),
      submittedAt: t.expose('submittedAt', {
        type: 'DateTime',
        nullable: true,
      }),
      daysPending: t.exposeInt('daysPending'),
    }),
  });

const AgingBracket = builder
  .objectRef<{
    label: string;
    count: number;
    submissions: Array<{
      id: string;
      title: string | null;
      status: string;
      submittedAt: Date | null;
      daysPending: number;
    }>;
  }>('AgingBracket')
  .implement({
    fields: (t) => ({
      label: t.exposeString('label'),
      count: t.exposeInt('count'),
      submissions: t.field({
        type: [AgingSubmissionItem],
        resolve: (r) => r.submissions,
      }),
    }),
  });

// ---------------------------------------------------------------------------
// Top-level analytics types
// ---------------------------------------------------------------------------

export const SubmissionOverviewStatsType = builder
  .objectRef<SubmissionOverviewStats>('SubmissionOverviewStats')
  .implement({
    description: 'Summary statistics for submissions.',
    fields: (t) => ({
      totalSubmissions: t.exposeInt('totalSubmissions'),
      acceptanceRate: t.exposeFloat('acceptanceRate'),
      avgResponseTimeDays: t.exposeFloat('avgResponseTimeDays', {
        nullable: true,
      }),
      pendingCount: t.exposeInt('pendingCount'),
      submissionsThisMonth: t.exposeInt('submissionsThisMonth'),
      submissionsLastMonth: t.exposeInt('submissionsLastMonth'),
    }),
  });

export const SubmissionStatusBreakdownType = builder
  .objectRef<SubmissionStatusBreakdown>('SubmissionStatusBreakdown')
  .implement({
    description: 'Submission counts grouped by status.',
    fields: (t) => ({
      breakdown: t.field({
        type: [StatusBreakdownItem],
        resolve: (r) => r.breakdown,
      }),
    }),
  });

export const SubmissionFunnelType = builder
  .objectRef<SubmissionFunnel>('SubmissionFunnel')
  .implement({
    description: 'Submission workflow funnel — count at each stage.',
    fields: (t) => ({
      stages: t.field({ type: [FunnelStage], resolve: (r) => r.stages }),
    }),
  });

export const SubmissionTimeSeriesType = builder
  .objectRef<SubmissionTimeSeries>('SubmissionTimeSeries')
  .implement({
    description: 'Submission counts over time.',
    fields: (t) => ({
      granularity: t.exposeString('granularity'),
      points: t.field({
        type: [TimeSeriesPoint],
        resolve: (r) => r.points,
      }),
    }),
  });

export const ResponseTimeDistributionType = builder
  .objectRef<ResponseTimeDistribution>('ResponseTimeDistribution')
  .implement({
    description: 'Distribution of response times with histogram buckets.',
    fields: (t) => ({
      buckets: t.field({
        type: [ResponseTimeBucket],
        resolve: (r) => r.buckets,
      }),
      medianDays: t.exposeFloat('medianDays', { nullable: true }),
    }),
  });

export const AgingSubmissionsType = builder
  .objectRef<AgingSubmissions>('AgingSubmissions')
  .implement({
    description: 'Non-terminal submissions grouped by age bracket.',
    fields: (t) => ({
      brackets: t.field({
        type: [AgingBracket],
        resolve: (r) => r.brackets,
      }),
      totalAging: t.exposeInt('totalAging'),
    }),
  });
