import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@colophony/db', () => ({
  sql: Object.assign((...args: unknown[]) => ({ __sql: true, args }), {
    raw: (s: string) => ({ __raw: true, value: s }),
    join: (...args: unknown[]) => ({ __join: true, args }),
  }),
}));

vi.mock('./portfolio.service.js', () => ({
  NATIVE_TO_CSR: {
    DRAFT: 'draft',
    SUBMITTED: 'sent',
    UNDER_REVIEW: 'in_review',
    HOLD: 'hold',
    ACCEPTED: 'accepted',
    REJECTED: 'rejected',
    WITHDRAWN: 'withdrawn',
    REVISE_AND_RESUBMIT: 'revise',
  },
}));

import { writerAnalyticsService } from './writer-analytics.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = '00000000-0000-0000-0000-000000000001';

function makeTx(execResults: Array<{ rows: unknown[] }>) {
  let callIdx = 0;
  return {
    execute: vi.fn().mockImplementation(() => {
      const result = execResults[callIdx] ?? { rows: [] };
      callIdx++;
      return Promise.resolve(result);
    }),
  } as unknown as Parameters<typeof writerAnalyticsService.getOverview>[0];
}

// ---------------------------------------------------------------------------
// Tests — getOverview
// ---------------------------------------------------------------------------

