import { describe, it, expect, vi, beforeEach } from 'vitest';

// Build chainable mocks
let mockRows: Array<Record<string, unknown>> = [];

const mockReturning = vi.fn().mockImplementation(() => mockRows);
const mockWhere = vi.fn().mockImplementation(() => mockRows);
const mockOrderBy = vi.fn().mockImplementation(() => mockRows);
const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
const mockSet = vi.fn().mockReturnValue({ where: mockWhere });

const mockFrom = vi.fn().mockReturnValue({
  where: vi.fn().mockImplementation(() => mockRows),
  orderBy: mockOrderBy,
});

const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
const mockUpdate = vi.fn().mockReturnValue({
  set: mockSet,
});
const mockDeleteFn = vi.fn().mockReturnValue({ where: mockWhere });
const mockExecute = vi.fn().mockResolvedValue({ rows: [] });

vi.mock('@colophony/db', () => ({
  savedQueuePresets: {
    id: 'id',
    organizationId: 'organization_id',
    userId: 'user_id',
    name: 'name',
    filters: 'filters',
    isDefault: 'is_default',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const mod = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...mod,
    asc: vi.fn(),
    count: vi.fn(),
    ne: vi.fn(),
  };
});

import {
  queuePresetService,
  PresetLimitExceededError,
  PresetNotFoundError,
} from '../queue-preset.service.js';

function makeTx() {
  return {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDeleteFn,
    execute: mockExecute,
  } as unknown as Parameters<typeof queuePresetService.list>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRows = [];
  mockExecute.mockResolvedValue({ rows: [] });
});

describe('queuePresetService', () => {
  describe('list', () => {
    it('returns user presets ordered by name', async () => {
      const presets = [
        { id: 'p-1', name: 'Alpha' },
        { id: 'p-2', name: 'Beta' },
      ];
      mockOrderBy.mockResolvedValue(presets);
      mockFrom.mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: mockOrderBy,
        }),
      });

      const result = await queuePresetService.list(makeTx(), 'user-1');
      expect(result).toEqual(presets);
    });
  });

  describe('create', () => {
    it('throws at 20 presets', async () => {
      // Atomic insert returns empty rows when at limit
      mockExecute.mockResolvedValue({ rows: [] });

      await expect(
        queuePresetService.create(makeTx(), 'user-1', 'org-1', {
          name: 'Too many',
          filters: {},
          isDefault: false,
        }),
      ).rejects.toThrow(PresetLimitExceededError);
    });

    it('unsets other defaults when isDefault=true', async () => {
      const newPreset = {
        id: 'p-new',
        name: 'Default',
        isDefault: true,
      };
      // Atomic insert succeeds
      mockExecute.mockResolvedValue({ rows: [newPreset] });

      const result = await queuePresetService.create(
        makeTx(),
        'user-1',
        'org-1',
        { name: 'Default', filters: {}, isDefault: true },
      );
      expect(result).toEqual(newPreset);
      // update was called to unset other defaults
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('throws for missing row', async () => {
      mockFrom.mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });

      await expect(
        queuePresetService.delete(makeTx(), 'user-1', 'p-missing'),
      ).rejects.toThrow(PresetNotFoundError);
    });
  });

  describe('update', () => {
    it('throws for missing row', async () => {
      mockFrom.mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });

      await expect(
        queuePresetService.update(makeTx(), 'user-1', {
          id: 'p-missing',
          name: 'New name',
        }),
      ).rejects.toThrow(PresetNotFoundError);
    });
  });
});
