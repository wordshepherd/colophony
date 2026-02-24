import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env } from '../config/env.js';

// Mock @colophony/db
vi.mock('@colophony/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
  federationConfig: { singleton: 'singleton' },
  publications: {
    id: 'id',
    name: 'name',
    slug: 'slug',
    organizationId: 'organization_id',
    status: 'status',
  },
  organizations: {
    id: 'id',
    slug: 'slug',
    federationOptedOut: 'federation_opted_out',
  },
  users: { id: 'id', email: 'email' },
  eq: vi.fn((_col, val) => ({ _eq: val })),
  and: vi.fn((...args: unknown[]) => ({ _and: args })),
  sql: vi.fn(),
}));

// Mock audit service
vi.mock('./audit.service.js', () => ({
  auditService: {
    logDirect: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock crypto for deterministic key generation
vi.mock('node:crypto', async () => {
  const actual =
    await vi.importActual<typeof import('node:crypto')>('node:crypto');
  return {
    ...actual,
    default: {
      ...actual,
      generateKeyPairSync: vi.fn(() => ({
        publicKey: 'mock-ed25519-public-key-pem',
        privateKey: 'mock-ed25519-private-key-pem',
      })),
    },
  };
});

const baseEnv: Env = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  PORT: 4000,
  HOST: '0.0.0.0',
  NODE_ENV: 'test',
  LOG_LEVEL: 'fatal',
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_PASSWORD: '',
  CORS_ORIGIN: 'http://localhost:3000',
  RATE_LIMIT_DEFAULT_MAX: 60,
  RATE_LIMIT_AUTH_MAX: 200,
  RATE_LIMIT_WINDOW_SECONDS: 60,
  RATE_LIMIT_KEY_PREFIX: 'colophony:rl',
  AUTH_FAILURE_THROTTLE_MAX: 10,
  AUTH_FAILURE_THROTTLE_WINDOW_SECONDS: 300,
  WEBHOOK_TIMESTAMP_MAX_AGE_SECONDS: 300,
  WEBHOOK_RATE_LIMIT_MAX: 100,
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'submissions',
  S3_QUARANTINE_BUCKET: 'quarantine',
  S3_ACCESS_KEY: 'minioadmin',
  S3_SECRET_KEY: 'minioadmin',
  S3_REGION: 'us-east-1',
  TUS_ENDPOINT: 'http://localhost:1080/files/',
  CLAMAV_HOST: 'localhost',
  CLAMAV_PORT: 3310,
  VIRUS_SCAN_ENABLED: true,
  DEV_AUTH_BYPASS: false,
  FEDERATION_ENABLED: true,
  FEDERATION_DOMAIN: 'magazine.example',
  INNGEST_DEV: false,
};

// Helper to build chained Drizzle mock
function mockSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue(rows),
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(rows),
      }),
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

describe('federationService', () => {
  let dbModule: {
    db: { select: ReturnType<typeof vi.fn>; insert: ReturnType<typeof vi.fn> };
  };
  let auditModule: { auditService: { logDirect: ReturnType<typeof vi.fn> } };
  let cryptoModule: {
    default: { generateKeyPairSync: ReturnType<typeof vi.fn> };
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    dbModule = (await import('@colophony/db')) as unknown as typeof dbModule;
    auditModule =
      (await import('./audit.service.js')) as unknown as typeof auditModule;
    cryptoModule =
      (await import('node:crypto')) as unknown as typeof cryptoModule;
  });

  describe('getOrInitConfig', () => {
    it('generates keypair when DB is empty', async () => {
      const { federationService } = await import('./federation.service.js');

      // First select returns empty (no existing config)
      dbModule.db.select
        .mockReturnValueOnce(mockSelectChain([]))
        // After insert, read-back returns the new row
        .mockReturnValueOnce(
          mockSelectChain([
            {
              id: 'new-id',
              publicKey: 'mock-ed25519-public-key-pem',
              privateKey: 'mock-ed25519-private-key-pem',
              keyId: 'magazine.example#main',
              mode: 'allowlist',
              contactEmail: null,
              capabilities: ['identity'],
              enabled: false,
            },
          ]),
        );

      dbModule.db.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue({ rowCount: 1 }),
        }),
      });

      const config = await federationService.getOrInitConfig(baseEnv);

      expect(cryptoModule.default.generateKeyPairSync).toHaveBeenCalledWith(
        'ed25519',
        expect.objectContaining({
          publicKeyEncoding: { type: 'spki', format: 'pem' },
        }),
      );
      expect(config.publicKey).toBe('mock-ed25519-public-key-pem');
    });

    it('returns existing config from DB', async () => {
      const { federationService } = await import('./federation.service.js');

      const existingRow = {
        id: 'existing-id',
        publicKey: 'existing-pub',
        privateKey: 'existing-priv',
        keyId: 'magazine.example#main',
        mode: 'allowlist' as const,
        contactEmail: 'admin@magazine.example',
        capabilities: ['identity'],
        enabled: true,
      };

      dbModule.db.select.mockReturnValueOnce(mockSelectChain([existingRow]));

      const config = await federationService.getOrInitConfig(baseEnv);

      expect(cryptoModule.default.generateKeyPairSync).not.toHaveBeenCalled();
      expect(config.id).toBe('existing-id');
      expect(config.publicKey).toBe('existing-pub');
    });

    it('prefers env var keys over DB', async () => {
      const { federationService } = await import('./federation.service.js');

      dbModule.db.select.mockReturnValueOnce(
        mockSelectChain([
          {
            id: 'db-id',
            publicKey: 'db-pub',
            privateKey: 'db-priv',
            keyId: 'magazine.example#main',
            mode: 'allowlist',
            contactEmail: null,
            capabilities: ['identity'],
            enabled: false,
          },
        ]),
      );

      const envWithKeys: Env = {
        ...baseEnv,
        FEDERATION_PUBLIC_KEY: 'env-pub-key',
        FEDERATION_PRIVATE_KEY: 'env-priv-key',
      };

      const config = await federationService.getOrInitConfig(envWithKeys);

      expect(config.publicKey).toBe('env-pub-key');
      expect(config.privateKey).toBe('env-priv-key');
    });

    it('handles concurrent initialization gracefully', async () => {
      const { federationService } = await import('./federation.service.js');

      // First select: empty (no existing config)
      dbModule.db.select
        .mockReturnValueOnce(mockSelectChain([]))
        // After insert (ON CONFLICT DO NOTHING), read-back returns the row another process inserted
        .mockReturnValueOnce(
          mockSelectChain([
            {
              id: 'other-process-id',
              publicKey: 'other-pub',
              privateKey: 'other-priv',
              keyId: 'magazine.example#main',
              mode: 'allowlist',
              contactEmail: null,
              capabilities: ['identity'],
              enabled: false,
            },
          ]),
        );

      dbModule.db.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue({ rowCount: 0 }),
        }),
      });

      const config = await federationService.getOrInitConfig(baseEnv);

      // Should return the other process's row, not the one we tried to insert
      expect(config.id).toBe('other-process-id');
      expect(config.publicKey).toBe('other-pub');
    });
  });

  describe('getInstanceMetadata', () => {
    it('returns valid FederationMetadata', async () => {
      const { federationService } = await import('./federation.service.js');

      const configRow = {
        id: 'cfg-id',
        publicKey: 'pub-key',
        privateKey: 'priv-key',
        keyId: 'magazine.example#main',
        mode: 'allowlist' as const,
        contactEmail: null,
        capabilities: ['identity'],
        enabled: true,
      };

      const pubRows = [
        {
          id: 'pub-1',
          name: 'Literary Review',
          slug: 'literary-review',
          organizationSlug: 'lit-org',
        },
      ];

      // getOrInitConfig -> select existing config
      dbModule.db.select
        .mockReturnValueOnce(mockSelectChain([configRow]))
        // getInstanceMetadata -> select publications
        .mockReturnValueOnce(mockSelectChain(pubRows));

      const metadata = await federationService.getInstanceMetadata(baseEnv);

      expect(metadata.software).toBe('colophony');
      expect(metadata.domain).toBe('magazine.example');
      expect(metadata.publicKey).toBe('pub-key');
      expect(metadata.publications).toHaveLength(1);
      expect(metadata.publications[0].name).toBe('Literary Review');
    });

    it('excludes federation-opted-out orgs', async () => {
      const { federationService } = await import('./federation.service.js');

      const configRow = {
        id: 'cfg-id',
        publicKey: 'pub-key',
        privateKey: 'priv-key',
        keyId: 'magazine.example#main',
        mode: 'allowlist' as const,
        contactEmail: null,
        capabilities: ['identity'],
        enabled: true,
      };

      // Only non-opted-out publications returned (DB-level WHERE filter)
      dbModule.db.select
        .mockReturnValueOnce(mockSelectChain([configRow]))
        .mockReturnValueOnce(mockSelectChain([]));

      const metadata = await federationService.getInstanceMetadata(baseEnv);

      expect(metadata.publications).toHaveLength(0);
    });

    it('includes only ACTIVE publications', async () => {
      const { federationService } = await import('./federation.service.js');

      const configRow = {
        id: 'cfg-id',
        publicKey: 'pub-key',
        privateKey: 'priv-key',
        keyId: 'magazine.example#main',
        mode: 'allowlist' as const,
        contactEmail: null,
        capabilities: ['identity'],
        enabled: true,
      };

      // Only ACTIVE pubs returned (DB-level WHERE filter)
      const activePub = {
        id: 'pub-1',
        name: 'Active Pub',
        slug: 'active',
        organizationSlug: 'org-1',
      };

      dbModule.db.select
        .mockReturnValueOnce(mockSelectChain([configRow]))
        .mockReturnValueOnce(mockSelectChain([activePub]));

      const metadata = await federationService.getInstanceMetadata(baseEnv);

      expect(metadata.publications).toHaveLength(1);
      expect(metadata.publications[0].name).toBe('Active Pub');
    });
  });

  describe('generateAndStoreKeypair', () => {
    it('audit logs key generation', async () => {
      const { federationService } = await import('./federation.service.js');

      const generatedPub = 'mock-ed25519-public-key-pem';

      dbModule.db.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue({ rowCount: 1 }),
        }),
      });

      dbModule.db.select.mockReturnValueOnce(
        mockSelectChain([
          {
            id: 'new-id',
            publicKey: generatedPub,
            privateKey: 'mock-ed25519-private-key-pem',
            keyId: 'magazine.example#main',
            mode: 'allowlist',
            contactEmail: null,
            capabilities: ['identity'],
            enabled: false,
          },
        ]),
      );

      await federationService.generateAndStoreKeypair(baseEnv);

      expect(auditModule.auditService.logDirect).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: 'federation',
          action: 'FEDERATION_KEY_GENERATED',
        }),
      );
    });
  });

  describe('resolveWebFinger', () => {
    it('returns JRD for valid acct: URI', async () => {
      const { federationService } = await import('./federation.service.js');

      dbModule.db.select.mockReturnValueOnce(
        mockSelectChain([{ id: 'user-1', email: 'alice@magazine.example' }]),
      );

      const result = await federationService.resolveWebFinger(
        baseEnv,
        'acct:alice@magazine.example',
      );

      expect(result.subject).toBe('acct:alice@magazine.example');
      expect(result.links).toBeDefined();
      expect(result.links!.length).toBeGreaterThan(0);
    });

    it('throws WebFingerUserNotFoundError for unknown user', async () => {
      const { federationService, WebFingerUserNotFoundError } =
        await import('./federation.service.js');

      dbModule.db.select.mockReturnValueOnce(mockSelectChain([]));

      await expect(
        federationService.resolveWebFinger(
          baseEnv,
          'acct:nobody@magazine.example',
        ),
      ).rejects.toThrow(WebFingerUserNotFoundError);
    });

    it('throws WebFingerDomainMismatchError for wrong domain', async () => {
      const { federationService, WebFingerDomainMismatchError } =
        await import('./federation.service.js');

      await expect(
        federationService.resolveWebFinger(baseEnv, 'acct:alice@other.example'),
      ).rejects.toThrow(WebFingerDomainMismatchError);
    });

    it('aliases include did:web identifier', async () => {
      const { federationService } = await import('./federation.service.js');

      dbModule.db.select.mockReturnValueOnce(
        mockSelectChain([{ id: 'user-1', email: 'alice@magazine.example' }]),
      );

      const result = await federationService.resolveWebFinger(
        baseEnv,
        'acct:alice@magazine.example',
      );

      expect(result.aliases).toContain('did:web:magazine.example:users:alice');
    });
  });
});
