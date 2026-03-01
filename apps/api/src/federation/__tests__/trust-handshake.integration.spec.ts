import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Constants for valid mock data (must pass Zod schemas)
// ---------------------------------------------------------------------------

const PEM_A_PUBLIC = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEMock_A_Public_Key_000000000000
0000000000000000000000000000000000000000000000000000000000000Q==
-----END PUBLIC KEY-----`;

const PEM_B_PUBLIC = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEMock_B_Public_Key_000000000000
0000000000000000000000000000000000000000000000000000000000000Q==
-----END PUBLIC KEY-----`;

const PEM_A_REAL = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEMock_A_REAL_Key_0000000000000
0000000000000000000000000000000000000000000000000000000000000Q==
-----END PUBLIC KEY-----`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PeerRow {
  id: string;
  organizationId: string;
  domain: string;
  instanceUrl: string;
  publicKey: string;
  keyId: string;
  grantedCapabilities: Record<string, boolean>;
  status: string;
  initiatedBy: string;
  protocolVersion: string;
  lastVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Stateful mock DB factory
// ---------------------------------------------------------------------------

function createStatefulMockDb() {
  const peers = new Map<string, PeerRow>();

  const tx = {
    select: vi.fn().mockImplementation(() => {
      const chain: Record<string, any> = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockImplementation(() => chain);
      chain.limit = vi.fn().mockImplementation((_n: number) => {
        return [...peers.values()].slice(0, _n);
      });
      return chain;
    }),
    insert: vi.fn().mockImplementation((_table: unknown) => ({
      values: vi.fn().mockImplementation((vals: Partial<PeerRow>) => {
        const row: PeerRow = {
          id: crypto.randomUUID(),
          organizationId: vals.organizationId ?? '',
          domain: vals.domain ?? '',
          instanceUrl: vals.instanceUrl ?? '',
          publicKey: vals.publicKey ?? '',
          keyId: vals.keyId ?? '',
          grantedCapabilities:
            (vals.grantedCapabilities as Record<string, boolean>) ?? {},
          status: vals.status ?? 'pending_outbound',
          initiatedBy: vals.initiatedBy ?? 'local',
          protocolVersion: vals.protocolVersion ?? '1.0',
          lastVerifiedAt: vals.lastVerifiedAt ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        peers.set(row.id, row);
        return {
          returning: vi.fn().mockReturnValue([row]),
        };
      }),
    })),
    update: vi.fn().mockImplementation((_table: unknown) => ({
      set: vi.fn().mockImplementation((updates: Partial<PeerRow>) => ({
        where: vi.fn().mockImplementation((_condition: unknown) => {
          // Update the first matching peer
          for (const [id, row] of peers) {
            const updated = { ...row, ...updates, updatedAt: new Date() };
            peers.set(id, updated as PeerRow);
            return {
              returning: vi.fn().mockReturnValue([updated]),
            };
          }
          return { returning: vi.fn().mockReturnValue([]) };
        }),
      })),
    })),
    _peers: peers,
  };

  return tx;
}

// ---------------------------------------------------------------------------
// Mocks for dependencies
// ---------------------------------------------------------------------------

const mockAuditLog = vi.fn();
const mockSignRequest = vi.fn().mockReturnValue({
  headers: { signature: 'mock-sig', date: new Date().toUTCString() },
});
const mockVerifySignature = vi
  .fn()
  .mockResolvedValue({ valid: true, keyId: 'test#main' });

vi.mock('@colophony/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue([{ id: 'org-1' }]),
        limit: vi.fn().mockReturnValue([]),
      }),
    }),
  },
  withRls: vi.fn(),
  trustedPeers: {},
  organizations: {},
  federationConfig: {},
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock('../../services/audit.service.js', () => ({
  auditService: { log: (...args: unknown[]) => mockAuditLog(...args) },
}));

const mockGetOrInitConfig = vi.fn();
const mockGetPublicConfig = vi.fn();

vi.mock('../../services/federation.service.js', () => ({
  federationService: {
    getOrInitConfig: (...args: unknown[]) => mockGetOrInitConfig(...args),
    getPublicConfig: (...args: unknown[]) => mockGetPublicConfig(...args),
  },
}));

vi.mock('../../federation/http-signatures.js', () => ({
  signFederationRequest: (...args: unknown[]) => mockSignRequest(...args),
  verifyFederationSignature: (...args: unknown[]) =>
    mockVerifySignature(...args),
}));

vi.mock('../../lib/url-validation.js', () => ({
  resolveAndCheckPrivateIp: vi.fn(),
  SsrfValidationError: class extends Error {},
}));

// Mock fetch for metadata lookups
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  trustService,
  TrustPeerAlreadyExistsError,
  TrustPeerInvalidStateError,
  TrustSignatureVerificationError,
} from '../../services/trust.service.js';
import { withRls } from '@colophony/db';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function setupMetadataFetch(domain: string, publicKey: string, keyId: string) {
  mockFetch.mockImplementation(async (url: string) => {
    if (url.includes(domain) && url.includes('.well-known/colophony')) {
      return new Response(
        JSON.stringify({
          domain,
          software: 'colophony',
          version: '2.0.0',
          publicKey,
          keyId,
          capabilities: ['simsub', 'transfer'],
          mode: 'open',
          contactEmail: null,
          publications: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    // Suppress the accept POST (best-effort, caught by trust service)
    return new Response('', { status: 200 });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('trust handshake integration', () => {
  const mockWithRls = vi.mocked(withRls);

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrInitConfig.mockResolvedValue({
      publicKey: PEM_A_PUBLIC,
      keyId: 'instance-a.example.com#main',
      privateKey: 'PEM-A-PRIVATE',
    });
    mockGetPublicConfig.mockResolvedValue({
      publicKey: PEM_A_PUBLIC,
      keyId: 'instance-a.example.com#main',
      mode: 'allowlist',
    });
  });

  it('bilateral handshake: A initiates → B receives → B accepts → A receives accept → both active', async () => {
    // Instance A's perspective
    const dbA = createStatefulMockDb();
    // Instance B's perspective
    const dbB = createStatefulMockDb();

    const envA = {
      FEDERATION_DOMAIN: 'instance-a.example.com',
      HUB_DOMAIN: undefined,
    } as any;

    // Step 1: A initiates trust with B
    setupMetadataFetch(
      'instance-b.example.com',
      PEM_B_PUBLIC,
      'instance-b.example.com#main',
    );
    mockWithRls.mockImplementation(async (_ctx: unknown, fn: unknown) =>
      (fn as (tx: unknown) => Promise<unknown>)(dbA),
    );

    const peerFromA = await trustService.initiateTrust(
      envA,
      'org-1',
      {
        domain: 'instance-b.example.com',
        requestedCapabilities: { 'simsub.check': true },
      },
      'actor-1',
    );

    expect(peerFromA.status).toBe('pending_outbound');
    expect(peerFromA.domain).toBe('instance-b.example.com');

    // Step 2: B receives the trust request
    setupMetadataFetch(
      'instance-a.example.com',
      PEM_A_PUBLIC,
      'instance-a.example.com#main',
    );
    mockWithRls.mockImplementation(async (_ctx: unknown, fn: unknown) =>
      (fn as (tx: unknown) => Promise<unknown>)(dbB),
    );

    // Mock the superuser db.select for orgs
    const { db } = await import('@colophony/db');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue([{ id: 'org-B1' }]),
      }),
    } as any);

    const { orgIds } = await trustService.handleInboundTrustRequest(
      { FEDERATION_DOMAIN: 'instance-b.example.com' } as any,
      {
        instanceUrl: 'https://instance-a.example.com',
        domain: 'instance-a.example.com',
        publicKey: PEM_A_PUBLIC,
        keyId: 'instance-a.example.com#main',
        requestedCapabilities: { 'simsub.check': true },
        protocolVersion: '1.0',
      },
      { signature: 'mock', date: new Date().toUTCString() },
      'POST',
      'https://instance-b.example.com/federation/trust',
      '{}',
    );

    expect(orgIds).toContain('org-B1');
    const bPeers = [...dbB._peers.values()];
    expect(bPeers).toHaveLength(1);
    expect(bPeers[0].status).toBe('pending_inbound');
    expect(bPeers[0].domain).toBe('instance-a.example.com');

    // Step 3: B admin accepts the trust request
    const bPeerId = bPeers[0].id;
    const acceptedPeer = await trustService.acceptInboundTrust(
      { FEDERATION_DOMAIN: 'instance-b.example.com' } as any,
      'org-B1',
      bPeerId,
      { grantedCapabilities: { 'simsub.check': true, 'simsub.respond': true } },
      'actor-B1',
    );

    expect(acceptedPeer.status).toBe('active');

    // Step 4: A receives the accept
    mockWithRls.mockImplementation(async (_ctx: unknown, fn: unknown) =>
      (fn as (tx: unknown) => Promise<unknown>)(dbA),
    );

    // Mock superuser db for pending_outbound lookup
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue([
          {
            publicKey: PEM_B_PUBLIC,
            id: [...dbA._peers.values()][0].id,
            organizationId: 'org-1',
          },
        ]),
      }),
    } as any);

    await trustService.handleInboundTrustAccept(
      envA,
      {
        instanceUrl: 'https://instance-b.example.com',
        domain: 'instance-b.example.com',
        grantedCapabilities: { 'simsub.check': true, 'simsub.respond': true },
        protocolVersion: '1.0',
      },
      { signature: 'mock', date: new Date().toUTCString() },
      'POST',
      'https://instance-a.example.com/federation/trust/accept',
      '{}',
    );

    // Both sides should now be active
    const aPeers = [...dbA._peers.values()];
    expect(aPeers[0].status).toBe('active');
    const bPeersAfter = [...dbB._peers.values()];
    expect(bPeersAfter[0].status).toBe('active');
  });

  it('rejects duplicate trust initiation', async () => {
    const dbWithExisting = createStatefulMockDb();

    // Pre-populate an existing peer
    dbWithExisting._peers.set('existing-1', {
      id: 'existing-1',
      organizationId: 'org-1',
      domain: 'instance-b.example.com',
      instanceUrl: 'https://instance-b.example.com',
      publicKey: PEM_B_PUBLIC,
      keyId: 'instance-b.example.com#main',
      grantedCapabilities: {},
      status: 'active',
      initiatedBy: 'local',
      protocolVersion: '1.0',
      lastVerifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    setupMetadataFetch(
      'instance-b.example.com',
      PEM_B_PUBLIC,
      'instance-b.example.com#main',
    );
    const mockWithRlsLocal = vi.mocked(withRls);
    mockWithRlsLocal.mockImplementation(async (_ctx: unknown, fn: unknown) =>
      (fn as (tx: unknown) => Promise<unknown>)(dbWithExisting),
    );

    await expect(
      trustService.initiateTrust(
        {
          FEDERATION_DOMAIN: 'instance-a.example.com',
          HUB_DOMAIN: undefined,
        } as any,
        'org-1',
        {
          domain: 'instance-b.example.com',
          requestedCapabilities: {},
        },
        'actor-1',
      ),
    ).rejects.toThrow(TrustPeerAlreadyExistsError);
  });

  it('rejects accept for wrong state', async () => {
    const dbWithActive = createStatefulMockDb();
    dbWithActive._peers.set('peer-1', {
      id: 'peer-1',
      organizationId: 'org-1',
      domain: 'instance-b.example.com',
      instanceUrl: 'https://instance-b.example.com',
      publicKey: PEM_B_PUBLIC,
      keyId: 'instance-b.example.com#main',
      grantedCapabilities: {},
      status: 'active',
      initiatedBy: 'remote',
      protocolVersion: '1.0',
      lastVerifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockWithRlsLocal = vi.mocked(withRls);
    mockWithRlsLocal.mockImplementation(async (_ctx: unknown, fn: unknown) =>
      (fn as (tx: unknown) => Promise<unknown>)(dbWithActive),
    );

    await expect(
      trustService.acceptInboundTrust(
        { FEDERATION_DOMAIN: 'instance-a.example.com' } as any,
        'org-1',
        'peer-1',
        { grantedCapabilities: {} },
        'actor-1',
      ),
    ).rejects.toThrow(TrustPeerInvalidStateError);
  });

  it('signature verification failure on inbound request', async () => {
    setupMetadataFetch(
      'instance-a.example.com',
      PEM_A_PUBLIC,
      'instance-a.example.com#main',
    );
    mockVerifySignature.mockResolvedValueOnce({ valid: false });

    await expect(
      trustService.handleInboundTrustRequest(
        { FEDERATION_DOMAIN: 'instance-b.example.com' } as any,
        {
          instanceUrl: 'https://instance-a.example.com',
          domain: 'instance-a.example.com',
          publicKey: PEM_A_PUBLIC,
          keyId: 'instance-a.example.com#main',
          requestedCapabilities: {},
          protocolVersion: '1.0',
        },
        { signature: 'bad-sig', date: new Date().toUTCString() },
        'POST',
        'https://instance-b.example.com/federation/trust',
        '{}',
      ),
    ).rejects.toThrow(TrustSignatureVerificationError);
  });

  it('public key mismatch with metadata', async () => {
    // Metadata says PEM-A-REAL, but request claims PEM-A-FAKE
    setupMetadataFetch(
      'instance-a.example.com',
      PEM_A_REAL,
      'instance-a.example.com#main',
    );

    await expect(
      trustService.handleInboundTrustRequest(
        { FEDERATION_DOMAIN: 'instance-b.example.com' } as any,
        {
          instanceUrl: 'https://instance-a.example.com',
          domain: 'instance-a.example.com',
          publicKey: PEM_A_PUBLIC, // Different from metadata
          keyId: 'instance-a.example.com#main',
          requestedCapabilities: {},
          protocolVersion: '1.0',
        },
        { signature: 'mock', date: new Date().toUTCString() },
        'POST',
        'https://instance-b.example.com/federation/trust',
        '{}',
      ),
    ).rejects.toThrow(TrustSignatureVerificationError);
  });
});
