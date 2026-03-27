import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

// --- Service mock ---
const mockList = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock('../../../services/queue-preset.service.js', () => ({
  queuePresetService: {
    list: (...args: unknown[]) => mockList(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
  PresetLimitExceededError: class PresetLimitExceededError extends Error {
    constructor() {
      super('Maximum of 20 saved presets reached');
      this.name = 'PresetLimitExceededError';
    }
  },
  PresetNotFoundError: class PresetNotFoundError extends Error {
    constructor(id: string) {
      super(`Preset "${id}" not found`);
      this.name = 'PresetNotFoundError';
    }
  },
}));

// Mock procedure builders to pass through to handler
vi.mock('../../init.js', () => {
  const noopMiddleware = {
    use: function (this: unknown) {
      return this;
    },
    input: function (this: unknown) {
      return this;
    },
    output: function (this: unknown) {
      return this;
    },
    query: (fn: unknown) => fn,
    mutation: (fn: unknown) => fn,
  };
  return {
    orgProcedure: noopMiddleware,
    editorProcedure: noopMiddleware,
    createRouter: (routes: Record<string, unknown>) => routes,
    requireScopes: () => vi.fn(),
  };
});

vi.mock('../../error-mapper.js', async () => {
  const { PresetLimitExceededError, PresetNotFoundError } =
    await import('../../../services/queue-preset.service.js');
  return {
    mapServiceError: (e: unknown) => {
      if (e instanceof PresetLimitExceededError) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: (e as Error).message,
        });
      }
      if (e instanceof PresetNotFoundError) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: (e as Error).message,
        });
      }
      throw e;
    },
  };
});

import { queuePresetsRouter } from '../queue-presets.js';

const router = queuePresetsRouter as unknown as Record<
  string,
  (ctx: { ctx: Record<string, unknown>; input?: unknown }) => Promise<unknown>
>;

const fakeCtx = {
  ctx: {
    dbTx: {},
    authContext: {
      userId: 'user-1',
      orgId: 'org-1',
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('queuePresetsRouter', () => {
  it('list returns empty array when no presets', async () => {
    mockList.mockResolvedValue([]);
    const result = await router.list(fakeCtx);
    expect(result).toEqual([]);
  });

  it('create saves preset and returns it', async () => {
    const preset = {
      id: 'p-1',
      organizationId: 'org-1',
      userId: 'user-1',
      name: 'My Filter',
      filters: { status: 'SUBMITTED' },
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockCreate.mockResolvedValue(preset);
    const result = await router.create({
      ...fakeCtx,
      input: { name: 'My Filter', filters: { status: 'SUBMITTED' } },
    });
    expect(result).toEqual(preset);
  });

  it('create returns BAD_REQUEST at limit', async () => {
    const { PresetLimitExceededError } =
      await import('../../../services/queue-preset.service.js');
    mockCreate.mockRejectedValue(new PresetLimitExceededError());
    await expect(
      router.create({
        ...fakeCtx,
        input: { name: 'Too many', filters: {} },
      }),
    ).rejects.toThrow(TRPCError);

    try {
      await router.create({
        ...fakeCtx,
        input: { name: 'Too many', filters: {} },
      });
    } catch (e) {
      expect((e as TRPCError).code).toBe('BAD_REQUEST');
    }
  });

  it('delete returns NOT_FOUND for missing', async () => {
    const { PresetNotFoundError } =
      await import('../../../services/queue-preset.service.js');
    mockDelete.mockRejectedValue(new PresetNotFoundError('p-999'));
    await expect(
      router.delete({ ...fakeCtx, input: { id: 'p-999' } }),
    ).rejects.toThrow(TRPCError);

    try {
      await router.delete({ ...fakeCtx, input: { id: 'p-999' } });
    } catch (e) {
      expect((e as TRPCError).code).toBe('NOT_FOUND');
    }
  });

  it('update returns NOT_FOUND for missing', async () => {
    const { PresetNotFoundError } =
      await import('../../../services/queue-preset.service.js');
    mockUpdate.mockRejectedValue(new PresetNotFoundError('p-999'));
    await expect(
      router.update({
        ...fakeCtx,
        input: { id: 'p-999', name: 'New name' },
      }),
    ).rejects.toThrow(TRPCError);

    try {
      await router.update({
        ...fakeCtx,
        input: { id: 'p-999', name: 'New name' },
      });
    } catch (e) {
      expect((e as TRPCError).code).toBe('NOT_FOUND');
    }
  });
});
