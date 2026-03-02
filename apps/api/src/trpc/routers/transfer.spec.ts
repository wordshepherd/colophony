import { describe, it, expect, vi } from 'vitest';

vi.mock('../../services/transfer.service.js', () => ({
  transferService: {
    listTransfersForOrg: vi.fn(),
    getTransferById: vi.fn(),
    cancelTransfer: vi.fn(),
  },
  TransferNotFoundError: class extends Error {
    override name = 'TransferNotFoundError';
  },
  TransferInvalidStateError: class extends Error {
    override name = 'TransferInvalidStateError';
  },
  TransferCapabilityError: class extends Error {
    override name = 'TransferCapabilityError';
  },
}));

vi.mock('../../config/env.js', () => ({
  validateEnv: () => ({
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: '',
  }),
}));

vi.mock('../init.js', () => {
  const passthrough = {
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
    use: vi.fn().mockReturnThis(),
  };
  return {
    adminProcedure: passthrough,
    createRouter: vi.fn((routes) => routes),
  };
});

vi.mock('../error-mapper.js', () => ({
  mapServiceError: vi.fn(),
}));

vi.mock('zod', () => ({
  z: {
    object: vi.fn().mockReturnValue({
      merge: vi.fn().mockReturnValue({}),
    }),
    string: vi.fn().mockReturnValue({
      uuid: vi.fn().mockReturnValue({}),
    }),
  },
}));

vi.mock('@colophony/types', () => ({
  transferListQuerySchema: {},
}));

import { transferRouter } from './transfer.js';

describe('transferRouter', () => {
  it('exports all expected procedures', () => {
    expect(transferRouter).toHaveProperty('list');
    expect(transferRouter).toHaveProperty('getById');
    expect(transferRouter).toHaveProperty('cancel');
  });

  it('has exactly 3 procedures', () => {
    expect(Object.keys(transferRouter)).toHaveLength(3);
  });
});
