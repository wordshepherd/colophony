import { describe, it, expect, vi } from 'vitest';

vi.mock('../../services/migration.service.js', () => ({
  migrationService: {
    listMigrationsForUser: vi.fn(),
    getMigrationById: vi.fn(),
    getPendingApprovalForUser: vi.fn(),
    requestMigration: vi.fn(),
    approveMigration: vi.fn(),
    rejectMigration: vi.fn(),
    cancelMigration: vi.fn(),
  },
  MigrationNotFoundError: class extends Error {
    override name = 'MigrationNotFoundError';
  },
  MigrationInvalidStateError: class extends Error {
    override name = 'MigrationInvalidStateError';
  },
  MigrationCapabilityError: class extends Error {
    override name = 'MigrationCapabilityError';
  },
  MigrationAlreadyActiveError: class extends Error {
    override name = 'MigrationAlreadyActiveError';
  },
  MigrationUserNotFoundError: class extends Error {
    override name = 'MigrationUserNotFoundError';
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
    authedProcedure: passthrough,
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
  migrationListQuerySchema: {},
  requestMigrationInputSchema: {},
}));

import { migrationRouter } from './migration.js';

describe('migrationRouter', () => {
  it('exports all expected procedures', () => {
    expect(migrationRouter).toHaveProperty('list');
    expect(migrationRouter).toHaveProperty('getById');
    expect(migrationRouter).toHaveProperty('listPending');
    expect(migrationRouter).toHaveProperty('request');
    expect(migrationRouter).toHaveProperty('approve');
    expect(migrationRouter).toHaveProperty('reject');
    expect(migrationRouter).toHaveProperty('cancel');
  });

  it('has exactly 7 procedures', () => {
    expect(Object.keys(migrationRouter)).toHaveLength(7);
  });

  it('query procedures include list, getById, listPending', () => {
    const queryProcedures = ['list', 'getById', 'listPending'];
    for (const name of queryProcedures) {
      expect(migrationRouter).toHaveProperty(name);
    }
  });

  it('mutation procedures include request, approve, reject, cancel', () => {
    const mutationProcedures = ['request', 'approve', 'reject', 'cancel'];
    for (const name of mutationProcedures) {
      expect(migrationRouter).toHaveProperty(name);
    }
  });
});
