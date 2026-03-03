import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies (must be before service import)
// ---------------------------------------------------------------------------

const mockAuditLog = vi.fn();
const mockAuditLogDirect = vi.fn();

vi.mock('@colophony/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue([]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockReturnValue([]),
      }),
    }),
  },
  withRls: vi.fn(),
  identityMigrations: {},
  submissions: {},
  trustedPeers: {},
  users: {},
  files: {},
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
  not: vi.fn(),
  inArray: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  count: vi.fn(),
}));

vi.mock('../../services/audit.service.js', () => ({
  auditService: {
    log: (...args: unknown[]) => mockAuditLog(...args),
    logDirect: (...args: unknown[]) => mockAuditLogDirect(...args),
  },
}));

const mockGetOrInitConfig = vi.fn();

vi.mock('../../services/federation.service.js', () => ({
  federationService: {
    getOrInitConfig: (...args: unknown[]) => mockGetOrInitConfig(...args),
  },
  domainToDid: (domain: string) => encodeURIComponent(domain),
}));

vi.mock('../../services/migration-bundle.service.js', () => ({
  migrationBundleService: {
    assembleBundle: vi.fn(),
  },
}));

vi.mock('../../federation/http-signatures.js', () => ({
  signFederationRequest: vi.fn().mockReturnValue({
    headers: { signature: 'mock-sig', date: new Date().toUTCString() },
  }),
}));

vi.mock('../../lib/url-validation.js', () => ({
  validateOutboundUrl: vi.fn(),
  resolveAndCheckPrivateIp: vi.fn(),
  SsrfValidationError: class extends Error {},
}));

vi.mock('../../adapters/registry-accessor.js', () => ({
  getGlobalRegistry: vi.fn().mockReturnValue({
    storage: { getObject: vi.fn() },
  }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  migrationService,
  MigrationCapabilityError,
  MigrationUserNotFoundError,
  MigrationAlreadyActiveError,
} from '../../services/migration.service.js';
import { db } from '@colophony/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set up sequential db.select mock calls.
 * Each entry maps to one db.select().from().where().limit() chain.
 */
function mockDbSelectSequence(results: unknown[][]) {
  let callIndex = 0;
  vi.mocked(db.select).mockImplementation((_fields?: any) => {
    const rows = results[callIndex] ?? [];
    callIndex++;
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue(rows),
        }),
      }),
    } as any;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('migration flow integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: db.insert succeeds
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockReturnValue([{ id: 'migration-1' }]),
      }),
    } as any);
  });

  it('handleMigrationRequest: valid request creates pending_approval', async () => {
    // Sequential superuser queries:
    // 1. users lookup → found
    // 2. active migrations check → empty
    // 3. trusted peers check → peer found
    mockDbSelectSequence([
      [
        {
          id: 'user-1',
          email: 'alice@origin.example.com',
          deletedAt: null,
          isGuest: false,
          migratedAt: null,
        },
      ],
      [],
      [{ id: 'peer-1' }],
    ]);

    const result = await migrationService.handleMigrationRequest(
      { FEDERATION_DOMAIN: 'origin.example.com' } as any,
      'dest.example.com',
      {
        userEmail: 'alice@origin.example.com',
        destinationDomain: 'dest.example.com',
        destinationUserDid: 'did:web:dest.example.com:users:alice',
        callbackUrl:
          'https://dest.example.com/federation/v1/migrations/bundle-delivery',
        protocolVersion: '1.0',
      },
    );

    expect(result.status).toBe('pending_approval');
    expect(result.migrationId).toBeDefined();
    expect(mockAuditLogDirect).toHaveBeenCalled();
  });

  it('handleMigrationRequest: rejects peer domain mismatch', async () => {
    // peerDomain: 'attacker.com', destinationDomain: 'dest.example.com'
    await expect(
      migrationService.handleMigrationRequest(
        { FEDERATION_DOMAIN: 'origin.example.com' } as any,
        'attacker.com',
        {
          userEmail: 'alice@origin.example.com',
          destinationDomain: 'dest.example.com',
          destinationUserDid: 'did:web:dest.example.com:users:alice',
          callbackUrl:
            'https://dest.example.com/federation/v1/migrations/bundle-delivery',
          protocolVersion: '1.0',
        },
      ),
    ).rejects.toThrow(MigrationCapabilityError);
  });

  it('handleMigrationRequest: rejects unknown user', async () => {
    // users lookup → empty
    mockDbSelectSequence([[]]);

    await expect(
      migrationService.handleMigrationRequest(
        { FEDERATION_DOMAIN: 'origin.example.com' } as any,
        'dest.example.com',
        {
          userEmail: 'nobody@origin.example.com',
          destinationDomain: 'dest.example.com',
          destinationUserDid: 'did:web:dest.example.com:users:nobody',
          callbackUrl:
            'https://dest.example.com/federation/v1/migrations/bundle-delivery',
          protocolVersion: '1.0',
        },
      ),
    ).rejects.toThrow(MigrationUserNotFoundError);
  });

  it('handleMigrationRequest: rejects when active migration exists', async () => {
    // 1. users → found
    // 2. active migrations → found (non-terminal)
    mockDbSelectSequence([
      [
        {
          id: 'user-1',
          email: 'alice@origin.example.com',
          deletedAt: null,
          isGuest: false,
          migratedAt: null,
        },
      ],
      [{ id: 'existing-migration' }],
    ]);

    await expect(
      migrationService.handleMigrationRequest(
        { FEDERATION_DOMAIN: 'origin.example.com' } as any,
        'dest.example.com',
        {
          userEmail: 'alice@origin.example.com',
          destinationDomain: 'dest.example.com',
          destinationUserDid: 'did:web:dest.example.com:users:alice',
          callbackUrl:
            'https://dest.example.com/federation/v1/migrations/bundle-delivery',
          protocolVersion: '1.0',
        },
      ),
    ).rejects.toThrow(MigrationAlreadyActiveError);
  });

  it('handleMigrationRequest: rejects peer without capability', async () => {
    // 1. users → found
    // 2. active migrations → empty
    // 3. trusted peers → empty (no capability)
    mockDbSelectSequence([
      [
        {
          id: 'user-1',
          email: 'alice@origin.example.com',
          deletedAt: null,
          isGuest: false,
          migratedAt: null,
        },
      ],
      [],
      [],
    ]);

    await expect(
      migrationService.handleMigrationRequest(
        { FEDERATION_DOMAIN: 'origin.example.com' } as any,
        'dest.example.com',
        {
          userEmail: 'alice@origin.example.com',
          destinationDomain: 'dest.example.com',
          destinationUserDid: 'did:web:dest.example.com:users:alice',
          callbackUrl:
            'https://dest.example.com/federation/v1/migrations/bundle-delivery',
          protocolVersion: '1.0',
        },
      ),
    ).rejects.toThrow(MigrationCapabilityError);
  });
});
