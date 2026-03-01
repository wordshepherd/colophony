import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSignRequest = vi.fn().mockReturnValue({
  headers: { signature: 'mock-sig', date: new Date().toUTCString() },
});

vi.mock('@colophony/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue([
          {
            id: 'config-1',
            hubAttestationToken: 'mock-attestation',
            hubDomain: 'hub.example.com',
          },
        ]),
        where: vi.fn().mockReturnValue([{ id: 'org-1' }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
  withRls: vi.fn(),
  federationConfig: {},
  trustedPeers: {},
  organizations: {},
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock('../../federation/http-signatures.js', () => ({
  signFederationRequest: (...args: unknown[]) => mockSignRequest(...args),
}));

vi.mock('../federation.service.js', () => ({
  federationService: {
    getOrInitConfig: vi.fn().mockResolvedValue({
      publicKey: 'PEM-LOCAL-PUBLIC',
      keyId: 'local.example.com#main',
      privateKey: 'PEM-LOCAL-PRIVATE',
    }),
    getPublicConfig: vi.fn().mockResolvedValue({
      publicKey: 'PEM-LOCAL-PUBLIC',
      keyId: 'local.example.com#main',
      mode: 'open',
    }),
  },
}));

vi.mock('../audit.service.js', () => ({
  auditService: { log: vi.fn() },
}));

vi.mock('../../lib/url-validation.js', () => ({
  resolveAndCheckPrivateIp: vi.fn(),
  SsrfValidationError: class extends Error {},
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { hubClientService } from '../../services/hub-client.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HUB_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEHub_Mock_Public_Key_00000000000
0000000000000000000000000000000000000000000000000000000000000Q==
-----END PUBLIC KEY-----`;

const baseEnv = {
  FEDERATION_DOMAIN: 'local.example.com',
  HUB_DOMAIN: 'hub.example.com',
  HUB_REGISTRATION_TOKEN: 'reg-token-123',
} as any;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('hub discovery integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('register → push fingerprint → query → finds conflict', async () => {
    // Step 1: Register with hub
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          instanceId: '550e8400-e29b-41d4-a716-446655440000',
          attestationToken: 'attest-jwt',
          attestationExpiresAt: new Date(Date.now() + 86400_000).toISOString(),
          hubDomain: 'hub.example.com',
          hubPublicKey: HUB_PUBLIC_KEY,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    await hubClientService.registerWithHub(baseEnv);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://hub.example.com/federation/v1/hub/register',
      expect.objectContaining({ method: 'POST' }),
    );

    // Step 2: Push a fingerprint
    mockFetch.mockResolvedValueOnce(new Response('', { status: 202 }));

    await hubClientService.pushFingerprint(baseEnv, {
      fingerprint: 'sha256:abc123',
      submitterDid: 'did:colophony:local.example.com:u:user-1',
      publicationName: 'Test Review',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://hub.example.com/federation/v1/hub/fingerprints/register',
      expect.objectContaining({ method: 'POST' }),
    );

    // Step 3: Query and find conflict
    mockFetch.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            found: true,
            conflicts: [
              {
                sourceDomain: 'other.example.com',
                publicationName: 'Other Journal',
                submittedAt: '2026-02-01T00:00:00Z',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );

    const result = await hubClientService.queryHubFingerprints(
      baseEnv,
      'sha256:abc123',
      'did:colophony:local.example.com:u:user-1',
    );

    expect(result).not.toBeNull();
    expect(result!.found).toBe(true);
    expect(result!.conflicts).toHaveLength(1);
    expect(result!.conflicts[0].sourceDomain).toBe('other.example.com');
  });

  it('graceful degradation when hub is unreachable', async () => {
    mockFetch.mockRejectedValue(new Error('fetch failed'));

    const result = await hubClientService.queryHubFingerprints(
      baseEnv,
      'sha256:abc123',
      'did:colophony:local.example.com:u:user-1',
    );

    expect(result).toBeNull();
  });

  it('hub registration fails with clear error on non-200', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Forbidden', { status: 403 }));

    await expect(hubClientService.registerWithHub(baseEnv)).rejects.toThrow(
      /Hub registration failed: HTTP 403/,
    );
  });

  it('query returns null for non-200 hub response', async () => {
    mockFetch.mockImplementation(
      async () => new Response('Server Error', { status: 500 }),
    );

    const result = await hubClientService.queryHubFingerprints(
      baseEnv,
      'sha256:abc123',
      'did:colophony:local.example.com:u:user-1',
    );

    expect(result).toBeNull();
  });

  it('query returns null for invalid JSON from hub', async () => {
    mockFetch.mockImplementation(
      async () =>
        new Response('not-json', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );

    const result = await hubClientService.queryHubFingerprints(
      baseEnv,
      'sha256:abc123',
      'did:colophony:local.example.com:u:user-1',
    );

    // safeParse on invalid JSON returns null
    expect(result).toBeNull();
  });
});
