import { describe, it, expect, vi } from 'vitest';

vi.mock('../../services/hub.service.js', () => ({
  hubService: {
    assertHubMode: vi.fn(),
    listInstances: vi.fn(),
    getInstanceById: vi.fn(),
    suspendInstance: vi.fn(),
    revokeInstance: vi.fn(),
  },
  HubNotEnabledError: class extends Error {
    override name = 'HubNotEnabledError';
  },
  HubInstanceNotFoundError: class extends Error {
    override name = 'HubInstanceNotFoundError';
  },
  HubInstanceSuspendedError: class extends Error {
    override name = 'HubInstanceSuspendedError';
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
      optional: vi.fn().mockReturnValue({}),
    }),
    string: vi.fn().mockReturnValue({
      uuid: vi.fn().mockReturnValue({}),
    }),
  },
}));

vi.mock('@colophony/types', () => ({
  hubInstanceListQuerySchema: { optional: vi.fn().mockReturnValue({}) },
}));

import { hubRouter } from './hub.js';

describe('hubRouter', () => {
  it('exports all expected procedures', () => {
    expect(hubRouter).toHaveProperty('listInstances');
    expect(hubRouter).toHaveProperty('getInstanceById');
    expect(hubRouter).toHaveProperty('suspendInstance');
    expect(hubRouter).toHaveProperty('revokeInstance');
  });

  it('has exactly 4 procedures', () => {
    expect(Object.keys(hubRouter)).toHaveLength(4);
  });
});
