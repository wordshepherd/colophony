import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock('@colophony/db', () => ({
  writerProfiles: {
    id: 'id',
    userId: 'user_id',
    platform: 'platform',
  },
  eq: vi.fn((_col: unknown, val: unknown) => ['eq', val]),
  and: vi.fn((...args: unknown[]) => ['and', ...args]),
}));

import {
  writerProfileService,
  WriterProfileDuplicateError,
} from './writer-profile.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTx(returnData: unknown[] = []) {
  const mockReturning = vi.fn().mockReturnValue(returnData);
  const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
  mockInsert.mockReturnValue({ values: mockValues });

  const mockUpdateWhere = vi.fn().mockReturnValue({
    returning: mockReturning,
  });
  const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
  mockUpdate.mockReturnValue({ set: mockSet });

  const mockDeleteWhere = vi.fn().mockReturnValue({
    returning: mockReturning,
  });
  mockDelete.mockReturnValue({ where: mockDeleteWhere });

  const mockLimit = vi.fn().mockReturnValue(returnData);
  const mockWhere = vi.fn().mockReturnValue({
    limit: mockLimit,
  });
  // For list: no limit, just where returns array
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  mockSelect.mockReturnValue({ from: mockFrom });

  return {
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
    delete: mockDelete,
  } as unknown as Parameters<typeof writerProfileService.getById>[0];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('writerProfileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('returns all profiles for user', async () => {
      const profiles = [
        { id: 'wp-1', platform: 'Submittable' },
        { id: 'wp-2', platform: 'Duotrope' },
      ];
      const tx = makeTx(profiles);
      // Override for list: select().from().where() returns array directly
      (tx.select as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(profiles),
        }),
      });

      const result = await writerProfileService.list(tx, 'user-1');
      expect(result).toEqual(profiles);
    });
  });

  describe('create', () => {
    it('inserts profile', async () => {
      const profile = { id: 'wp-new', platform: 'Submittable' };
      const tx = makeTx([profile]);

      const result = await writerProfileService.create(tx, 'user-1', {
        platform: 'Submittable',
      });

      expect(mockInsert).toHaveBeenCalled();
      expect(result).toEqual(profile);
    });

    it('throws duplicate error for same platform', async () => {
      const tx = makeTx([]);
      // Make insert throw PG 23505
      (tx.insert as ReturnType<typeof vi.fn>).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(() => {
            const err = new Error('unique violation') as Error & {
              code: string;
            };
            err.code = '23505';
            throw err;
          }),
        }),
      });

      await expect(
        writerProfileService.create(tx, 'user-1', {
          platform: 'Submittable',
        }),
      ).rejects.toThrow(WriterProfileDuplicateError);
    });
  });

  describe('update', () => {
    it('modifies profile', async () => {
      const updated = { id: 'wp-1', platform: 'Duotrope' };
      const tx = makeTx([updated]);

      const result = await writerProfileService.update(tx, 'wp-1', {
        platform: 'Duotrope',
      });

      expect(result).toEqual(updated);
    });
  });

  describe('delete', () => {
    it('removes profile', async () => {
      const deleted = { id: 'wp-1', platform: 'Submittable' };
      const tx = makeTx([deleted]);

      const result = await writerProfileService.delete(tx, 'wp-1');
      expect(result).toEqual(deleted);
    });
  });
});
