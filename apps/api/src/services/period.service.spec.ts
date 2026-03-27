import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Drizzle mocks
// ---------------------------------------------------------------------------

vi.mock('@colophony/db', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  db: { query: {} },
  submissionPeriods: {},
  submissions: {},
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
  desc: vi.fn(),
  ilike: vi.fn(),
  count: vi.fn(),
}));

import {
  periodService,
  PeriodNotFoundError,
  PeriodHasSubmissionsError,
} from './period.service.js';
import type { DrizzleDb } from '@colophony/db';
import type { ServiceContext } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePeriodRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'period-1',
    organizationId: 'org-1',
    name: 'Spring 2026',
    description: null,
    opensAt: new Date('2026-03-01T00:00:00Z'),
    closesAt: new Date('2026-06-01T00:00:00Z'),
    fee: '5.00',
    maxSubmissions: 100,
    formDefinitionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeServiceContext(
  rolesOverride: string[] = ['EDITOR'],
): ServiceContext {
  return {
    tx: {} as DrizzleDb,
    actor: {
      userId: 'user-1',
      orgId: 'org-1',
      roles: rolesOverride as ('EDITOR' | 'ADMIN' | 'READER')[],
    },
    audit: vi.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('periodService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------

  describe('list', () => {
    it('returns paginated results with correct shape', async () => {
      const row = makePeriodRow();
      const mockTx = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([row]),
      } as unknown as DrizzleDb;

      // Override to return both items and count
      const selectFn = vi.fn();
      // First call = items query, second call = count query
      let callCount = 0;
      selectFn.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([row]),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        };
      });
      (mockTx as unknown as { select: typeof selectFn }).select = selectFn;

      const result = await periodService.list(mockTx, {
        page: 1,
        limit: 20,
      });

      expect(result).toMatchObject({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
      expect(result.items).toHaveLength(1);
      // fee should be coerced to number
      expect(result.items[0].fee).toBe(5);
    });
  });

  // -------------------------------------------------------------------------
  // getById
  // -------------------------------------------------------------------------

  describe('getById', () => {
    it('returns period when found', async () => {
      const row = makePeriodRow();
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([row]),
            }),
          }),
        }),
      } as unknown as DrizzleDb;

      const result = await periodService.getById(mockTx, 'period-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('period-1');
      expect(result!.fee).toBe(5);
    });

    it('returns null when not found', async () => {
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as unknown as DrizzleDb;

      const result = await periodService.getById(mockTx, 'nonexistent');
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // createWithAudit
  // -------------------------------------------------------------------------

  describe('createWithAudit', () => {
    it('creates period and audits PERIOD_CREATED', async () => {
      const row = makePeriodRow();
      const ctx = makeServiceContext();
      vi.spyOn(periodService, 'create').mockResolvedValueOnce(row as never);

      const result = await periodService.createWithAudit(ctx, {
        name: 'Spring 2026',
        opensAt: new Date('2026-03-01'),
        closesAt: new Date('2026-06-01'),
        fee: 5,
      });

      expect(result.id).toBe('period-1');
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PERIOD_CREATED',
          resource: 'period',
          resourceId: 'period-1',
        }),
      );
    });

    it('throws ForbiddenError for MEMBER role', async () => {
      const ctx = makeServiceContext(['READER']);

      await expect(
        periodService.createWithAudit(ctx, {
          name: 'Test',
          opensAt: new Date(),
          closesAt: new Date(),
        }),
      ).rejects.toThrow('Editor or admin role required');
    });
  });

  // -------------------------------------------------------------------------
  // updateWithAudit
  // -------------------------------------------------------------------------

  describe('updateWithAudit', () => {
    it('updates and audits PERIOD_UPDATED', async () => {
      const row = makePeriodRow({ name: 'Updated' });
      const ctx = makeServiceContext();
      vi.spyOn(periodService, 'update').mockResolvedValueOnce(row as never);

      const result = await periodService.updateWithAudit(ctx, 'period-1', {
        name: 'Updated',
      });

      expect(result.name).toBe('Updated');
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PERIOD_UPDATED',
          resource: 'period',
        }),
      );
    });

    it('throws PeriodNotFoundError when missing', async () => {
      const ctx = makeServiceContext();
      vi.spyOn(periodService, 'update').mockResolvedValueOnce(null as never);

      await expect(
        periodService.updateWithAudit(ctx, 'nonexistent', { name: 'X' }),
      ).rejects.toThrow(PeriodNotFoundError);
    });
  });

  // -------------------------------------------------------------------------
  // deleteWithAudit
  // -------------------------------------------------------------------------

  describe('deleteWithAudit', () => {
    it('deletes and audits PERIOD_DELETED when no submissions', async () => {
      const row = makePeriodRow();
      const ctx = makeServiceContext();
      vi.spyOn(periodService, 'delete').mockResolvedValueOnce(row as never);

      const result = await periodService.deleteWithAudit(ctx, 'period-1');

      expect(result).toEqual({ success: true });
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PERIOD_DELETED',
          resource: 'period',
          resourceId: 'period-1',
        }),
      );
    });

    it('throws PeriodHasSubmissionsError when submissions exist', async () => {
      const ctx = makeServiceContext();
      vi.spyOn(periodService, 'delete').mockRejectedValueOnce(
        new PeriodHasSubmissionsError(),
      );

      await expect(
        periodService.deleteWithAudit(ctx, 'period-1'),
      ).rejects.toThrow(PeriodHasSubmissionsError);
    });

    it('throws PeriodNotFoundError when period missing', async () => {
      const ctx = makeServiceContext();
      vi.spyOn(periodService, 'delete').mockResolvedValueOnce(null as never);

      await expect(
        periodService.deleteWithAudit(ctx, 'nonexistent'),
      ).rejects.toThrow(PeriodNotFoundError);
    });
  });
});
