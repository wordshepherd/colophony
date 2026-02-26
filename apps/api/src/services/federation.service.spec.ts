import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env } from '../config/env.js';

// Generate real keypair at module level using vi.hoisted to run before mocks
const { testKeypairHoisted } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const c = require('node:crypto') as typeof import('node:crypto');
  const kp = c.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { testKeypairHoisted: kp };
});

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
  users: {
    id: 'id',
    email: 'email',
    deletedAt: 'deleted_at',
    isGuest: 'is_guest',
  },
  userKeys: {
    publicKey: 'public_key',
    keyId: 'key_id',
    userId: 'user_id',
  },
  eq: vi.fn((_col, val) => ({ _eq: val })),
  and: vi.fn((...args: unknown[]) => ({ _and: args })),
  isNull: vi.fn((col) => ({ _isNull: col })),
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
        publicKey: testKeypairHoisted.publicKey,
        privateKey: testKeypairHoisted.privateKey,
      })),
      createPublicKey: actual.createPublicKey,
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

// Alias for readability in test data
const testKeypair = testKeypairHoisted;

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
              publicKey: testKeypair.publicKey,
              privateKey: testKeypair.privateKey,
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
      expect(config.publicKey).toBe(testKeypair.publicKey);
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

  describe('getPublicConfig', () => {
    it('returns config without privateKey', async () => {
      const { federationService } = await import('./federation.service.js');

      const existingRow = {
        id: 'existing-id',
        publicKey: 'existing-pub',
        keyId: 'magazine.example#main',
        mode: 'allowlist' as const,
        contactEmail: 'admin@magazine.example',
        capabilities: ['identity'],
        enabled: true,
      };

      dbModule.db.select.mockReturnValueOnce(mockSelectChain([existingRow]));

      const config = await federationService.getPublicConfig(baseEnv);

      expect(config.publicKey).toBe('existing-pub');
      expect(config.keyId).toBe('magazine.example#main');
      expect(config.mode).toBe('allowlist');
      expect(config.enabled).toBe(true);
      expect('privateKey' in config).toBe(false);
    });

    it('with env override reads only public key', async () => {
      const { federationService } = await import('./federation.service.js');

      dbModule.db.select.mockReturnValueOnce(
        mockSelectChain([
          {
            id: 'db-id',
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

      const config = await federationService.getPublicConfig(envWithKeys);

      expect(config.publicKey).toBe('env-pub-key');
      expect('privateKey' in config).toBe(false);
    });

    it('auto-generates if no config exists', async () => {
      const { federationService } = await import('./federation.service.js');

      // getPublicConfig DB path: select public columns returns empty
      dbModule.db.select
        .mockReturnValueOnce(mockSelectChain([]))
        // getOrInitConfig fallback: select returns empty (no existing config)
        .mockReturnValueOnce(mockSelectChain([]))
        // After insert, read-back returns the new row
        .mockReturnValueOnce(
          mockSelectChain([
            {
              id: 'new-id',
              publicKey: testKeypair.publicKey,
              privateKey: testKeypair.privateKey,
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

      const config = await federationService.getPublicConfig(baseEnv);

      expect(config.publicKey).toBe(testKeypair.publicKey);
      expect(config.keyId).toBe('magazine.example#main');
      expect('privateKey' in config).toBe(false);
    });

    it('getOrInitConfig still returns privateKey', async () => {
      const { federationService } = await import('./federation.service.js');

      const existingRow = {
        id: 'existing-id',
        publicKey: 'existing-pub',
        privateKey: 'existing-priv',
        keyId: 'magazine.example#main',
        mode: 'allowlist' as const,
        contactEmail: null,
        capabilities: ['identity'],
        enabled: true,
      };

      dbModule.db.select.mockReturnValueOnce(mockSelectChain([existingRow]));

      const config = await federationService.getOrInitConfig(baseEnv);

      expect(config.privateKey).toBe('existing-priv');
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

    it('throws FederationDisabledError when config.enabled is false', async () => {
      const { federationService, FederationDisabledError } =
        await import('./federation.service.js');

      const disabledConfig = {
        id: 'cfg-id',
        publicKey: 'pub-key',
        privateKey: 'priv-key',
        keyId: 'magazine.example#main',
        mode: 'allowlist' as const,
        contactEmail: null,
        capabilities: ['identity'],
        enabled: false,
      };

      dbModule.db.select.mockReturnValueOnce(mockSelectChain([disabledConfig]));

      await expect(
        federationService.getInstanceMetadata(baseEnv),
      ).rejects.toThrow(FederationDisabledError);
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

      const generatedPub = testKeypair.publicKey;

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
            privateKey: testKeypair.privateKey,
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
    const enabledConfig = {
      id: 'cfg-id',
      publicKey: 'pub-key',
      privateKey: 'priv-key',
      keyId: 'magazine.example#main',
      mode: 'allowlist' as const,
      contactEmail: null,
      capabilities: ['identity'],
      enabled: true,
    };

    it('returns JRD for valid acct: URI', async () => {
      const { federationService } = await import('./federation.service.js');

      dbModule.db.select
        .mockReturnValueOnce(mockSelectChain([enabledConfig]))
        .mockReturnValueOnce(
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

      dbModule.db.select
        .mockReturnValueOnce(mockSelectChain([enabledConfig]))
        .mockReturnValueOnce(mockSelectChain([]));

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

      dbModule.db.select.mockReturnValueOnce(mockSelectChain([enabledConfig]));

      await expect(
        federationService.resolveWebFinger(baseEnv, 'acct:alice@other.example'),
      ).rejects.toThrow(WebFingerDomainMismatchError);
    });

    it('aliases include did:web identifier', async () => {
      const { federationService } = await import('./federation.service.js');

      dbModule.db.select
        .mockReturnValueOnce(mockSelectChain([enabledConfig]))
        .mockReturnValueOnce(
          mockSelectChain([{ id: 'user-1', email: 'alice@magazine.example' }]),
        );

      const result = await federationService.resolveWebFinger(
        baseEnv,
        'acct:alice@magazine.example',
      );

      expect(result.aliases).toContain('did:web:magazine.example:users:alice');
    });

    it('throws FederationDisabledError when config.enabled is false', async () => {
      const { federationService, FederationDisabledError } =
        await import('./federation.service.js');

      const disabledConfig = { ...enabledConfig, enabled: false };
      dbModule.db.select.mockReturnValueOnce(mockSelectChain([disabledConfig]));

      await expect(
        federationService.resolveWebFinger(
          baseEnv,
          'acct:alice@magazine.example',
        ),
      ).rejects.toThrow(FederationDisabledError);
    });
  });

  describe('getInstanceDidDocument', () => {
    it('returns valid DID document with JWK', async () => {
      const { federationService } = await import('./federation.service.js');

      const configRow = {
        id: 'cfg-id',
        publicKey: testKeypair.publicKey,
        privateKey: testKeypair.privateKey,
        keyId: 'magazine.example#main',
        mode: 'allowlist' as const,
        contactEmail: null,
        capabilities: ['identity'],
        enabled: true,
      };

      dbModule.db.select.mockReturnValueOnce(mockSelectChain([configRow]));

      const doc = await federationService.getInstanceDidDocument(baseEnv);

      expect(doc['@context']).toContain('https://www.w3.org/ns/did/v1');
      expect(doc.id).toBe('did:web:magazine.example');
      expect(doc.verificationMethod[0].type).toBe('JsonWebKey2020');
      expect(doc.verificationMethod[0].publicKeyJwk.kty).toBe('OKP');
      expect(doc.verificationMethod[0].publicKeyJwk.crv).toBe('Ed25519');
      expect(doc.verificationMethod[0].publicKeyJwk.x).toBeTruthy();
      expect(doc.authentication).toContain('did:web:magazine.example#main');
      expect(doc.service![0].type).toBe('ColophonyFederation');
    });

    it('throws FederationDisabledError when not enabled', async () => {
      const { federationService, FederationDisabledError } =
        await import('./federation.service.js');

      const disabledConfig = {
        id: 'cfg-id',
        publicKey: testKeypair.publicKey,
        privateKey: testKeypair.privateKey,
        keyId: 'magazine.example#main',
        mode: 'allowlist' as const,
        contactEmail: null,
        capabilities: ['identity'],
        enabled: false,
      };

      dbModule.db.select.mockReturnValueOnce(mockSelectChain([disabledConfig]));

      await expect(
        federationService.getInstanceDidDocument(baseEnv),
      ).rejects.toThrow(FederationDisabledError);
    });
  });

  describe('getUserDidDocument', () => {
    const enabledConfig = {
      id: 'cfg-id',
      publicKey: testKeypair.publicKey,
      privateKey: testKeypair.privateKey,
      keyId: 'magazine.example#main',
      mode: 'allowlist' as const,
      contactEmail: null,
      capabilities: ['identity'],
      enabled: true,
    };

    it('returns valid DID document for existing user', async () => {
      const { federationService } = await import('./federation.service.js');

      dbModule.db.select
        // getOrInitConfig
        .mockReturnValueOnce(mockSelectChain([enabledConfig]))
        // getUserDidDocument -> user lookup
        .mockReturnValueOnce(
          mockSelectChain([{ id: 'user-1', deletedAt: null, isGuest: false }]),
        )
        // getOrCreateUserKeypair -> existing keypair lookup
        .mockReturnValueOnce(
          mockSelectChain([
            {
              publicKey: testKeypair.publicKey,
              keyId: 'did:web:magazine.example:users:user-1#key-1',
            },
          ]),
        );

      const doc = await federationService.getUserDidDocument(baseEnv, 'alice');

      expect(doc.id).toBe('did:web:magazine.example:users:alice');
      expect(doc.verificationMethod[0].publicKeyJwk.kty).toBe('OKP');
      expect(doc.service![0].type).toBe('ColophonySubmitter');
    });

    it('lazily generates keypair on first request', async () => {
      const { federationService } = await import('./federation.service.js');

      dbModule.db.select
        // getOrInitConfig
        .mockReturnValueOnce(mockSelectChain([enabledConfig]))
        // user lookup
        .mockReturnValueOnce(
          mockSelectChain([{ id: 'user-1', deletedAt: null, isGuest: false }]),
        )
        // getOrCreateUserKeypair -> no existing keypair
        .mockReturnValueOnce(mockSelectChain([]))
        // read-back after insert
        .mockReturnValueOnce(
          mockSelectChain([
            {
              publicKey: testKeypair.publicKey,
              keyId: 'did:web:magazine.example:users:user-1#key-1',
            },
          ]),
        );

      dbModule.db.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue({ rowCount: 1 }),
        }),
      });

      const doc = await federationService.getUserDidDocument(baseEnv, 'alice');

      expect(doc.verificationMethod[0].publicKeyJwk.kty).toBe('OKP');
      expect(cryptoModule.default.generateKeyPairSync).toHaveBeenCalledWith(
        'ed25519',
        expect.any(Object),
      );
    });

    it('handles concurrent keypair generation race', async () => {
      const { federationService } = await import('./federation.service.js');

      dbModule.db.select
        // getOrCreateUserKeypair -> no existing keypair
        .mockReturnValueOnce(mockSelectChain([]))
        // read-back after INSERT ON CONFLICT returns other process's keypair
        .mockReturnValueOnce(
          mockSelectChain([
            {
              publicKey: 'other-process-pub-key',
              keyId: 'other-process-key-id',
            },
          ]),
        );

      dbModule.db.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue({ rowCount: 0 }),
        }),
      });

      const result = await federationService.getOrCreateUserKeypair(
        'user-1',
        'magazine.example',
        'alice',
      );

      expect(result.publicKey).toBe('other-process-pub-key');
    });

    it('throws UserDidNotFoundError for unknown user', async () => {
      const { federationService, UserDidNotFoundError } =
        await import('./federation.service.js');

      dbModule.db.select
        .mockReturnValueOnce(mockSelectChain([enabledConfig]))
        .mockReturnValueOnce(mockSelectChain([]));

      await expect(
        federationService.getUserDidDocument(baseEnv, 'nobody'),
      ).rejects.toThrow(UserDidNotFoundError);
    });

    it('throws UserDidNotFoundError for deleted user', async () => {
      const { federationService, UserDidNotFoundError } =
        await import('./federation.service.js');

      // The query filters out deleted users, so empty result is returned
      dbModule.db.select
        .mockReturnValueOnce(mockSelectChain([enabledConfig]))
        .mockReturnValueOnce(mockSelectChain([]));

      await expect(
        federationService.getUserDidDocument(baseEnv, 'deleted-user'),
      ).rejects.toThrow(UserDidNotFoundError);
    });

    it('throws UserDidNotFoundError for guest user', async () => {
      const { federationService, UserDidNotFoundError } =
        await import('./federation.service.js');

      // The query filters out guest users, so empty result is returned
      dbModule.db.select
        .mockReturnValueOnce(mockSelectChain([enabledConfig]))
        .mockReturnValueOnce(mockSelectChain([]));

      await expect(
        federationService.getUserDidDocument(baseEnv, 'guest-user'),
      ).rejects.toThrow(UserDidNotFoundError);
    });

    it('DID document never contains private key material', async () => {
      const { federationService } = await import('./federation.service.js');

      dbModule.db.select
        .mockReturnValueOnce(mockSelectChain([enabledConfig]))
        .mockReturnValueOnce(
          mockSelectChain([{ id: 'user-1', deletedAt: null, isGuest: false }]),
        )
        .mockReturnValueOnce(
          mockSelectChain([
            {
              publicKey: testKeypair.publicKey,
              keyId: 'did:web:magazine.example:users:user-1#key-1',
            },
          ]),
        );

      const doc = await federationService.getUserDidDocument(baseEnv, 'alice');

      const serialized = JSON.stringify(doc);
      expect(serialized).not.toContain('PRIVATE');
      expect(serialized).not.toContain(testKeypair.privateKey);
    });
  });

  describe('domainToDid', () => {
    it('encodes port as %3A', async () => {
      const { federationService } = await import('./federation.service.js');

      const configRow = {
        id: 'cfg-id',
        publicKey: testKeypair.publicKey,
        privateKey: testKeypair.privateKey,
        keyId: 'localhost:4000#main',
        mode: 'allowlist' as const,
        contactEmail: null,
        capabilities: ['identity'],
        enabled: true,
      };

      dbModule.db.select.mockReturnValueOnce(mockSelectChain([configRow]));

      const envWithPort: Env = {
        ...baseEnv,
        FEDERATION_DOMAIN: 'localhost:4000',
      };

      const doc = await federationService.getInstanceDidDocument(envWithPort);

      expect(doc.id).toBe('did:web:localhost%3A4000');
    });

    it('passes through portless domain unchanged', async () => {
      const { federationService } = await import('./federation.service.js');

      const configRow = {
        id: 'cfg-id',
        publicKey: testKeypair.publicKey,
        privateKey: testKeypair.privateKey,
        keyId: 'magazine.example#main',
        mode: 'allowlist' as const,
        contactEmail: null,
        capabilities: ['identity'],
        enabled: true,
      };

      dbModule.db.select.mockReturnValueOnce(mockSelectChain([configRow]));

      const doc = await federationService.getInstanceDidDocument(baseEnv);

      expect(doc.id).toBe('did:web:magazine.example');
    });
  });

  describe('pemToJwk', () => {
    it('correctly converts Ed25519 PEM to JWK', async () => {
      const { federationService } = await import('./federation.service.js');

      const configRow = {
        id: 'cfg-id',
        publicKey: testKeypair.publicKey,
        privateKey: testKeypair.privateKey,
        keyId: 'magazine.example#main',
        mode: 'allowlist' as const,
        contactEmail: null,
        capabilities: ['identity'],
        enabled: true,
      };

      dbModule.db.select.mockReturnValueOnce(mockSelectChain([configRow]));

      const doc = await federationService.getInstanceDidDocument(baseEnv);
      const jwk = doc.verificationMethod[0].publicKeyJwk;

      expect(jwk.kty).toBe('OKP');
      expect(jwk.crv).toBe('Ed25519');
      expect(typeof jwk.x).toBe('string');
      expect(jwk.x.length).toBeGreaterThan(0);
    });
  });
});
