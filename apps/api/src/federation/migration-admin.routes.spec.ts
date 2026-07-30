import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Env } from '../config/env.js';

// Mock migration service
const mockListMigrationsForUser = vi.fn();
const mockGetPendingApprovalForUser = vi.fn();
const mockGetMigrationById = vi.fn();
const mockRequestMigration = vi.fn();
const mockApproveMigration = vi.fn();
const mockRejectMigration = vi.fn();
const mockCancelMigration = vi.fn();

vi.mock('../services/migration.service.js', () => ({
  migrationService: {
    listMigrationsForUser: (...args: unknown[]) =>
      mockListMigrationsForUser(...args),
    getPendingApprovalForUser: (...args: unknown[]) =>
      mockGetPendingApprovalForUser(...args),
    getMigrationById: (...args: unknown[]) => mockGetMigrationById(...args),
    requestMigration: (...args: unknown[]) => mockRequestMigration(...args),
    approveMigration: (...args: unknown[]) => mockApproveMigration(...args),
    rejectMigration: (...args: unknown[]) => mockRejectMigration(...args),
    cancelMigration: (...args: unknown[]) => mockCancelMigration(...args),
  },
  MigrationNotFoundError: class MigrationNotFoundError extends Error {
    override name = 'MigrationNotFoundError' as const;
  },
  MigrationInvalidStateError: class MigrationInvalidStateError extends Error {
    override name = 'MigrationInvalidStateError' as const;
  },
  MigrationCapabilityError: class MigrationCapabilityError extends Error {
    override name = 'MigrationCapabilityError' as const;
  },
  MigrationAlreadyActiveError: class MigrationAlreadyActiveError extends Error {
    override name = 'MigrationAlreadyActiveError' as const;
  },
}));

vi.mock('../config/env.js', () => ({
  validateEnv: vi.fn().mockReturnValue({
    FEDERATION_ENABLED: true,
    FEDERATION_DOMAIN: 'local.example.com',
    // internalOnly reads this per request. Omitting it leaves `enforced`
    // undefined, which is falsy — the guard silently degrades to log-only and an
    // API-key rejection test passes with a 200.
    INTERNAL_ONLY_ENFORCE: true,
  }),
}));

const validUuid = '00000000-0000-4000-a000-000000000001';
const validUuid2 = '00000000-0000-4000-a000-000000000002';
const testUserId = '00000000-0000-4000-a000-000000000099';

const testEnv = {
  FEDERATION_ENABLED: true,
  FEDERATION_DOMAIN: 'local.example.com',
} as unknown as Env;

describe('migration-admin.routes', () => {
  let app: FastifyInstance;
  /** Same user, authenticated as an API key rather than a session. */
  let apiKeyApp: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    // Fake auth context decorator
    app.decorateRequest('authContext', null);
    app.addHook('preHandler', async (request) => {
      request.authContext = {
        userId: testUserId,
        authMethod: 'oidc' as const,
        orgId: validUuid2,
        roles: ['ADMIN'] as const,
        email: 'admin@local.example.com',
        emailVerified: true,
      };
    });

    const { registerMigrationAdminRoutes } =
      await import('./migration-admin.routes.js');
    await app.register(async (scope) => {
      await registerMigrationAdminRoutes(scope, { env: testEnv });
    });

    await app.ready();

    // No applyGuardEnv here: this spec mocks config/env.js wholesale, so the
    // guard reads INTERNAL_ONLY_ENFORCE from that mock rather than process.env.
    apiKeyApp = Fastify({ logger: false });
    apiKeyApp.decorateRequest('authContext', null);
    apiKeyApp.addHook('preHandler', async (request) => {
      request.authContext = {
        userId: testUserId,
        authMethod: 'apikey' as const,
        apiKeyId: '00000000-0000-4000-a000-0000000000ff',
        apiKeyScopes: [],
        orgId: validUuid2,
        roles: ['ADMIN'] as const,
        email: 'admin@local.example.com',
        emailVerified: true,
      };
    });
    await apiKeyApp.register(async (scope) => {
      await registerMigrationAdminRoutes(scope, { env: testEnv });
    });
    await apiKeyApp.ready();
  });

  it('rejects an API key on every route', async () => {
    // These were the laxest routes on the surface before internalOnly: a bare
    // `if (!request.authContext)` per handler, no role check, so any key with
    // any scope could approve or cancel a migration as its creator.
    const calls: Array<['GET' | 'POST', string]> = [
      ['GET', '/federation/migrations'],
      ['GET', '/federation/migrations/pending'],
      ['GET', `/federation/migrations/${validUuid}`],
      ['POST', '/federation/migrations/request'],
      ['POST', `/federation/migrations/${validUuid}/approve`],
      ['POST', `/federation/migrations/${validUuid}/reject`],
      ['POST', `/federation/migrations/${validUuid}/cancel`],
    ];

    for (const [method, url] of calls) {
      const res = await apiKeyApp.inject({ method, url });
      expect(res.statusCode, `${method} ${url}`).toBe(403);
      expect(res.json(), `${method} ${url}`).toMatchObject({
        message: 'This route is not available to API keys',
      });
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
    await apiKeyApp.close();
  });

  describe('GET /federation/migrations', () => {
    it('returns user migrations', async () => {
      mockListMigrationsForUser.mockResolvedValue({
        migrations: [
          { id: validUuid, direction: 'inbound', status: 'PENDING' },
        ],
        total: 1,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/federation/migrations',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.migrations).toHaveLength(1);
      expect(mockListMigrationsForUser).toHaveBeenCalledWith(
        testUserId,
        expect.any(Object),
      );
    });
  });

  describe('POST /federation/migrations/request', () => {
    it('initiates migration', async () => {
      mockRequestMigration.mockResolvedValue({
        migrationId: validUuid,
        status: 'pending',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/federation/migrations/request',
        payload: {
          originDomain: 'origin.example.com',
          originEmail: 'user@origin.example.com',
          organizationId: validUuid2,
        },
      });

      expect(res.statusCode).toBe(202);
      expect(JSON.parse(res.body).migrationId).toBe(validUuid);
    });
  });

  describe('POST /federation/migrations/:id/approve', () => {
    it('succeeds for valid migration', async () => {
      mockApproveMigration.mockResolvedValue(undefined);

      const res = await app.inject({
        method: 'POST',
        url: `/federation/migrations/${validUuid}/approve`,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).status).toBe('approved');
    });
  });

  describe('POST /federation/migrations/:id/reject', () => {
    it('succeeds for valid migration', async () => {
      mockRejectMigration.mockResolvedValue(undefined);

      const res = await app.inject({
        method: 'POST',
        url: `/federation/migrations/${validUuid}/reject`,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).status).toBe('rejected');
    });
  });

  describe('POST /federation/migrations/:id/cancel', () => {
    it('succeeds for valid migration', async () => {
      mockCancelMigration.mockResolvedValue(undefined);

      const res = await app.inject({
        method: 'POST',
        url: `/federation/migrations/${validUuid}/cancel`,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).status).toBe('cancelled');
    });
  });

  describe('GET /federation/migrations/:id', () => {
    it('returns single migration', async () => {
      mockGetMigrationById.mockResolvedValue({
        id: validUuid,
        direction: 'outbound',
        status: 'PENDING_APPROVAL',
        peerDomain: 'remote.example.com',
      });

      const res = await app.inject({
        method: 'GET',
        url: `/federation/migrations/${validUuid}`,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).id).toBe(validUuid);
    });
  });
});
