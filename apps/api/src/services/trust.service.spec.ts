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

const mockWithRls = vi.fn();
let dbSelectResult: unknown[] = [];

vi.mock('@colophony/db', () => ({
  db: {
    select: () => ({
      from: () => {
        // Returns a thenable that also has .where() and .limit()

        const result: any = Object.assign([] as unknown[], {
          where: () => {
            const whereResult = Object.assign(Promise.resolve(dbSelectResult), {
              limit: () => Promise.resolve(dbSelectResult),
            });
            return whereResult;
          },
          then: (resolve: (v: unknown[]) => void) =>
            Promise.resolve(dbSelectResult).then(resolve),
        });
        return result;
      },
    }),
  },
  withRls: (...args: unknown[]) => mockWithRls(...args),
  trustedPeers: {
    id: 'id',
    domain: 'domain',
    status: 'status',
    organizationId: 'organization_id',
    publicKey: 'public_key',
  },
  organizations: { id: 'id', federationOptedOut: 'federation_opted_out' },
  eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  sql: vi.fn(),
}));

const mockAuditLog = vi.fn().mockResolvedValue(undefined);
vi.mock('./audit.service.js', () => ({
  auditService: {
    log: (...args: unknown[]) => mockAuditLog(...args),
    logDirect: vi.fn(),
  },
}));

const mockGetOrInitConfig = vi.fn();
vi.mock('./federation.service.js', () => ({
  federationService: {
    getOrInitConfig: (...args: unknown[]) => mockGetOrInitConfig(...args),
  },
}));

