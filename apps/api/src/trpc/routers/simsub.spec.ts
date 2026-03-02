import { describe, it, expect, vi } from 'vitest';

vi.mock('@colophony/db', () => ({
  withRls: vi.fn(),
  simSubChecks: {},
  eq: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  desc: vi.fn(),
}));

vi.mock('../../services/simsub.service.js', () => ({
  simsubService: {
    grantOverride: vi.fn(),
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

import { simsubRouter } from './simsub.js';

describe('simsubRouter', () => {
  it('exports all expected procedures', () => {
    expect(simsubRouter).toHaveProperty('listChecks');
    expect(simsubRouter).toHaveProperty('grantOverride');
  });

  it('has exactly 2 procedures', () => {
    expect(Object.keys(simsubRouter)).toHaveLength(2);
  });
});
