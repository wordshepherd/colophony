/* eslint-disable @typescript-eslint/unbound-method */
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
        where: vi.fn().mockReturnValue([]),
        limit: vi.fn().mockReturnValue([]),
      }),
    }),
  },
  withRls: vi.fn(),
  users: {},
  manuscriptVersions: {},
  submissions: {},
  submissionPeriods: {},
  publications: {},
  simSubChecks: {},
  externalSubmissions: {},
  trustedPeers: {},
  eq: vi.fn(),
  and: vi.fn(),
  isNull: vi.fn(),
  inArray: vi.fn(),
  sql: vi.fn(),
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

vi.mock('../../services/fingerprint.service.js', () => ({
  fingerprintService: { generate: vi.fn() },
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

vi.mock('../../services/hub-client.service.js', () => ({
  hubClientService: {
    queryHubFingerprints: vi.fn().mockResolvedValue(null),
    pushFingerprint: vi.fn(),
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { simsubService } from '../../services/simsub.service.js';
import { db, withRls } from '@colophony/db';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('simsub bilateral integration', () => {
  const mockWithRls = vi.mocked(withRls);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ───────────────────────────────────────────────
  // handleInboundCheck tests
  // ───────────────────────────────────────────────

  it('handleInboundCheck: no matching user returns clear', async () => {
    // db.select(users).where(email) → empty
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue([]),
        }),
      }),
    } as any);

    const result = await simsubService.handleInboundCheck(
      { FEDERATION_DOMAIN: 'local.example.com' } as any,
      'did:web:remote.example.com:users:alice',
      'sha256:abc123',
    );

    expect(result).toEqual({ found: false, conflicts: [] });
  });

  it('handleInboundCheck: matching user with active submission returns conflict', async () => {
    const userId = 'user-1';

    // Superuser db.select(users) → found
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue([{ id: userId }]),
        }),
      }),
    } as any);

    // Phase 1: withRls (user-scoped) → matching version IDs
    // Phase 2: db.select (superuser) → active submission
    let rlsCallCount = 0;
    mockWithRls.mockImplementation(async (_ctx: unknown, fn: unknown) => {
      rlsCallCount++;
      if (rlsCallCount === 1) {
        // Phase 1: return matching version IDs from user-scoped query
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue([{ id: 'version-1' }]),
            }),
          }),
        };
        return (fn as (tx: unknown) => Promise<unknown>)(mockTx);
      }
      return (fn as (tx: unknown) => Promise<unknown>)({});
    });

    // Phase 2 uses db.select directly (superuser) — mock the chained query
    // After the user lookup, the next db.select call is for active submissions
    const dbSelectMock = vi.mocked(db.select);
    let dbSelectCallCount = 0;
    dbSelectMock.mockImplementation((_fields?: any) => {
      dbSelectCallCount++;
      if (dbSelectCallCount === 1) {
        // First call: user lookup
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue([{ id: userId }]),
            }),
          }),
        } as any;
      }
      // Second call: active submissions (superuser cross-org)
      return {
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue([
                  {
                    submissionId: 'sub-1',
                    publicationName: 'Test Journal',
                    submittedAt: new Date('2025-01-01'),
                    periodName: 'Spring 2025',
                  },
                ]),
              }),
            }),
          }),
        }),
      } as any;
    });

    const result = await simsubService.handleInboundCheck(
      { FEDERATION_DOMAIN: 'local.example.com' } as any,
      'did:web:remote.example.com:users:alice',
      'sha256:abc123',
    );

    expect(result.found).toBe(true);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].publicationName).toBe('Test Journal');
  });

  it('handleInboundCheck: matching user with no active submissions returns clear', async () => {
    const userId = 'user-1';

    // Superuser db.select(users) → found
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue([{ id: userId }]),
        }),
      }),
    } as any);

    // Phase 1: withRls → matching version IDs
    let rlsCallCount = 0;
    mockWithRls.mockImplementation(async (_ctx: unknown, fn: unknown) => {
      rlsCallCount++;
      if (rlsCallCount === 1) {
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue([{ id: 'version-1' }]),
            }),
          }),
        };
        return (fn as (tx: unknown) => Promise<unknown>)(mockTx);
      }
      return (fn as (tx: unknown) => Promise<unknown>)({});
    });

    // Phase 2: db.select (superuser) → no active submissions
    const dbSelectMock = vi.mocked(db.select);
    let dbSelectCallCount = 0;
    dbSelectMock.mockImplementation((_fields?: any) => {
      dbSelectCallCount++;
      if (dbSelectCallCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue([{ id: userId }]),
            }),
          }),
        } as any;
      }
      return {
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue([]),
              }),
            }),
          }),
        }),
      } as any;
    });

    const result = await simsubService.handleInboundCheck(
      { FEDERATION_DOMAIN: 'local.example.com' } as any,
      'did:web:remote.example.com:users:alice',
      'sha256:abc123',
    );

    expect(result.found).toBe(false);
    expect(result.conflicts).toHaveLength(0);
  });

  it('handleInboundCheck: invalid DID format returns clear', async () => {
    const result = await simsubService.handleInboundCheck(
      { FEDERATION_DOMAIN: 'local.example.com' } as any,
      'invalid',
      'sha256:abc123',
    );

    expect(result).toEqual({ found: false, conflicts: [] });
  });

  // ───────────────────────────────────────────────
  // checkRemote test
  // ───────────────────────────────────────────────

  it('checkRemote: bilateral check with trusted peer', async () => {
    mockGetOrInitConfig.mockResolvedValue({
      enabled: true,
      publicKey: 'PEM-PUBLIC',
      privateKey: 'PEM-PRIVATE',
      keyId: 'local.example.com#main',
    });

    // withRls → peers with simsub.respond
    mockWithRls.mockImplementation(async (_ctx: unknown, fn: unknown) => {
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue([
              {
                peerDomain: 'peer.example.com',
                instanceUrl: 'https://peer.example.com',
              },
            ]),
          }),
        }),
      };
      return (fn as (tx: unknown) => Promise<unknown>)(mockTx);
    });

    // Mock fetch → remote returns conflict
    mockFetch.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            found: true,
            conflicts: [
              {
                publicationName: 'Remote Journal',
                submittedAt: '2025-06-01T00:00:00.000Z',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );

    const results = await simsubService.checkRemote(
      {
        FEDERATION_ENABLED: true,
        FEDERATION_DOMAIN: 'local.example.com',
        NODE_ENV: 'test',
        HUB_DOMAIN: undefined,
      } as any,
      'sha256:abc123',
      'did:web:local.example.com:users:alice',
      'org-1',
    );

    expect(results).toHaveLength(1);
    expect(results[0].domain).toBe('peer.example.com');
    expect(results[0].found).toBe(true);
    expect(results[0].conflicts).toHaveLength(1);
  });
});
