import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

// Generate real keypair before mocks take effect
const testKeypair = crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let dbSelectResult: unknown[] = [];
const mockWithRls = vi.fn();

vi.mock('@colophony/db', () => ({
  db: {
    select: () => ({
      from: () =>
        Object.assign(Promise.resolve(dbSelectResult), {
          where: () =>
            Object.assign(Promise.resolve(dbSelectResult), {
              limit: () => Promise.resolve(dbSelectResult),
            }),
          limit: () => Promise.resolve(dbSelectResult),
        }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
  },
  withRls: (...args: unknown[]) => mockWithRls(...args),
  federationConfig: {
    id: 'id',
    hubAttestationToken: 'hub_attestation_token',
    hubAttestationExpiresAt: 'hub_attestation_expires_at',
    hubDomain: 'hub_domain',
  },
  trustedPeers: {
    id: 'id',
    domain: 'domain',
    organizationId: 'organization_id',
  },
  eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
}));

const mockGetOrInitConfig = vi.fn();
const mockGetPublicConfig = vi.fn();
vi.mock('./federation.service.js', () => ({
  federationService: {
    getOrInitConfig: (...args: unknown[]) => mockGetOrInitConfig(...args),
    getPublicConfig: (...args: unknown[]) => mockGetPublicConfig(...args),
  },
}));

const mockAuditLog = vi.fn().mockResolvedValue(undefined);
vi.mock('./audit.service.js', () => ({
  auditService: {
    log: (...args: unknown[]) => mockAuditLog(...args),
    logDirect: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockSignFederationRequest = vi.fn();
vi.mock('../federation/http-signatures.js', () => ({
  signFederationRequest: (...args: unknown[]) =>
    mockSignFederationRequest(...args),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockTx(opts: {
  selectResult?: unknown[];
  insertResult?: unknown[];
}) {
  return {
    select: () => ({
      from: () => {
        const arr = opts.selectResult ?? [];
        return Object.assign(Promise.resolve(arr), {
          where: () =>
            Object.assign(Promise.resolve(arr), {
              limit: () => Promise.resolve(arr),
            }),
        });
      },
    }),
    insert: () => ({
      values: () =>
        Object.assign(Promise.resolve(), {
          returning: () => Promise.resolve(opts.insertResult ?? []),
        }),
    }),
  };
}

const baseEnv = {
  DATABASE_URL: 'postgresql://localhost/test',
  DB_SSL: 'false' as const,
  DB_ADMIN_POOL_MAX: 5,
  DB_APP_POOL_MAX: 20,
  PORT: 4000,
  HOST: '0.0.0.0',
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_PASSWORD: '',
  FEDERATION_ENABLED: true,
  FEDERATION_DOMAIN: 'local.example.com',
  HUB_DOMAIN: 'hub.example.com',
  HUB_REGISTRATION_TOKEN: 'test-secret-token',
  NODE_ENV: 'test',
} as any;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('hub-client.service', () => {
  let hubClientService: (typeof import('./hub-client.service.js'))['hubClientService'];

  beforeEach(async () => {
    vi.clearAllMocks();
    dbSelectResult = [];
    const mod = await import('./hub-client.service.js');
    hubClientService = mod.hubClientService;
  });

  describe('registerWithHub', () => {
    it('registers with hub on startup', async () => {
      mockGetPublicConfig.mockResolvedValueOnce({
        publicKey: testKeypair.publicKey,
        keyId: 'local.example.com#main',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          instanceId: 'a0000000-0000-4000-8000-000000000001',
          attestationToken: 'jwt-token',
          attestationExpiresAt: '2026-03-25T00:00:00Z',
          hubDomain: 'hub.example.com',
          hubPublicKey: testKeypair.publicKey,
        }),
      });

      // Mock for db.select().from(federationConfig)
      dbSelectResult = [
        {
          id: '00000000-0000-0000-0000-000000000099',
        },
      ];

      await hubClientService.registerWithHub(baseEnv);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://hub.example.com/federation/v1/hub/register',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('stores hub attestation after registration', async () => {
      mockGetPublicConfig.mockResolvedValueOnce({
        publicKey: testKeypair.publicKey,
        keyId: 'local.example.com#main',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          instanceId: 'a0000000-0000-4000-8000-000000000001',
          attestationToken: 'jwt-token',
          attestationExpiresAt: '2026-03-25T00:00:00Z',
          hubDomain: 'hub.example.com',
          hubPublicKey: testKeypair.publicKey,
        }),
      });

      dbSelectResult = [{ id: '00000000-0000-0000-0000-000000000099' }];

      await hubClientService.registerWithHub(baseEnv);

      // Verify fetch was called (registration happened)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('pushFingerprint', () => {
    it('pushes fingerprint to hub', async () => {
      mockGetOrInitConfig.mockResolvedValueOnce({
        publicKey: testKeypair.publicKey,
        privateKey: testKeypair.privateKey,
        keyId: 'local.example.com#main',
      });

      mockSignFederationRequest.mockReturnValueOnce({
        headers: { signature: 'test', 'signature-input': 'test' },
      });

      mockFetch.mockResolvedValueOnce({ ok: true });

      await hubClientService.pushFingerprint(baseEnv, {
        fingerprint: 'abc123',
        submitterDid: 'did:web:local.example.com:users:alice',
        submittedAt: '2026-01-01T00:00:00Z',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://hub.example.com/federation/v1/hub/fingerprints/register',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('queryHubFingerprints', () => {
    it('queries hub fingerprints and parses response', async () => {
      mockGetOrInitConfig.mockResolvedValueOnce({
        publicKey: testKeypair.publicKey,
        privateKey: testKeypair.privateKey,
        keyId: 'local.example.com#main',
      });

      mockSignFederationRequest.mockReturnValueOnce({
        headers: { signature: 'test', 'signature-input': 'test' },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          found: true,
          conflicts: [
            {
              sourceDomain: 'other.example.com',
              publicationName: 'Test Pub',
              submittedAt: '2026-01-01T00:00:00Z',
            },
          ],
        }),
      });

      const result = await hubClientService.queryHubFingerprints(
        baseEnv,
        'abc123',
        'did:web:local.example.com:users:alice',
      );

      expect(result).not.toBeNull();
      expect(result!.found).toBe(true);
      expect(result!.conflicts).toHaveLength(1);
    });

    it('returns null on hub unreachable', async () => {
      mockGetOrInitConfig.mockResolvedValueOnce({
        publicKey: testKeypair.publicKey,
        privateKey: testKeypair.privateKey,
        keyId: 'local.example.com#main',
      });

      mockSignFederationRequest.mockReturnValueOnce({
        headers: { signature: 'test', 'signature-input': 'test' },
      });

      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await hubClientService.queryHubFingerprints(
        baseEnv,
        'abc123',
        'did:web:local.example.com:users:alice',
      );

      expect(result).toBeNull();
    });
  });

  describe('initiateHubAttestedTrust', () => {
    it('initiates hub-attested trust with peer', async () => {
      mockGetOrInitConfig.mockResolvedValueOnce({
        publicKey: testKeypair.publicKey,
        privateKey: testKeypair.privateKey,
        keyId: 'local.example.com#main',
      });

      dbSelectResult = [
        {
          id: '00000000-0000-0000-0000-000000000099',
          hubAttestationToken: 'jwt-token',
          hubDomain: 'hub.example.com',
        },
      ];

      mockSignFederationRequest.mockReturnValueOnce({
        headers: { signature: 'test', 'signature-input': 'test' },
      });

      mockFetch.mockResolvedValueOnce({ ok: true });

      const peerRow = {
        id: '00000000-0000-0000-0000-000000000002',
        organizationId: '00000000-0000-0000-0000-000000000010',
        domain: 'target.example.com',
        instanceUrl: 'https://target.example.com',
        publicKey: '',
        keyId: '',
        grantedCapabilities: {},
        status: 'active',
        initiatedBy: 'local',
        hubAttested: true,
        protocolVersion: '1.0',
        lastVerifiedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockWithRls.mockImplementation(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
          fn(makeMockTx({ insertResult: [peerRow] })),
      );

      const result = await hubClientService.initiateHubAttestedTrust(
        baseEnv,
        '00000000-0000-0000-0000-000000000010',
        'target.example.com',
        'user-id',
      );

      expect(result.domain).toBe('target.example.com');
      expect(result.status).toBe('active');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://target.example.com/federation/trust/hub-attested',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