const mockSignFederationRequest = vi.fn();
const mockVerifyFederationSignature = vi.fn();
vi.mock('../federation/http-signatures.js', () => ({
  signFederationRequest: (...args: unknown[]) =>
    mockSignFederationRequest(...args),
  verifyFederationSignature: (...args: unknown[]) =>
    mockVerifyFederationSignature(...args),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockTx(opts: {
  selectResult?: unknown[];
  insertResult?: unknown[];
  updateResult?: unknown[];
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
    update: () => ({
      set: () => ({
        where: () =>
          Object.assign(Promise.resolve(), {
            returning: () => Promise.resolve(opts.updateResult ?? []),
          }),
      }),
    }),
  };
}

function setupWithRls(tx: unknown) {
  mockWithRls.mockImplementation(
    async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(tx),
  );
}

const baseEnv = {
  DATABASE_URL: 'postgresql://localhost/test',
  PORT: 4000,
  HOST: '0.0.0.0',
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_PASSWORD: '',
  FEDERATION_ENABLED: true,
  FEDERATION_DOMAIN: 'local.example.com',
  NODE_ENV: 'test',
} as any;

const samplePeerRow = {
  id: '00000000-0000-0000-0000-000000000001',
  organizationId: '00000000-0000-0000-0000-000000000010',
  domain: 'remote.example.com',
  instanceUrl: 'https://remote.example.com',
  publicKey: testKeypair.publicKey,
  keyId: 'remote.example.com#main',
  grantedCapabilities: {},
  status: 'pending_outbound' as const,
  initiatedBy: 'local',
  protocolVersion: '1.0',
  lastVerifiedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sampleMetadataResponse = {
  software: 'colophony',
  version: '2.0.0-dev',
  domain: 'remote.example.com',
  publicKey: testKeypair.publicKey,
  keyId: 'remote.example.com#main',
  capabilities: ['identity'],
  mode: 'allowlist',
  contactEmail: null,
  publications: [
    {
      id: '10000000-0000-4000-a000-000000000099',
      name: 'Test Pub',
      slug: 'test-pub',
      organizationSlug: 'test-org',
    },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('trust.service', () => {
  let trustService: (typeof import('./trust.service.js'))['trustService'];

  beforeEach(async () => {
    vi.clearAllMocks();
    mockAuditLog.mockResolvedValue(undefined);
    dbSelectResult = [];
    const mod = await import('./trust.service.js');
    trustService = mod.trustService;
  });

  describe('fetchRemoteMetadata', () => {
    it('returns preview for valid domain', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sampleMetadataResponse,
      });

      const result =
        await trustService.fetchRemoteMetadata('remote.example.com');

      expect(result.domain).toBe('remote.example.com');
      expect(result.software).toBe('colophony');
      expect(result.publicationCount).toBe(1);
    });

    it('throws on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        trustService.fetchRemoteMetadata('unreachable.example.com'),
      ).rejects.toThrow('Failed to fetch metadata');
    });

    it('throws on invalid response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: true }),
      });

      await expect(
        trustService.fetchRemoteMetadata('bad.example.com'),
      ).rejects.toThrow('Failed to fetch metadata');
    });
  });

  describe('initiateTrust', () => {
    it('creates pending_outbound peer and sends POST', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => sampleMetadataResponse,
        })
        .mockResolvedValueOnce({ ok: true });

      mockGetOrInitConfig.mockResolvedValueOnce({
        publicKey: testKeypair.publicKey,
        privateKey: testKeypair.privateKey,
        keyId: 'local.example.com#main',
      });

      mockSignFederationRequest.mockReturnValueOnce({
        headers: { 'content-type': 'application/json', signature: 'test' },
      });

      setupWithRls(
        makeMockTx({
          selectResult: [],
          insertResult: [samplePeerRow],
        }),
      );

      const result = await trustService.initiateTrust(
        baseEnv,
        '00000000-0000-0000-0000-000000000010',
        { domain: 'remote.example.com', requestedCapabilities: {} },
        '00000000-0000-0000-0000-000000000020',
      );

      expect(result.domain).toBe('remote.example.com');
      expect(result.status).toBe('pending_outbound');
      expect(mockAuditLog).toHaveBeenCalled();
    });

    it('throws for duplicate domain', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sampleMetadataResponse,
      });

      mockGetOrInitConfig.mockResolvedValueOnce({
        publicKey: testKeypair.publicKey,
        privateKey: testKeypair.privateKey,
        keyId: 'local.example.com#main',
      });

      setupWithRls(makeMockTx({ selectResult: [samplePeerRow] }));

      await expect(
        trustService.initiateTrust(
          baseEnv,
          '00000000-0000-0000-0000-000000000010',
          { domain: 'remote.example.com', requestedCapabilities: {} },
          '00000000-0000-0000-0000-000000000020',
        ),
      ).rejects.toThrow('already exists');
    });
  });

  describe('handleInboundTrustRequest', () => {
    it('verifies signature and creates pending_inbound peers', async () => {
      // Mock remote metadata fetch for key validation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sampleMetadataResponse,
      });

      mockVerifyFederationSignature.mockResolvedValueOnce({
        valid: true,
        keyId: 'remote.example.com#main',
      });

      dbSelectResult = [{ id: '00000000-0000-0000-0000-000000000010' }];

      setupWithRls(makeMockTx({ selectResult: [], insertResult: [] }));

      const result = await trustService.handleInboundTrustRequest(
        baseEnv,
        {
          instanceUrl: 'https://remote.example.com',
          domain: 'remote.example.com',
          publicKey: testKeypair.publicKey,
          keyId: 'remote.example.com#main',
          requestedCapabilities: {},
          protocolVersion: '1.0',
        },
        {
          signature: 'test',
          'signature-input': 'test',
          date: new Date().toUTCString(),
        },
        'POST',
        'https://local.example.com/federation/trust',
        '{}',
      );

      expect(result.orgIds).toContain('00000000-0000-0000-0000-000000000010');
      expect(mockVerifyFederationSignature).toHaveBeenCalled();
    });

    it('rejects invalid signature', async () => {
      // Mock remote metadata fetch for key validation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => sampleMetadataResponse,
      });

      mockVerifyFederationSignature.mockResolvedValueOnce({
        valid: false,
        keyId: 'remote.example.com#main',
      });

      await expect(
        trustService.handleInboundTrustRequest(
          baseEnv,
          {
            instanceUrl: 'https://remote.example.com',
            domain: 'remote.example.com',
            publicKey: testKeypair.publicKey,
            keyId: 'remote.example.com#main',
            requestedCapabilities: {},
            protocolVersion: '1.0',
          },
          { signature: 'bad', 'signature-input': 'bad' },
          'POST',
          'https://local.example.com/federation/trust',
          '{}',
        ),
      ).rejects.toThrow('Signature verification failed');
    });
  });

  describe('acceptInboundTrust', () => {
    it('transitions pending_inbound to active', async () => {
      const inboundPeer = {
        ...samplePeerRow,
        status: 'pending_inbound' as const,
        initiatedBy: 'remote',
      };
      const activePeer = { ...inboundPeer, status: 'active' as const };

      mockGetOrInitConfig.mockResolvedValueOnce({
        publicKey: testKeypair.publicKey,
        privateKey: testKeypair.privateKey,
        keyId: 'local.example.com#main',
      });

      mockSignFederationRequest.mockReturnValueOnce({
        headers: { 'content-type': 'application/json' },
      });

      mockFetch.mockResolvedValueOnce({ ok: true });

      setupWithRls(
        makeMockTx({
          selectResult: [inboundPeer],
          updateResult: [activePeer],
        }),
      );

      const result = await trustService.acceptInboundTrust(
        baseEnv,
        samplePeerRow.organizationId,
        samplePeerRow.id,
        {},
        '00000000-0000-0000-0000-000000000020',
      );

      expect(result.status).toBe('active');
      expect(mockAuditLog).toHaveBeenCalled();
    });

    it('throws for wrong state', async () => {
      mockGetOrInitConfig.mockResolvedValueOnce({
        publicKey: testKeypair.publicKey,
        privateKey: testKeypair.privateKey,
        keyId: 'local.example.com#main',
      });

      setupWithRls(
        makeMockTx({
          selectResult: [{ ...samplePeerRow, status: 'active' }],
        }),
      );

      await expect(
        trustService.acceptInboundTrust(
          baseEnv,
          samplePeerRow.organizationId,
          samplePeerRow.id,
          {},
          '00000000-0000-0000-0000-000000000020',
        ),
      ).rejects.toThrow('Invalid peer state');
    });
  });

  describe('handleInboundTrustAccept', () => {
    it('transitions pending_outbound to active', async () => {
      mockVerifyFederationSignature.mockResolvedValueOnce({
        valid: true,
        keyId: 'remote.example.com#main',
      });

      // db.select returns peers with pending_outbound for key lookup and peer list
      dbSelectResult = [
        {
          id: samplePeerRow.id,
          organizationId: samplePeerRow.organizationId,
          publicKey: testKeypair.publicKey,
        },
      ];

      setupWithRls(makeMockTx({ updateResult: [] }));

      await expect(
        trustService.handleInboundTrustAccept(
          baseEnv,
          {
            instanceUrl: 'https://remote.example.com',
            domain: 'remote.example.com',
            grantedCapabilities: { 'identity.verify': true },
            protocolVersion: '1.0',
          },
          { signature: 'test', 'signature-input': 'test' },
          'POST',
          'https://local.example.com/federation/trust/accept',
          '{}',
        ),
      ).resolves.toBeUndefined();

      expect(mockVerifyFederationSignature).toHaveBeenCalled();
    });
  });

  describe('rejectTrust', () => {
    it('transitions pending_inbound to rejected', async () => {
      const inboundPeer = {
        ...samplePeerRow,
        status: 'pending_inbound' as const,
        initiatedBy: 'remote',
      };
      const rejectedPeer = { ...inboundPeer, status: 'rejected' as const };

      setupWithRls(
        makeMockTx({
          selectResult: [inboundPeer],
          updateResult: [rejectedPeer],
        }),
      );

      const result = await trustService.rejectTrust(
        samplePeerRow.organizationId,
        samplePeerRow.id,
        '00000000-0000-0000-0000-000000000020',
      );

      expect(result.status).toBe('rejected');
      expect(mockAuditLog).toHaveBeenCalled();
    });
  });

  describe('revokeTrust', () => {
    it('transitions active to revoked', async () => {
      const activePeer = { ...samplePeerRow, status: 'active' as const };
      const revokedPeer = { ...activePeer, status: 'revoked' as const };

      setupWithRls(
        makeMockTx({
          selectResult: [activePeer],
          updateResult: [revokedPeer],
        }),
      );

      const result = await trustService.revokeTrust(
        samplePeerRow.organizationId,
        samplePeerRow.id,
        '00000000-0000-0000-0000-000000000020',
      );

      expect(result.status).toBe('revoked');
      expect(mockAuditLog).toHaveBeenCalled();
    });
  });

  describe('listPeers', () => {
    it('returns all peers for org', async () => {
      setupWithRls(makeMockTx({ selectResult: [samplePeerRow] }));

      const result = await trustService.listPeers(samplePeerRow.organizationId);

      expect(result).toHaveLength(1);
      expect(result[0].domain).toBe('remote.example.com');
    });
  });

  describe('getPeerById', () => {
    it('throws for missing peer', async () => {
      setupWithRls(makeMockTx({ selectResult: [] }));

      await expect(
        trustService.getPeerById(
          samplePeerRow.organizationId,
          '00000000-0000-0000-0000-000000000099',
        ),
      ).rejects.toThrow('Trusted peer not found');
    });
  });
});
