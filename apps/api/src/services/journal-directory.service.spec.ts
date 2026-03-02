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
  inArray: vi.fn((_col: unknown, vals: unknown) => ['inArray', vals]),
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

  describe('batchMatchByName', () => {
    it('returns matching journals', async () => {
      const matches = [
        {
          normalizedName: 'poetry magazine',
          id: 'j-1',
          name: 'Poetry Magazine',
        },
        { normalizedName: 'granta', id: 'j-2', name: 'Granta' },
      ];
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue(matches),
          }),
        }),
      } as unknown as Parameters<
        typeof journalDirectoryService.batchMatchByName
      >[0];

      const result = await journalDirectoryService.batchMatchByName(tx, {
        names: ['Poetry Magazine', 'Granta', 'Unknown Journal'],
      });

      expect(result).toEqual(matches);
      expect(result).toHaveLength(2);
    });

    it('normalizes case and whitespace', async () => {
      const mockWhere = vi.fn().mockReturnValue([]);
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: mockWhere,
          }),
        }),
      } as unknown as Parameters<
        typeof journalDirectoryService.batchMatchByName
      >[0];

      await journalDirectoryService.batchMatchByName(tx, {
        names: ['  The Paris Review  ', 'GRANTA'],
      });

      // inArray should be called with normalized values
      const { inArray } = await import('@colophony/db');
      expect(inArray).toHaveBeenCalledWith('normalized_name', [
        'the paris review',
        'granta',
      ]);
    });

    it('returns empty for no matches', async () => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue([]),
          }),
        }),
      } as unknown as Parameters<
        typeof journalDirectoryService.batchMatchByName
      >[0];

      const result = await journalDirectoryService.batchMatchByName(tx, {
        names: ['Unknown Journal'],
      });

      expect(result).toEqual([]);
    });

    it('returns early for empty input', async () => {
      const mockSelect = vi.fn();
      const tx = { select: mockSelect } as unknown as Parameters<
        typeof journalDirectoryService.batchMatchByName
      >[0];

      const result = await journalDirectoryService.batchMatchByName(tx, {
        names: [],
      });

      expect(result).toEqual([]);
      expect(mockSelect).not.toHaveBeenCalled();
    });
  });
});
