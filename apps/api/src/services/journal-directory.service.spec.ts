import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@colophony/db', () => ({
  journalDirectory: {
    id: 'id',
    name: 'name',
    normalizedName: 'normalized_name',
    externalUrl: 'external_url',
    colophonyDomain: 'colophony_domain',
  },
  eq: vi.fn((_col: unknown, val: unknown) => ['eq', val]),
}));

import { journalDirectoryService } from './journal-directory.service.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('journalDirectoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('search', () => {
    it('returns matching journals by normalized name', async () => {
      const journals = [
        {
          id: 'j-1',
          name: 'Poetry Magazine',
          externalUrl: null,
          colophonyDomain: null,
        },
      ];
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(journals),
            }),
          }),
        }),
      } as unknown as Parameters<typeof journalDirectoryService.search>[0];

      const result = await journalDirectoryService.search(tx, {
        query: 'poetry',
        limit: 10,
      });

      expect(result).toEqual(journals);
    });

    it('respects limit', async () => {
      const mockLimit = vi.fn().mockReturnValue([]);
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: mockLimit,
            }),
          }),
        }),
      } as unknown as Parameters<typeof journalDirectoryService.search>[0];

      await journalDirectoryService.search(tx, { query: 'test', limit: 5 });

      expect(mockLimit).toHaveBeenCalledWith(5);
    });

    it('returns empty array for no matches', async () => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue([]),
            }),
          }),
        }),
      } as unknown as Parameters<typeof journalDirectoryService.search>[0];

      const result = await journalDirectoryService.search(tx, {
        query: 'nonexistent',
        limit: 10,
      });

      expect(result).toEqual([]);
    });
  });
});
