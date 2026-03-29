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

vi.mock('drizzle-orm', () => {
  const sqlTag = (_strings: TemplateStringsArray, ..._values: unknown[]) =>
    'sql-fragment';
  sqlTag.raw = (s: string) => s;
  sqlTag.join = (parts: unknown[], _sep: unknown) =>
    parts.length > 0 ? 'joined-where' : '';
  return {
    eq: vi.fn(),
    and: vi.fn(),
    sql: sqlTag,
    desc: vi.fn(),
    count: vi.fn(),
  };
});

import { editorialAnalyticsService } from './editorial-analytics.service.js';
import type { DrizzleDb } from '@colophony/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = '00000000-0000-0000-0000-000000000001';

function mockTx(rows: Record<string, unknown>[]) {
  return {
    execute: vi.fn().mockResolvedValue({ rows }),
  } as unknown as DrizzleDb;
}

function mockTxMulti(...rowSets: Record<string, unknown>[][]) {
  const execute = vi.fn();
  for (const rows of rowSets) {
    execute.mockResolvedValueOnce({ rows });
  }
  return { execute } as unknown as DrizzleDb;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('editorialAnalyticsService', () => {
  describe('getAcceptanceByGenre', () => {
    it('returns genre breakdown with rates', async () => {
      const tx = mockTx([
        { genre: 'poetry', total: 20, accepted: 5, rejected: 10, rate: 33.3 },
        { genre: 'fiction', total: 30, accepted: 15, rejected: 10, rate: 60.0 },
      ]);

      const result = await editorialAnalyticsService.getAcceptanceByGenre(
        tx,
        ORG_ID,
        {},
      );

      expect(result.genres).toHaveLength(2);
      expect(result.genres[0]).toEqual({
        genre: 'poetry',
        total: 20,
        accepted: 5,
        rejected: 10,
        rate: 33.3,
      });
    });

    it('handles empty results', async () => {
      const tx = mockTx([]);

      const result = await editorialAnalyticsService.getAcceptanceByGenre(
        tx,
        ORG_ID,
        {},
      );

      expect(result.genres).toEqual([]);
    });
  });

  describe('getAcceptanceByPeriod', () => {
    it('returns period breakdown', async () => {
      const tx = mockTx([
        {
          periodId: '11111111-1111-1111-1111-111111111111',
          periodName: 'Spring 2026',
          total: 40,
          accepted: 10,
          rejected: 20,
          rate: 33.3,
        },
      ]);

      const result = await editorialAnalyticsService.getAcceptanceByPeriod(
        tx,
        ORG_ID,
        {},
      );

      expect(result.periods).toHaveLength(1);
      expect(result.periods[0].periodName).toBe('Spring 2026');
      expect(result.periods[0].rate).toBe(33.3);
    });
  });

  describe('getResponseTimeStats', () => {
    it('returns avg, median, p90 and trend', async () => {
      const tx = mockTxMulti(
        [{ avgDays: 15.2, medianDays: 12.0, p90Days: 35.5 }],
        [
          { month: '2026-01-01', medianDays: 10.0 },
          { month: '2026-02-01', medianDays: 14.0 },
        ],
      );

      const result = await editorialAnalyticsService.getResponseTimeStats(
        tx,
        ORG_ID,
        {},
      );

      expect(result.avgDays).toBe(15.2);
      expect(result.medianDays).toBe(12.0);
      expect(result.p90Days).toBe(35.5);
      expect(result.trend).toHaveLength(2);
      expect(result.trend[0].month).toBe('2026-01');
    });

    it('handles null stats', async () => {
      const tx = mockTxMulti(
        [{ avgDays: null, medianDays: null, p90Days: null }],
        [],
      );

      const result = await editorialAnalyticsService.getResponseTimeStats(
        tx,
        ORG_ID,
        {},
      );

      expect(result.avgDays).toBeNull();
      expect(result.medianDays).toBeNull();
      expect(result.p90Days).toBeNull();
      expect(result.trend).toEqual([]);
    });
  });

  describe('getPipelineHealth', () => {
    it('returns stage counts with stuck detection', async () => {
      const tx = mockTx([
        {
          stage: 'COPYEDIT_PENDING',
          count: 5,
          avgDaysInStage: 8.3,
          stuckCount: 2,
        },
        {
          stage: 'AUTHOR_REVIEW',
          count: 3,
          avgDaysInStage: 4.1,
          stuckCount: 0,
        },
      ]);

      const result = await editorialAnalyticsService.getPipelineHealth(
        tx,
        ORG_ID,
        {},
      );

      expect(result.stages).toHaveLength(2);
      expect(result.stages[0].stuckCount).toBe(2);
      expect(result.stages[1].stuckCount).toBe(0);
    });

    it('handles empty pipeline', async () => {
      const tx = mockTx([]);

      const result = await editorialAnalyticsService.getPipelineHealth(
        tx,
        ORG_ID,
        {},
      );

      expect(result.stages).toEqual([]);
    });
  });

  describe('getGenreDistribution', () => {
    it('returns genre counts', async () => {
      const tx = mockTx([
        { genre: 'poetry', count: 45 },
        { genre: 'fiction', count: 30 },
        { genre: 'unknown', count: 5 },
      ]);

      const result = await editorialAnalyticsService.getGenreDistribution(
        tx,
        ORG_ID,
        {},
      );

      expect(result.distribution).toHaveLength(3);
      expect(result.distribution[0].genre).toBe('poetry');
      expect(result.distribution[0].count).toBe(45);
    });
  });

  describe('getContributorDiversity', () => {
    it('returns new vs returning and genre spread', async () => {
      const tx = mockTxMulti(
        [
          { periodName: 'Fall 2025', newCount: 12, returningCount: 8 },
          { periodName: 'Spring 2026', newCount: 15, returningCount: 20 },
        ],
        [
          { genre: 'poetry', count: 10 },
          { genre: 'fiction', count: 7 },
        ],
      );

      const result = await editorialAnalyticsService.getContributorDiversity(
        tx,
        ORG_ID,
        {},
      );

      expect(result.newVsReturning).toHaveLength(2);
      expect(result.newVsReturning[0].newCount).toBe(12);
      expect(result.genreSpread).toHaveLength(2);
      expect(result.genreSpread[0].genre).toBe('poetry');
    });
  });

  describe('getReaderAlignment', () => {
    it('computes consensus rate and breakdown', async () => {
      const tx = mockTxMulti(
        [
          {
            submissionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            title: 'Poem A',
            finalStatus: 'ACCEPTED',
            majorityVote: 'ACCEPT',
            voteCount: 3,
            matched: true,
          },
          {
            submissionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            title: 'Story B',
            finalStatus: 'REJECTED',
            majorityVote: 'ACCEPT',
            voteCount: 2,
            matched: false,
          },
        ],
        [{ count: 10 }],
      );

      const result = await editorialAnalyticsService.getReaderAlignment(
        tx,
        ORG_ID,
        {},
      );

      expect(result.totalDecided).toBe(10);
      expect(result.totalWithVotes).toBe(2);
      expect(result.consensusMatches).toBe(1);
      expect(result.consensusRate).toBe(50);
      expect(result.breakdown).toHaveLength(2);
      expect(result.breakdown[0].matched).toBe(true);
      expect(result.breakdown[1].matched).toBe(false);
    });

    it('handles no voted submissions', async () => {
      const tx = mockTxMulti([], [{ count: 5 }]);

      const result = await editorialAnalyticsService.getReaderAlignment(
        tx,
        ORG_ID,
        {},
      );

      expect(result.totalDecided).toBe(5);
      expect(result.totalWithVotes).toBe(0);
      expect(result.consensusMatches).toBe(0);
      expect(result.consensusRate).toBe(0);
      expect(result.breakdown).toEqual([]);
    });
  });
});
