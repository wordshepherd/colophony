import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@colophony/db', () => {
  return {
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
  };
});

import {
  queuePresetService,
  PresetLimitExceededError,
  PresetDefaultConflictError,
} from './queue-preset.service.js';

function createChainMock(terminalValue: unknown) {
  const returning = vi.fn().mockResolvedValue(terminalValue);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  return { set, where, returning };
}

describe('queuePresetService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create()', () => {
    it('rejects when at preset limit', async () => {
      const execute = vi.fn().mockResolvedValue({ rows: [] });
      const tx = {
        execute,
        update: vi.fn().mockReturnValue(createChainMock([])),
      } as never;

      await expect(
        queuePresetService.create(tx, 'user-1', 'org-1', {
          name: 'Test',
          filters: {},
          isDefault: false,
        }),
      ).rejects.toThrow(PresetLimitExceededError);
    });

    it('succeeds under limit', async () => {
      const fakeRow = {
        id: 'preset-1',
        organization_id: 'org-1',
        user_id: 'user-1',
        name: 'Test',
        filters: {},
        is_default: false,
        created_at: new Date(),
        updated_at: new Date(),
      };
      const execute = vi.fn().mockResolvedValue({ rows: [fakeRow] });
      const tx = {
        execute,
        update: vi.fn().mockReturnValue(createChainMock([])),
      } as never;

      const result = await queuePresetService.create(tx, 'user-1', 'org-1', {
        name: 'Test',
        filters: {},
        isDefault: false,
      });

      expect(result).toEqual(fakeRow);
    });

    it('unsets existing defaults before insert when isDefault', async () => {
      const fakeRow = {
        id: 'preset-1',
        organization_id: 'org-1',
        user_id: 'user-1',
        name: 'Default',
        filters: {},
        is_default: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      const execute = vi.fn().mockResolvedValue({ rows: [fakeRow] });
      const chain = createChainMock([]);
      const updateFn = vi.fn().mockReturnValue(chain);
      const tx = {
        execute,
        update: updateFn,
      } as never;

      await queuePresetService.create(tx, 'user-1', 'org-1', {
        name: 'Default',
        filters: {},
        isDefault: true,
      });

      // update() should have been called to unset existing defaults
      expect(updateFn).toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('handles unique violation on concurrent default set', async () => {
      // Select chain for ownership check
      const selectWhere = vi.fn().mockResolvedValue([{ id: 'preset-1' }]);
      const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
      const selectFn = vi.fn().mockReturnValue({ from: selectFrom });

      // Update chain for unset-defaults — succeeds
      const unsetReturning = vi.fn().mockResolvedValue([]);
      const unsetWhere = vi.fn().mockReturnValue({ returning: unsetReturning });
      const unsetSet = vi.fn().mockReturnValue({ where: unsetWhere });

      // Update chain for the actual update — throws unique violation
      const uniqueViolation = new Error('duplicate key value');
      (uniqueViolation as Error & { code: string }).code = '23505';
      const updateReturning = vi.fn().mockRejectedValue(uniqueViolation);
      const updateWhere = vi
        .fn()
        .mockReturnValue({ returning: updateReturning });
      const updateSet = vi.fn().mockReturnValue({ where: updateWhere });

      // update() called twice: first for unset-defaults, second for actual update
      const updateFn = vi
        .fn()
        .mockReturnValueOnce({ set: unsetSet })
        .mockReturnValueOnce({ set: updateSet });

      const tx = {
        select: selectFn,
        update: updateFn,
      } as never;

      await expect(
        queuePresetService.update(tx, 'user-1', 'org-1', {
          id: 'preset-1',
          isDefault: true,
        }),
      ).rejects.toThrow(PresetDefaultConflictError);
    });
  });
});
