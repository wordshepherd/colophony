import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditActions, AuditResources } from '@colophony/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
const mockSet = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();
const mockOrderBy = vi.fn();

vi.mock('@colophony/db', () => ({
  externalSubmissions: {
    id: 'id',
    userId: 'user_id',
    journalName: 'journal_name',
    status: 'status',
    updatedAt: 'updated_at',
  },
  eq: vi.fn((_col: unknown, val: unknown) => ['eq', val]),
  and: vi.fn((...args: unknown[]) => ['and', ...args]),
  sql: vi.fn(),
}));

import {
  externalSubmissionService,
  ExternalSubmissionNotFoundError,
} from './external-submission.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTx(returnData: unknown[] = []) {
  mockReturning.mockReturnValue(returnData);
  mockValues.mockReturnValue({ returning: mockReturning });
  mockInsert.mockReturnValue({ values: mockValues });
  mockSet.mockReturnValue({
    where: vi.fn().mockReturnValue({ returning: mockReturning }),
  });
  mockUpdate.mockReturnValue({ set: mockSet });
  mockDelete.mockReturnValue({
    where: vi.fn().mockReturnValue({ returning: mockReturning }),
  });
  mockLimit.mockReturnValue(returnData);
  mockOffset.mockReturnValue(returnData);
  mockOrderBy.mockReturnValue({
    limit: vi
      .fn()
      .mockReturnValue({ offset: vi.fn().mockReturnValue(returnData) }),
  });
  mockWhere.mockReturnValue({
    limit: mockLimit,
    orderBy: mockOrderBy,
  });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockSelect.mockReturnValue({ from: mockFrom });

  return {
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
    delete: mockDelete,
  } as unknown as Parameters<typeof externalSubmissionService.getById>[0];
}

function makeCtx() {
  const tx = makeTx([
    {
      id: 'es-1',
      userId: 'user-1',
      journalName: 'Test Journal',
      status: 'sent',
    },
  ]);
  return {
    tx,
    userId: 'user-1',
    audit: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('externalSubmissionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('returns paginated results for user', async () => {
      const items = [{ id: 'es-1', journalName: 'Journal A' }];
      const tx = makeTx(items);

      // Mock two parallel selects: items and count
      const mockCountResult = [{ count: 1 }];
      let callCount = 0;
      (tx.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Items query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockReturnValue(items),
                  }),
                }),
              }),
            }),
          };
        }
        // Count query
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(mockCountResult),
          }),
        };
      });

      const result = await externalSubmissionService.list(tx, 'user-1', {
        page: 1,
        limit: 20,
      });

      expect(result.items).toEqual(items);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('filters by status', async () => {
      const tx = makeTx([]);
      let callCount = 0;
      const { and } = await import('@colophony/db');

      (tx.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockReturnValue([]),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue([{ count: 0 }]),
          }),
        };
      });

      await externalSubmissionService.list(tx, 'user-1', {
        status: 'accepted',
        page: 1,
        limit: 20,
      });

      expect(and).toHaveBeenCalled();
    });

    it('filters by search term', async () => {
      const tx = makeTx([]);
      let callCount = 0;
      const { and } = await import('@colophony/db');

      (tx.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockReturnValue([]),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue([{ count: 0 }]),
          }),
        };
      });

      await externalSubmissionService.list(tx, 'user-1', {
        search: 'poetry',
        page: 1,
        limit: 20,
      });

      expect(and).toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('returns submission', async () => {
      const row = { id: 'es-1', journalName: 'Journal A' };
      const tx = makeTx([row]);

      const result = await externalSubmissionService.getById(tx, 'es-1');
      expect(result).toEqual(row);
    });

    it('returns null for nonexistent id', async () => {
      const tx = makeTx([]);

      const result = await externalSubmissionService.getById(tx, 'missing');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('inserts and returns submission', async () => {
      const row = {
        id: 'es-new',
        userId: 'user-1',
        journalName: 'New Journal',
        status: 'sent',
      };
      const tx = makeTx([row]);

      const result = await externalSubmissionService.create(tx, 'user-1', {
        journalName: 'New Journal',
      });

      expect(mockInsert).toHaveBeenCalled();
      expect(result).toEqual(row);
    });
  });

  describe('update', () => {
    it('modifies only provided fields', async () => {
      const updated = { id: 'es-1', journalName: 'Updated', status: 'sent' };
      const mockUpdateWhere = vi.fn().mockReturnValue({
        returning: vi.fn().mockReturnValue([updated]),
      });
      const mockUpdateSet = vi.fn().mockReturnValue({
        where: mockUpdateWhere,
      });
      const tx = {
        update: vi.fn().mockReturnValue({ set: mockUpdateSet }),
      } as unknown as Parameters<typeof externalSubmissionService.update>[0];

      const result = await externalSubmissionService.update(tx, 'es-1', {
        journalName: 'Updated',
      });

      expect(result).toEqual(updated);
    });
  });

  describe('delete', () => {
    it('removes submission', async () => {
      const deleted = { id: 'es-1', journalName: 'Journal A' };
      const mockDeleteWhere = vi.fn().mockReturnValue({
        returning: vi.fn().mockReturnValue([deleted]),
      });
      const tx = {
        delete: vi.fn().mockReturnValue({ where: mockDeleteWhere }),
      } as unknown as Parameters<typeof externalSubmissionService.delete>[0];

      const result = await externalSubmissionService.delete(tx, 'es-1');
      expect(result).toEqual(deleted);
    });
  });

  describe('createWithAudit', () => {
    it('calls audit', async () => {
      const ctx = makeCtx();

      await externalSubmissionService.createWithAudit(ctx, {
        journalName: 'Test Journal',
      });

      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditActions.EXTERNAL_SUBMISSION_CREATED,
          resource: AuditResources.EXTERNAL_SUBMISSION,
        }),
      );
    });
  });

  describe('deleteWithAudit', () => {
    it('throws for nonexistent id', async () => {
      const ctx = makeCtx();
      // Make getById return null
      (ctx.tx.select as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue([]),
          }),
        }),
      });

      await expect(
        externalSubmissionService.deleteWithAudit(ctx, 'missing'),
      ).rejects.toThrow(ExternalSubmissionNotFoundError);
    });
  });
});