describe('writerAnalyticsService', () => {
  describe('getOverview', () => {
    it('returns zeros for user with no submissions', async () => {
      const tx = makeTx([
        // native counts
        {
          rows: [
            {
              total: 0,
              accepted: 0,
              rejected: 0,
              pending: 0,
              this_month: 0,
              last_month: 0,
            },
          ],
        },
        // external counts
        {
          rows: [
            {
              total: 0,
              accepted: 0,
              rejected: 0,
              pending: 0,
              this_month: 0,
              last_month: 0,
            },
          ],
        },
        // native avg response
        { rows: [{ avg_days: null, cnt: 0 }] },
        // external avg response
        { rows: [{ avg_days: null, cnt: 0 }] },
      ]);

      const result = await writerAnalyticsService.getOverview(tx, USER_ID, {});

      expect(result.totalSubmissions).toBe(0);
      expect(result.nativeCount).toBe(0);
      expect(result.externalCount).toBe(0);
      expect(result.acceptanceRate).toBe(0);
      expect(result.avgResponseTimeDays).toBeNull();
      expect(result.pendingCount).toBe(0);
    });

    it('merges native and external counts', async () => {
      const tx = makeTx([
        {
          rows: [
            {
              total: 5,
              accepted: 2,
              rejected: 1,
              pending: 2,
              this_month: 1,
              last_month: 2,
            },
          ],
        },
        {
          rows: [
            {
              total: 3,
              accepted: 1,
              rejected: 1,
              pending: 1,
              this_month: 0,
              last_month: 1,
            },
          ],
        },
        { rows: [{ avg_days: 20, cnt: 3 }] },
        { rows: [{ avg_days: 10, cnt: 2 }] },
      ]);

      const result = await writerAnalyticsService.getOverview(tx, USER_ID, {});

      expect(result.totalSubmissions).toBe(8);
      expect(result.nativeCount).toBe(5);
      expect(result.externalCount).toBe(3);
      expect(result.pendingCount).toBe(3);
      // 3 accepted / 5 decided = 60%
      expect(result.acceptanceRate).toBe(60);
      expect(result.submissionsThisMonth).toBe(1);
      expect(result.submissionsLastMonth).toBe(3);
    });

    it('computes weighted avg response time', async () => {
      const tx = makeTx([
        {
          rows: [
            {
              total: 2,
              accepted: 1,
              rejected: 1,
              pending: 0,
              this_month: 0,
              last_month: 0,
            },
          ],
        },
        {
          rows: [
            {
              total: 1,
              accepted: 1,
              rejected: 0,
              pending: 0,
              this_month: 0,
              last_month: 0,
            },
          ],
        },
        // native: 30 days avg, 2 entries
        { rows: [{ avg_days: 30, cnt: 2 }] },
        // external: 10 days avg, 1 entry
        { rows: [{ avg_days: 10, cnt: 1 }] },
      ]);

      const result = await writerAnalyticsService.getOverview(tx, USER_ID, {});

      // weighted: (30*2 + 10*1) / 3 = 70/3 ≈ 23.3
      expect(result.avgResponseTimeDays).toBe(23.3);
    });

    it('respects date filter', async () => {
      const tx = makeTx([
        {
          rows: [
            {
              total: 1,
              accepted: 1,
              rejected: 0,
              pending: 0,
              this_month: 0,
              last_month: 0,
            },
          ],
        },
        {
          rows: [
            {
              total: 0,
              accepted: 0,
              rejected: 0,
              pending: 0,
              this_month: 0,
              last_month: 0,
            },
          ],
        },
        { rows: [{ avg_days: null, cnt: 0 }] },
        { rows: [{ avg_days: null, cnt: 0 }] },
      ]);

      const result = await writerAnalyticsService.getOverview(tx, USER_ID, {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
      });

      expect(result.totalSubmissions).toBe(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(tx.execute).toHaveBeenCalledTimes(4);
    });
  });

  // ---------------------------------------------------------------------------
  // getStatusBreakdown
  // ---------------------------------------------------------------------------

  describe('getStatusBreakdown', () => {
    it('harmonizes native SUBMITTED + external sent into one entry', async () => {
      const tx = makeTx([
        // native
        { rows: [{ status: 'SUBMITTED', count: 3 }] },
        // external
        { rows: [{ status: 'sent', count: 2 }] },
      ]);

      const result = await writerAnalyticsService.getStatusBreakdown(
        tx,
        USER_ID,
        {},
      );

      const sentEntry = result.breakdown.find((b) => b.status === 'sent');
      expect(sentEntry).toBeDefined();
      expect(sentEntry!.count).toBe(5);
    });
  });

  // ---------------------------------------------------------------------------
  // getTimeSeries
  // ---------------------------------------------------------------------------

  describe('getTimeSeries', () => {
    it('groups by month with source breakdown', async () => {
      const tx = makeTx([
        // native
        {
          rows: [
            { date: '2025-06-01', count: 3 },
            { date: '2025-07-01', count: 1 },
          ],
        },
        // external
        {
          rows: [
            { date: '2025-06-01', count: 2 },
            { date: '2025-08-01', count: 4 },
          ],
        },
      ]);

      const result = await writerAnalyticsService.getTimeSeries(tx, USER_ID, {
        granularity: 'monthly',
      });

      expect(result.granularity).toBe('monthly');
      expect(result.points).toHaveLength(3);

      const jun = result.points.find((p) => p.date === '2025-06-01');
      expect(jun).toBeDefined();
      expect(jun!.nativeCount).toBe(3);
      expect(jun!.externalCount).toBe(2);
      expect(jun!.count).toBe(5);

      const aug = result.points.find((p) => p.date === '2025-08-01');
      expect(aug).toBeDefined();
      expect(aug!.nativeCount).toBe(0);
      expect(aug!.externalCount).toBe(4);
    });
  });

  // ---------------------------------------------------------------------------
  // getResponseTime
  // ---------------------------------------------------------------------------

  describe('getResponseTime', () => {
    it('buckets native and external together', async () => {
      const tx = makeTx([
        // native days
        { rows: [{ days: 5 }, { days: 20 }, { days: 45 }] },
        // external days
        { rows: [{ days: 10 }, { days: 90 }] },
      ]);

      const result = await writerAnalyticsService.getResponseTime(
        tx,
        USER_ID,
        {},
      );

      expect(result.buckets).toHaveLength(5);
      const counts = result.buckets.map((b) => b.count);
      // [<7d, 7-14d, 14-28d, 28-60d, 60+d] — one entry in each
      expect(counts).toEqual([1, 1, 1, 1, 1]);

      // median of [5, 10, 20, 45, 90] = 20
      expect(result.medianDays).toBe(20);
    });

    it('excludes submissions without response dates', async () => {
      const tx = makeTx([
        // native — empty (no decisions)
        { rows: [] },
        // external — empty (no responded_at)
        { rows: [] },
      ]);

      const result = await writerAnalyticsService.getResponseTime(
        tx,
        USER_ID,
        {},
      );

      expect(result.medianDays).toBeNull();
      expect(result.buckets.every((b) => b.count === 0)).toBe(true);
    });
  });
});
