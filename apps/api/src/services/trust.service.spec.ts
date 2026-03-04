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
const mockGetPublicConfig = vi.fn();
vi.mock('./federation.service.js', () => ({
  federationService: {
    getOrInitConfig: (...args: unknown[]) => mockGetOrInitConfig(...args),
    getPublicConfig: (...args: unknown[]) => mockGetPublicConfig(...args),
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

// Mock dns.promises — SSRF checks are skipped in test but we still mock for explicitness
vi.mock('node:dns', () => ({
  default: {
    promises: {
      resolve4: vi.fn().mockResolvedValue(['93.184.216.34']),
      resolve6: vi.fn().mockResolvedValue([]),
    },
  },
}));

/**
 * Create a mock Response object compatible with fetchAndValidateMetadata's
 * streaming body reader. Falls back to text() when body is null.
 */
function mockFetchResponse(json: unknown, opts: { ok?: boolean } = {}) {
  const bodyText = JSON.stringify(json);
  return {
    ok: opts.ok ?? true,
    status: opts.ok === false ? 500 : 200,
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === 'content-length')
          return String(bodyText.length);
        return null;
      },
    },
    body: null, // No streaming body — will use text() fallback
    text: async () => bodyText,
  };
}

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
          limit: () => Promise.resolve(arr),
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
    // Restore DNS mock defaults cleared by clearAllMocks
    const dnsModule = await import('node:dns');
    vi.spyOn(dnsModule.default.promises, 'resolve4').mockResolvedValue([
      '93.184.216.34',
    ]);
    vi.spyOn(dnsModule.default.promises, 'resolve6').mockResolvedValue([]);
    const mod = await import('./trust.service.js');
    trustService = mod.trustService;
  });

  describe('fetchRemoteMetadata', () => {
    it('returns preview for valid domain', async () => {
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(sampleMetadataResponse),
      );

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
      mockFetch.mockResolvedValueOnce(mockFetchResponse({ invalid: true }));

      await expect(
        trustService.fetchRemoteMetadata('bad.example.com'),
      ).rejects.toThrow('Failed to fetch metadata');
    });

    it('rejects domain mismatch', async () => {
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({
          ...sampleMetadataResponse,
          domain: 'evil.example.com',
        }),
      );

      await expect(
        trustService.fetchRemoteMetadata('good.example.com'),
      ).rejects.toThrow('Failed to fetch metadata');
    });

    it('rejects oversized response', async () => {
      const oversizedBody = JSON.stringify(sampleMetadataResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => {
            if (name.toLowerCase() === 'content-length') return '2000000';
            return null;
          },
        },
        body: null,
        text: async () => oversizedBody,
      });

      await expect(
        trustService.fetchRemoteMetadata('remote.example.com'),
      ).rejects.toThrow('Failed to fetch metadata');
    });

    it('rejects redirects', async () => {
      // redirect: 'error' causes fetch to throw on redirect
      mockFetch.mockRejectedValueOnce(new TypeError('redirect mode is error'));

      await expect(
        trustService.fetchRemoteMetadata('redirect.example.com'),
      ).rejects.toThrow('Failed to fetch metadata');
    });
  });

  describe('initiateTrust', () => {
    it('creates pending_outbound peer and sends POST', async () => {
      mockFetch
        .mockResolvedValueOnce(mockFetchResponse(sampleMetadataResponse))
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
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(sampleMetadataResponse),
      );

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
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(sampleMetadataResponse),
      );

      mockVerifyFederationSignature.mockResolvedValueOnce({
        valid: true,
        keyId: 'remote.example.com#main',
      });

      // Allowlist mode — should create pending_inbound
      mockGetPublicConfig.mockResolvedValueOnce({ mode: 'allowlist' });

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
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(sampleMetadataResponse),
      );

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

    it('auto-accepts inbound trust in open mode', async () => {
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(sampleMetadataResponse),
      );

      mockVerifyFederationSignature.mockResolvedValueOnce({
        valid: true,
        keyId: 'remote.example.com#main',
      });

      // Open mode — should auto-accept
      mockGetPublicConfig.mockResolvedValueOnce({ mode: 'open' });

      dbSelectResult = [{ id: '00000000-0000-0000-0000-000000000010' }];

      const mockTx = makeMockTx({ selectResult: [], insertResult: [] });
      setupWithRls(mockTx);

      const result = await trustService.handleInboundTrustRequest(
        baseEnv,
        {
          instanceUrl: 'https://remote.example.com',
          domain: 'remote.example.com',
          publicKey: testKeypair.publicKey,
          keyId: 'remote.example.com#main',
          requestedCapabilities: { 'simsub.check': true },
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

      // Verify audit logged auto-accept (not pending_inbound)
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'FEDERATION_TRUST_AUTO_ACCEPTED',
        }),
      );
    });

    it('creates pending_inbound in allowlist mode', async () => {
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(sampleMetadataResponse),
      );

      mockVerifyFederationSignature.mockResolvedValueOnce({
        valid: true,
        keyId: 'remote.example.com#main',
      });

      // Explicit allowlist mode
      mockGetPublicConfig.mockResolvedValueOnce({ mode: 'allowlist' });

      dbSelectResult = [{ id: '00000000-0000-0000-0000-000000000010' }];

      const mockTx = makeMockTx({ selectResult: [], insertResult: [] });
      setupWithRls(mockTx);

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

      // Verify audit logged standard trust received (not auto-accepted)
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'FEDERATION_TRUST_RECEIVED',
        }),
      );
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

  describe('handleHubAttestedTrust', () => {
    const hubKeypair = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const instanceKeypair = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    async function makeAttestation(opts?: {
      iss?: string;
      sub?: string;
      aud?: string;
      exp?: number;
      instancePublicKey?: string;
    }) {
      const { SignJWT } = await import('jose');
      const privKey = crypto.createPrivateKey(hubKeypair.privateKey);
      return new SignJWT({
        instancePublicKey: opts?.instancePublicKey ?? instanceKeypair.publicKey,
        instanceKeyId: 'peer.example.com#main',
      })
        .setProtectedHeader({ alg: 'EdDSA' })
        .setIssuer(opts?.iss ?? 'hub.example.com')
        .setSubject(opts?.sub ?? 'peer.example.com')
        .setAudience(opts?.aud ?? 'colophony:managed-hub')
        .setIssuedAt()
        .setExpirationTime(opts?.exp ?? Math.floor(Date.now() / 1000) + 3600)
        .sign(privKey);
    }

    const baseHubRequest = {
      instanceUrl: 'https://peer.example.com',
      domain: 'peer.example.com',
      publicKey: instanceKeypair.publicKey,
      keyId: 'peer.example.com#main',
      hubDomain: 'hub.example.com',
      requestedCapabilities: { 'identity.verify': true },
      protocolVersion: '1.0',
    };

    it('creates active peers for all non-opted-out orgs', async () => {
      const token = await makeAttestation();

      // Mock hub metadata fetch
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({
          ...sampleMetadataResponse,
          domain: 'hub.example.com',
          publicKey: hubKeypair.publicKey,
          keyId: 'hub.example.com#main',
        }),
      );

      // Mock org query — two orgs, both opted in
      dbSelectResult = [
        { id: 'a0000000-0000-4000-8000-000000000001' },
        { id: 'a0000000-0000-4000-8000-000000000002' },
      ];

      // Mock withRls for each org — no existing peer
      setupWithRls(makeMockTx({ selectResult: [], insertResult: [] }));

      const result = await trustService.handleHubAttestedTrust(baseEnv, {
        ...baseHubRequest,
        attestationToken: token,
      });

      expect(result.orgIds).toHaveLength(2);
      expect(result.orgIds).toContain('a0000000-0000-4000-8000-000000000001');
      expect(result.orgIds).toContain('a0000000-0000-4000-8000-000000000002');
      expect(mockAuditLog).toHaveBeenCalledTimes(2);
    });

    it('rejects invalid attestation JWT', async () => {
      // Mock hub metadata fetch
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({
          ...sampleMetadataResponse,
          domain: 'hub.example.com',
          publicKey: hubKeypair.publicKey,
          keyId: 'hub.example.com#main',
        }),
      );

      await expect(
        trustService.handleHubAttestedTrust(baseEnv, {
          ...baseHubRequest,
          attestationToken: 'not.a.valid.jwt',
        }),
      ).rejects.toThrow('Attestation JWT verification failed');
    });

    it('rejects expired attestation', async () => {
      const token = await makeAttestation({
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      });

      // Mock hub metadata fetch
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({
          ...sampleMetadataResponse,
          domain: 'hub.example.com',
          publicKey: hubKeypair.publicKey,
          keyId: 'hub.example.com#main',
        }),
      );

      await expect(
        trustService.handleHubAttestedTrust(baseEnv, {
          ...baseHubRequest,
          attestationToken: token,
        }),
      ).rejects.toThrow('Attestation JWT verification failed');
    });

    it('rejects attestation from unconfigured hub', async () => {
      const envWithHub = { ...baseEnv, HUB_DOMAIN: 'myhub.example.com' };

      await expect(
        trustService.handleHubAttestedTrust(envWithHub, {
          ...baseHubRequest,
          attestationToken: 'unused',
          hubDomain: 'evil.example.com',
        }),
      ).rejects.toThrow('Untrusted hub domain');
    });
  });

  describe('SSRF protection', () => {
    it('rejects private IPv4 in production', async () => {
      const dnsModule = await import('node:dns');
      vi.spyOn(dnsModule.default.promises, 'resolve4').mockResolvedValueOnce([
        '192.168.1.1',
      ]);

      // Temporarily set NODE_ENV to production for this test
      const original = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        await expect(
          trustService.fetchRemoteMetadata('internal.example.com'),
        ).rejects.toThrow('Failed to fetch metadata');
      } finally {
        process.env.NODE_ENV = original;
      }
    });

    it('rejects private IPv6 in production', async () => {
      const dnsModule = await import('node:dns');
      vi.spyOn(dnsModule.default.promises, 'resolve4').mockResolvedValueOnce(
        [],
      );
      vi.spyOn(dnsModule.default.promises, 'resolve6').mockResolvedValueOnce([
        '::1',
      ]);

      const original = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        await expect(
          trustService.fetchRemoteMetadata('loopback.example.com'),
        ).rejects.toThrow('Failed to fetch metadata');
      } finally {
        process.env.NODE_ENV = original;
      }
    });

    it('rejects localhost (127.0.0.1) in production', async () => {
      const dnsModule = await import('node:dns');
      vi.spyOn(dnsModule.default.promises, 'resolve4').mockResolvedValueOnce([
        '127.0.0.1',
      ]);

      const original = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        await expect(
          trustService.fetchRemoteMetadata('localhost.example.com'),
        ).rejects.toThrow('Failed to fetch metadata');
      } finally {
        process.env.NODE_ENV = original;
      }
    });

    it('skips SSRF check in development', async () => {
      const dnsModule = await import('node:dns');
      vi.spyOn(dnsModule.default.promises, 'resolve4').mockResolvedValueOnce([
        '192.168.1.1',
      ]);

      const original = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      try {
        // Should proceed to fetch (which will fail on network, not SSRF)
        mockFetch.mockResolvedValueOnce(
          mockFetchResponse(sampleMetadataResponse),
        );

        const result =
          await trustService.fetchRemoteMetadata('remote.example.com');
        expect(result.domain).toBe('remote.example.com');
      } finally {
        process.env.NODE_ENV = original;
      }
    });
  });

  describe('handleInboundTrustRequest domain mismatch', () => {
    it('rejects domain mismatch in metadata', async () => {
      // Metadata fetch returns mismatched domain
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({
          ...sampleMetadataResponse,
          domain: 'evil.example.com',
        }),
      );

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
          { signature: 'test', 'signature-input': 'test' },
          'POST',
          'https://local.example.com/federation/trust',
          '{}',
        ),
      ).rejects.toThrow('Cannot verify remote identity');
    });
  });

  describe('handleHubAttestedTrust domain mismatch', () => {
    const hubKeypairForMismatch = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    it('rejects hub domain mismatch in metadata', async () => {
      // Hub metadata returns mismatched domain
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({
          ...sampleMetadataResponse,
          domain: 'wrong-hub.example.com',
          publicKey: hubKeypairForMismatch.publicKey,
          keyId: 'wrong-hub.example.com#main',
        }),
      );

      await expect(
        trustService.handleHubAttestedTrust(baseEnv, {
          instanceUrl: 'https://peer.example.com',
          domain: 'peer.example.com',
          publicKey: testKeypair.publicKey,
          keyId: 'peer.example.com#main',
          hubDomain: 'hub.example.com',
          attestationToken: 'unused',
          requestedCapabilities: {},
          protocolVersion: '1.0',
        }),
      ).rejects.toThrow('Cannot fetch hub metadata');
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
