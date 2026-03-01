import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@colophony/db', () => ({
  manuscripts: { ownerId: 'owner_id' },
  externalSubmissions: {
    userId: 'user_id',
    status: 'status',
    id: 'id',
    journalName: 'journal_name',
    updatedAt: 'updated_at',
  },
  correspondence: {
    userId: 'user_id',
    id: 'id',
    subject: 'subject',
    sentAt: 'sent_at',
  },
  eq: vi.fn((_col: unknown, val: unknown) => ['eq', val]),
  and: vi.fn(),
  sql: vi.fn(),
}));

import { workspaceStatsService } from './workspace-stats.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTx(opts: {
  manuscriptCount: number;
  statusCounts: Array<{ status: string; count: number }>;
  recentSubs: Array<{ id: string; label: string; timestamp: Date }>;
  recentCorr: Array<{ id: string; label: string | null; timestamp: Date }>;
}) {
  let callCount = 0;
  const tx = {
    select: vi.fn().mockImplementation(() => {
      callCount++;
      const chain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            if (callCount === 1) {
              // Manuscript count
              return [{ count: opts.manuscriptCount }];
            }
            if (callCount === 2) {
              // Status counts (groupBy)
              return {
                groupBy: vi.fn().mockReturnValue(opts.statusCounts),
              };
            }
            if (callCount === 3) {
              // Recent external subs
              return {
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue(opts.recentSubs),
                }),
              };
            }
            // Recent correspondence
            return {
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue(opts.recentCorr),
              }),
            };
          }),
        }),
      };
      return chain;
    }),
  };
  return tx as unknown as Parameters<typeof workspaceStatsService.getStats>[0];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('workspaceStatsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStats', () => {
    it('returns correct counts', async () => {
      const tx = makeTx({
        manuscriptCount: 5,
        statusCounts: [
          { status: 'sent', count: 3 },
          { status: 'accepted', count: 2 },
          { status: 'rejected', count: 1 },
        ],
        recentSubs: [],
        recentCorr: [],
      });

      const result = await workspaceStatsService.getStats(tx, 'user-1');

      expect(result.manuscriptCount).toBe(5);
      expect(result.pendingSubmissions).toBe(3);
      expect(result.acceptedSubmissions).toBe(2);
      expect(result.rejectedSubmissions).toBe(1);
    });

    it('computes acceptance rate correctly', async () => {
      const tx = makeTx({
        manuscriptCount: 0,
        statusCounts: [
          { status: 'accepted', count: 3 },
          { status: 'rejected', count: 7 },
        ],
        recentSubs: [],
        recentCorr: [],
      });

      const result = await workspaceStatsService.getStats(tx, 'user-1');

      expect(result.acceptanceRate).toBeCloseTo(0.3);
    });

    it('returns null acceptance rate with zero decided', async () => {
      const tx = makeTx({
        manuscriptCount: 0,
        statusCounts: [{ status: 'sent', count: 5 }],
        recentSubs: [],
        recentCorr: [],
      });

      const result = await workspaceStatsService.getStats(tx, 'user-1');

      expect(result.acceptanceRate).toBeNull();
    });

    it('returns recent activity sorted by timestamp', async () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 60000);
      const tx = makeTx({
        manuscriptCount: 0,
        statusCounts: [],
        recentSubs: [{ id: 'es-1', label: 'Journal A', timestamp: earlier }],
        recentCorr: [{ id: 'corr-1', label: 'Re: Poem', timestamp: now }],
      });

      const result = await workspaceStatsService.getStats(tx, 'user-1');

      expect(result.recentActivity).toHaveLength(2);
      expect(result.recentActivity[0].type).toBe('correspondence');
      expect(result.recentActivity[1].type).toBe('external_submission');
    });
  });
});
