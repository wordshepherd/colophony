import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Drizzle mocks
// ---------------------------------------------------------------------------

vi.mock('@colophony/db', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  db: { query: {} },
  submissions: {},
  submissionHistory: {},
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  sql: { raw: (s: string) => s },
  desc: vi.fn(),
  count: vi.fn(),
}));

import { submissionAnalyticsService } from './submission-analytics.service.js';
import type { DrizzleDb } from '@colophony/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockTx(rows: Record<string, unknown>[]) {
  return {
    execute: vi.fn().mockResolvedValue({ rows }),
  } as unknown as DrizzleDb;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('submissionAnalyticsService', () => {
  describe('getOverviewStats', () => {
    it('returns correct stats', async () => {
      const tx = mockTx([
        {
          totalSubmissions: 50,
          pendingCount: 10,
          acceptanceRate: 40.0,
          avgResponseTimeDays: 12.5,
          submissionsThisMonth: 8,
          submissionsLastMonth: 15,
        },
      ]);

      const result = await submissionAnalyticsService.getOverviewStats(tx, {});

      expect(result).toEqual({
        totalSubmissions: 50,
        pendingCount: 10,
        acceptanceRate: 40.0,
        avgResponseTimeDays: 12.5,
        submissionsThisMonth: 8,
        submissionsLastMonth: 15,
      });
    });

    it('handles zero submissions', async () => {
      const tx = mockTx([
        {
          totalSubmissions: 0,
          pendingCount: 0,
          acceptanceRate: 0,
          avgResponseTimeDays: null,
          submissionsThisMonth: 0,
          submissionsLastMonth: 0,
        },
      ]);

      const result = await submissionAnalyticsService.getOverviewStats(tx, {});

      expect(result.acceptanceRate).toBe(0);
      expect(result.avgResponseTimeDays).toBeNull();
    });

    it('applies date range filter', async () => {
      const tx = mockTx([
        {
          totalSubmissions: 5,
          pendingCount: 2,
          acceptanceRate: 50,
          avgResponseTimeDays: 10,
          submissionsThisMonth: 3,
          submissionsLastMonth: 0,
        },
      ]);

      const result = await submissionAnalyticsService.getOverviewStats(tx, {
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
      });

      expect(result.totalSubmissions).toBe(5);
      // Verify the execute was called (SQL includes date conditions)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(tx.execute).toHaveBeenCalledTimes(1);
    });

    it('applies period filter', async () => {
      const tx = mockTx([
        {
          totalSubmissions: 3,
          pendingCount: 1,
          acceptanceRate: 66.7,
          avgResponseTimeDays: 7,
          submissionsThisMonth: 1,
          submissionsLastMonth: 2,
        },
      ]);

      const result = await submissionAnalyticsService.getOverviewStats(tx, {
        submissionPeriodId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.totalSubmissions).toBe(3);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(tx.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStatusBreakdown', () => {
    it('groups by status', async () => {
      const tx = mockTx([
        { status: 'SUBMITTED', count: 10 },
        { status: 'UNDER_REVIEW', count: 5 },
        { status: 'ACCEPTED', count: 3 },
      ]);

      const result = await submissionAnalyticsService.getStatusBreakdown(
        tx,
        {},
      );

      expect(result.breakdown).toHaveLength(3);
      expect(result.breakdown[0]).toEqual({ status: 'SUBMITTED', count: 10 });
    });
  });

  describe('getFunnel', () => {
    it('orders stages correctly', async () => {
      // Return unordered data
      const tx = mockTx([
        { stage: 'ACCEPTED', count: 2 },
        { stage: 'SUBMITTED', count: 20 },
        { stage: 'UNDER_REVIEW', count: 15 },
        { stage: 'REJECTED', count: 3 },
      ]);

      const result = await submissionAnalyticsService.getFunnel(tx, {});

      // Should be in funnel order regardless of DB order
      expect(result.stages[0].stage).toBe('SUBMITTED');
      expect(result.stages[1].stage).toBe('UNDER_REVIEW');
      expect(result.stages[4].stage).toBe('ACCEPTED');
      expect(result.stages[5].stage).toBe('REJECTED');
      // Missing stages should have count 0
      expect(result.stages[2]).toEqual({ stage: 'HOLD', count: 0 });
    });
  });

  describe('getTimeSeries', () => {
    it('returns daily points', async () => {
      const tx = mockTx([
        { date: '2026-01-01', count: 5 },
        { date: '2026-01-02', count: 3 },
        { date: '2026-01-03', count: 8 },
      ]);

      const result = await submissionAnalyticsService.getTimeSeries(tx, {
        granularity: 'daily',
      });

      expect(result.granularity).toBe('daily');
      expect(result.points).toHaveLength(3);
      expect(result.points[0]).toEqual({ date: '2026-01-01', count: 5 });
    });
  });

  describe('getResponseTimeDistribution', () => {
    it('buckets correctly', async () => {
      const tx = mockTx([
        {
          bucket_0_7: 10,
          bucket_7_14: 8,
          bucket_14_28: 5,
          bucket_28_60: 2,
          bucket_60_plus: 1,
          medianDays: 9.5,
        },
      ]);

      const result =
        await submissionAnalyticsService.getResponseTimeDistribution(tx, {});

      expect(result.buckets).toHaveLength(5);
      expect(result.buckets[0]).toEqual({
        label: '< 7 days',
        count: 10,
        minDays: 0,
        maxDays: 7,
      });
      expect(result.medianDays).toBe(9.5);
    });
  });

  describe('getAgingSubmissions', () => {
    it('groups into brackets', async () => {
      const tx = mockTx([
        {
          id: 'sub-1',
          title: 'Old Story',
          status: 'SUBMITTED',
          submittedAt: '2026-01-01T00:00:00Z',
          daysPending: 20,
        },
        {
          id: 'sub-2',
          title: 'Very Old Story',
          status: 'UNDER_REVIEW',
          submittedAt: '2025-12-01T00:00:00Z',
          daysPending: 60,
        },
        {
          id: 'sub-3',
          title: 'Fresh',
          status: 'SUBMITTED',
          submittedAt: '2026-02-20T00:00:00Z',
          daysPending: 5,
        },
      ]);

      const result = await submissionAnalyticsService.getAgingSubmissions(tx, {
        thresholdDays: 14,
      });

      // sub-3 (5 days) is below threshold, should not be counted
      expect(result.totalAging).toBe(2);
      // sub-1 (20 days) in 14-28 bracket, sub-2 (60 days) in 56+ bracket
      expect(result.brackets[0].count).toBe(1); // 14-28
      expect(result.brackets[2].count).toBe(1); // 56+
    });

    it('respects threshold', async () => {
      const tx = mockTx([
        {
          id: 'sub-1',
          title: 'Story',
          status: 'SUBMITTED',
          submittedAt: '2026-02-20T00:00:00Z',
          daysPending: 10,
        },
      ]);

      const result = await submissionAnalyticsService.getAgingSubmissions(tx, {
        thresholdDays: 7,
      });

      // 10 days >= 7 threshold, should be in first bracket (7-14)
      expect(result.totalAging).toBe(1);
      expect(result.brackets[0].label).toBe('7-14 days');
      expect(result.brackets[0].count).toBe(1);
    });
  });
});
