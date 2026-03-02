import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockWithRls = vi.fn();
let dbSelectResult: unknown[] = [];
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock('@colophony/db', () => ({
  db: {
    select: () => ({
      from: () => {
        const result: any = Object.assign([] as unknown[], {
          where: () => {
            const whereResult = Object.assign(Promise.resolve(dbSelectResult), {
              limit: () => Promise.resolve(dbSelectResult),
              orderBy: () => ({
                limit: () => Promise.resolve(dbSelectResult),
              }),
            });
            return whereResult;
          },
          innerJoin: () => ({
            leftJoin: () => ({
              where: () => ({
                limit: () => Promise.resolve(dbSelectResult),
              }),
            }),
          }),
          then: (resolve: (v: unknown[]) => void) =>
            Promise.resolve(dbSelectResult).then(resolve),
        });
        return result;
      },
    }),
    insert: () => mockDbInsert(),
    update: () => mockDbUpdate(),
  },
  withRls: (...args: unknown[]) => mockWithRls(...args),
  manuscriptVersions: {
    id: 'id',
    contentFingerprint: 'content_fingerprint',
    federationFingerprint: 'federation_fingerprint',
    manuscriptId: 'manuscript_id',
    versionNumber: 'version_number',
  },
  submissions: {
    id: 'id',
    manuscriptVersionId: 'manuscript_version_id',
    status: 'status',
    submissionPeriodId: 'submission_period_id',
    simSubCheckResult: 'sim_sub_check_result',
    simSubCheckedAt: 'sim_sub_checked_at',
    simSubOverride: 'sim_sub_override',
    simSubPolicyRequirement: 'sim_sub_policy_requirement',
    submittedAt: 'submitted_at',
  },
  submissionPeriods: {
    id: 'id',
    simSubPolicy: 'sim_sub_policy',
    publicationId: 'publication_id',
    name: 'name',
  },
  manuscripts: {
    id: 'id',
    genre: 'genre',
  },
  externalSubmissions: {
    id: 'id',
    manuscriptId: 'manuscript_id',
    journalName: 'journal_name',
    status: 'status',
    sentAt: 'sent_at',
  },
  publications: { id: 'id', name: 'name' },
  users: {
    id: 'id',
    email: 'email',
    deletedAt: 'deleted_at',
    isGuest: 'is_guest',
  },
  simSubChecks: {
    id: 'id',
    submissionId: 'submission_id',
    fingerprint: 'fingerprint',
    federationFingerprint: 'federation_fingerprint',
    submitterDid: 'submitter_did',
    result: 'result',
    localConflicts: 'local_conflicts',
    remoteResults: 'remote_results',
    overriddenBy: 'overridden_by',
    overriddenAt: 'overridden_at',
  },
  eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  isNull: vi.fn((...args: unknown[]) => ({ type: 'isNull', args })),
  inArray: vi.fn((...args: unknown[]) => ({ type: 'inArray', args })),
  sql: Object.assign(vi.fn(), {
    raw: vi.fn(),
  }),
}));

const mockAuditLog = vi.fn().mockResolvedValue(undefined);
const mockAuditLogDirect = vi.fn().mockResolvedValue(undefined);
vi.mock('./audit.service.js', () => ({
  auditService: {
    log: (...args: unknown[]) => mockAuditLog(...args),
    logDirect: (...args: unknown[]) => mockAuditLogDirect(...args),
  },
}));

const mockGetOrInitConfig = vi.fn();
vi.mock('./federation.service.js', () => ({
  federationService: {
    getOrInitConfig: (...args: unknown[]) => mockGetOrInitConfig(...args),
  },
  domainToDid: (domain: string) => domain.replace(/:/g, '%3A'),
}));

const mockGetOrCompute = vi.fn();
vi.mock('./fingerprint.service.js', () => ({
  fingerprintService: {
    getOrCompute: (...args: unknown[]) => mockGetOrCompute(...args),
  },
}));

const mockSignFederationRequest = vi.fn();
vi.mock('../federation/http-signatures.js', () => ({
  signFederationRequest: (...args: unknown[]) =>
    mockSignFederationRequest(...args),
}));

const mockQueryHubFingerprints = vi.fn();
const mockPushFingerprint = vi.fn();
vi.mock('./hub-client.service.js', () => ({
  hubClientService: {
    queryHubFingerprints: (...args: unknown[]) =>
      mockQueryHubFingerprints(...args),
    pushFingerprint: (...args: unknown[]) => mockPushFingerprint(...args),
  },
}));

vi.mock('../lib/url-validation.js', () => ({
  validateOutboundUrl: vi.fn().mockResolvedValue(undefined),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    FEDERATION_ENABLED: true,
    FEDERATION_DOMAIN: 'test.example.com',
    ...overrides,
  } as any;
}

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  simsubService,
  resolveEffectivePolicy,
  SimSubConflictError,
} from './simsub.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  dbSelectResult = [];
  mockDbInsert.mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  });
  mockDbUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });
});

// ---------------------------------------------------------------------------
// checkLocal
// ---------------------------------------------------------------------------

describe('simsubService.checkLocal', () => {
  it('returns empty when no matching fingerprints', async () => {
    mockWithRls.mockImplementation(async (_ctx: any, fn: any) => {
      return fn({
        select: () => ({
          from: () => ({
            where: () => Promise.resolve([]),
          }),
        }),
      });
    });

    const result = await simsubService.checkLocal('user1', 'abc123');
    expect(result).toEqual([]);
  });

  it('returns conflicts for active submissions under no-sim-sub periods', async () => {
    // Phase 1: user-scoped — return matching version IDs
    mockWithRls.mockImplementationOnce(async (_ctx: any, fn: any) => {
      return fn({
        select: () => ({
          from: () => ({
            where: () => Promise.resolve([{ id: 'v1' }]),
          }),
        }),
      });
    });

    // Phase 2: superuser join — return conflicts
    dbSelectResult = [
      {
        submissionId: 's1',
        publicationName: 'Lit Mag A',
        submittedAt: new Date('2026-01-01'),
        periodName: 'Spring 2026',
      },
    ];

    const result = await simsubService.checkLocal('user1', 'abc123');
    expect(result).toHaveLength(1);
    expect(result[0].publicationName).toBe('Lit Mag A');
    expect(result[0].periodName).toBe('Spring 2026');
  });

  it('excludes the current submission from conflicts', async () => {
    mockWithRls.mockImplementationOnce(async (_ctx: any, fn: any) => {
      return fn({
        select: () => ({
          from: () => ({
            where: () => Promise.resolve([{ id: 'v1' }]),
          }),
        }),
      });
    });

    dbSelectResult = [];

    const result = await simsubService.checkLocal(
      'user1',
      'abc123',
      'exclude-this',
    );
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// handleInboundCheck
// ---------------------------------------------------------------------------

describe('simsubService.handleInboundCheck', () => {
  it('returns no conflicts for unknown DID', async () => {
    dbSelectResult = []; // no user found

    const result = await simsubService.handleInboundCheck(
      makeEnv(),
      'did:web:test.example.com:users:alice',
      'fingerprint123',
    );
    expect(result).toEqual({ found: false, conflicts: [] });
  });

  it('returns conflicts when local matches found', async () => {
    // User lookup returns a user
    dbSelectResult = [{ id: 'user1' }];

    // Mock checkLocal to return conflicts
    const checkLocalSpy = vi
      .spyOn(simsubService, 'checkLocal')
      .mockResolvedValueOnce([
        {
          publicationName: 'Lit Mag B',
          submittedAt: '2026-01-15T00:00:00.000Z',
        },
      ]);

    const result = await simsubService.handleInboundCheck(
      makeEnv(),
      'did:web:test.example.com:users:alice',
      'fingerprint123',
    );

    expect(result.found).toBe(true);
    expect(result.conflicts).toHaveLength(1);
    checkLocalSpy.mockRestore();
  });

  it('parses did:web format correctly', async () => {
    dbSelectResult = [];

    // Invalid DID format
    const result = await simsubService.handleInboundCheck(
      makeEnv(),
      'invalid-did',
      'fp',
    );
    expect(result).toEqual({ found: false, conflicts: [] });
  });
});

// ---------------------------------------------------------------------------
// checkRemote
// ---------------------------------------------------------------------------

describe('simsubService.checkRemote', () => {
  it('returns empty when federation disabled', async () => {
    const result = await simsubService.checkRemote(
      makeEnv({ FEDERATION_ENABLED: false }),
      'fp',
      'did:web:x:users:a',
      'org1',
    );
    expect(result).toEqual([]);
  });

  it('fans out to all peers with simsub.respond capability', async () => {
    mockGetOrInitConfig.mockResolvedValue({
      enabled: true,
      privateKey: 'test-key',
    });

    // withRls for peer query — return peers via mock tx
    mockWithRls.mockImplementationOnce(async (_ctx: any, fn: any) => {
      return fn({
        select: () => ({
          from: () => ({
            where: () =>
              Promise.resolve([
                {
                  peerDomain: 'peer1.com',
                  instanceUrl: 'https://peer1.com',
                },
              ]),
          }),
        }),
      });
    });

    mockSignFederationRequest.mockReturnValue({
      headers: { signature: 'sig', 'signature-input': 'input' },
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ found: false, conflicts: [] }),
    });

    const results = await simsubService.checkRemote(
      makeEnv(),
      'fp',
      'did:web:test.example.com:users:alice',
      'org1',
    );

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('checked');
    expect(results[0].found).toBe(false);
  });

  it('marks timed-out instances as timeout', async () => {
    mockGetOrInitConfig.mockResolvedValue({
      enabled: true,
      privateKey: 'test-key',
    });

    mockWithRls.mockImplementationOnce(async (_ctx: any, fn: any) => {
      return fn({
        select: () => ({
          from: () => ({
            where: () =>
              Promise.resolve([
                { peerDomain: 'slow.com', instanceUrl: 'https://slow.com' },
              ]),
          }),
        }),
      });
    });

    mockSignFederationRequest.mockReturnValue({
      headers: { signature: 'sig', 'signature-input': 'input' },
    });

    const timeoutError = new DOMException('Timeout', 'TimeoutError');
    mockFetch.mockRejectedValue(timeoutError);

    const results = await simsubService.checkRemote(
      makeEnv(),
      'fp',
      'did:web:test.example.com:users:alice',
      'org1',
    );

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('timeout');
  });

  it('handles unreachable instances gracefully', async () => {
    mockGetOrInitConfig.mockResolvedValue({
      enabled: true,
      privateKey: 'test-key',
    });

    mockWithRls.mockImplementationOnce(async (_ctx: any, fn: any) => {
      return fn({
        select: () => ({
          from: () => ({
            where: () =>
              Promise.resolve([
                { peerDomain: 'down.com', instanceUrl: 'https://down.com' },
              ]),
          }),
        }),
      });
    });

    mockSignFederationRequest.mockReturnValue({
      headers: { signature: 'sig', 'signature-input': 'input' },
    });

    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const results = await simsubService.checkRemote(
      makeEnv(),
      'fp',
      'did:web:test.example.com:users:alice',
      'org1',
    );

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('unreachable');
  });

  it('deduplicates peers by domain', async () => {
    mockGetOrInitConfig.mockResolvedValue({
      enabled: true,
      privateKey: 'test-key',
    });

    // SQL DISTINCT ON handles dedup — only one peer per domain returned
    mockWithRls.mockImplementationOnce(async (_ctx: any, fn: any) => {
      return fn({
        select: () => ({
          from: () => ({
            where: () =>
              Promise.resolve([
                {
                  peerDomain: 'peer1.com',
                  instanceUrl: 'https://peer1.com',
                },
              ]),
          }),
        }),
      });
    });

    mockSignFederationRequest.mockReturnValue({
      headers: { signature: 'sig', 'signature-input': 'input' },
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ found: false, conflicts: [] }),
    });

    const results = await simsubService.checkRemote(
      makeEnv(),
      'fp',
      'did:web:test.example.com:users:alice',
      'org1',
    );

    expect(results).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// performFullCheck
// ---------------------------------------------------------------------------

describe('simsubService.performFullCheck', () => {
  const contentFingerprint = 'c'.repeat(64);
  const federationFingerprint = 'f'.repeat(64);

  beforeEach(() => {
    mockGetOrCompute.mockResolvedValue({
      contentFingerprint,
      federationFingerprint,
    });

    // User email lookup
    dbSelectResult = [{ email: 'alice@test.example.com' }];
  });

  it('returns CLEAR when no conflicts', async () => {
    // checkLocal via withRls
    mockWithRls.mockImplementation(async (_ctx: any, fn: any) => {
      // For fingerprint computation
      if (typeof fn === 'function') {
        const mockTx = {
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => Promise.resolve([]),
              }),
            }),
          }),
          insert: () => ({
            values: vi.fn().mockResolvedValue(undefined),
          }),
          update: () => ({
            set: () => ({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        };
        return fn(mockTx);
      }
    });

    // Mock checkLocal and checkRemote
    const checkLocalSpy = vi
      .spyOn(simsubService, 'checkLocal')
      .mockResolvedValue([]);
    const checkRemoteSpy = vi
      .spyOn(simsubService, 'checkRemote')
      .mockResolvedValue([]);

    const result = await simsubService.performFullCheck(
      makeEnv(),
      'sub1',
      'v1',
      'user1',
      'org1',
    );

    expect(result.result).toBe('CLEAR');
    expect(result.fingerprint).toBe(contentFingerprint);
    expect(result.federationFingerprint).toBe(federationFingerprint);
    checkLocalSpy.mockRestore();
    checkRemoteSpy.mockRestore();
  });

  it('returns CONFLICT when local conflicts found', async () => {
    mockWithRls.mockImplementation(async (_ctx: any, fn: any) => {
      const mockTx = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
        insert: () => ({
          values: vi.fn().mockResolvedValue(undefined),
        }),
        update: () => ({
          set: () => ({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };
      return fn(mockTx);
    });

    const checkLocalSpy = vi
      .spyOn(simsubService, 'checkLocal')
      .mockResolvedValue([
        {
          publicationName: 'Conflict Mag',
          submittedAt: '2026-01-01T00:00:00Z',
        },
      ]);
    const checkRemoteSpy = vi
      .spyOn(simsubService, 'checkRemote')
      .mockResolvedValue([]);

    const result = await simsubService.performFullCheck(
      makeEnv(),
      'sub1',
      'v1',
      'user1',
      'org1',
    );

    expect(result.result).toBe('CONFLICT');
    expect(result.localConflicts).toHaveLength(1);
    checkLocalSpy.mockRestore();
    checkRemoteSpy.mockRestore();
  });

  it('returns PARTIAL when some instances unreachable but no conflicts', async () => {
    mockWithRls.mockImplementation(async (_ctx: any, fn: any) => {
      const mockTx = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
        insert: () => ({
          values: vi.fn().mockResolvedValue(undefined),
        }),
        update: () => ({
          set: () => ({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };
      return fn(mockTx);
    });

    const checkLocalSpy = vi
      .spyOn(simsubService, 'checkLocal')
      .mockResolvedValue([]);
    const checkRemoteSpy = vi
      .spyOn(simsubService, 'checkRemote')
      .mockResolvedValue([{ domain: 'down.com', status: 'unreachable' }]);

    const result = await simsubService.performFullCheck(
      makeEnv(),
      'sub1',
      'v1',
      'user1',
      'org1',
    );

    expect(result.result).toBe('PARTIAL');
    checkLocalSpy.mockRestore();
    checkRemoteSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// grantOverride
// ---------------------------------------------------------------------------

describe('simsubService.grantOverride', () => {
  it('sets simSubOverride on submission', async () => {
    const mockTxUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    mockWithRls.mockImplementation(async (_ctx: any, fn: any) => {
      return fn({
        update: mockTxUpdate,
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve([{ id: 'check1' }]),
              }),
            }),
          }),
        }),
      });
    });

    await simsubService.grantOverride('org1', 'sub1', 'admin1');
    expect(mockWithRls).toHaveBeenCalled();
    expect(mockAuditLog).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Hub integration tests
// ---------------------------------------------------------------------------

describe('simsubService.checkRemote — hub integration', () => {
  it('queries hub first when HUB_DOMAIN set', async () => {
    mockGetOrInitConfig.mockResolvedValue({
      enabled: true,
      privateKey: 'test-key',
    });

    mockQueryHubFingerprints.mockResolvedValueOnce({
      found: true,
      conflicts: [
        {
          sourceDomain: 'other.example.com',
          publicationName: 'Hub Pub',
          submittedAt: '2026-01-01T00:00:00Z',
        },
      ],
    });

    // Hub responded — only self-hosted peers should be queried
    mockWithRls.mockImplementationOnce(async (_ctx: any, fn: any) => {
      return fn({
        select: () => ({
          from: () => ({
            where: () => Promise.resolve([]), // No self-hosted peers
          }),
        }),
      });
    });

    const results = await simsubService.checkRemote(
      makeEnv({ HUB_DOMAIN: 'hub.example.com' }),
      'fp',
      'did:web:test.example.com:users:alice',
      'org1',
    );

    expect(mockQueryHubFingerprints).toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].domain).toBe('other.example.com');
  });

  it('falls back to peer fan-out when hub unreachable', async () => {
    mockGetOrInitConfig.mockResolvedValue({
      enabled: true,
      privateKey: 'test-key',
    });

    // Hub unreachable — returns null
    mockQueryHubFingerprints.mockResolvedValueOnce(null);

    // Should fan out to all peers (including hub-attested)
    mockWithRls.mockImplementationOnce(async (_ctx: any, fn: any) => {
      return fn({
        select: () => ({
          from: () => ({
            where: () =>
              Promise.resolve([
                {
                  peerDomain: 'peer1.com',
                  instanceUrl: 'https://peer1.com',
                },
              ]),
          }),
        }),
      });
    });

    mockSignFederationRequest.mockReturnValue({
      headers: { signature: 'sig', 'signature-input': 'input' },
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ found: false, conflicts: [] }),
    });

    const results = await simsubService.checkRemote(
      makeEnv({ HUB_DOMAIN: 'hub.example.com' }),
      'fp',
      'did:web:test.example.com:users:alice',
      'org1',
    );

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('checked');
  });
});

describe('simsubService.performFullCheck — hub push', () => {
  const contentFingerprint = 'c'.repeat(64);
  const federationFingerprint = 'f'.repeat(64);

  beforeEach(() => {
    mockGetOrCompute.mockResolvedValue({
      contentFingerprint,
      federationFingerprint,
    });
    dbSelectResult = [{ email: 'alice@test.example.com' }];
    mockPushFingerprint.mockResolvedValue(undefined);
  });

  it('pushes fingerprint to hub after recording', async () => {
    mockWithRls.mockImplementation(async (_ctx: any, fn: any) => {
      const mockTx = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
        insert: () => ({
          values: vi.fn().mockResolvedValue(undefined),
        }),
        update: () => ({
          set: () => ({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };
      return fn(mockTx);
    });

    const checkLocalSpy = vi
      .spyOn(simsubService, 'checkLocal')
      .mockResolvedValue([]);
    const checkRemoteSpy = vi
      .spyOn(simsubService, 'checkRemote')
      .mockResolvedValue([]);

    await simsubService.performFullCheck(
      makeEnv({ HUB_DOMAIN: 'hub.example.com' }),
      'sub1',
      'v1',
      'user1',
      'org1',
    );

    expect(mockPushFingerprint).toHaveBeenCalled();
    // Verify hub push uses federation fingerprint (not content)
    const pushCall = mockPushFingerprint.mock.calls[0];
    expect(pushCall[1].fingerprint).toBe(federationFingerprint);
    checkLocalSpy.mockRestore();
    checkRemoteSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// PR1: Fingerprint split — dual fingerprint tests
// ---------------------------------------------------------------------------

describe('simsubService.performFullCheck — dual fingerprints', () => {
  const contentFingerprint = 'c'.repeat(64);
  const federationFingerprint = 'f'.repeat(64);

  beforeEach(() => {
    mockGetOrCompute.mockResolvedValue({
      contentFingerprint,
      federationFingerprint,
    });
    dbSelectResult = [{ email: 'alice@test.example.com' }];
  });

  it('passes content fingerprint to checkLocal', async () => {
    mockWithRls.mockImplementation(async (_ctx: any, fn: any) => {
      const mockTx = {
        select: () => ({
          from: () => ({
            where: () => ({ limit: () => Promise.resolve([]) }),
          }),
        }),
        insert: () => ({ values: vi.fn().mockResolvedValue(undefined) }),
        update: () => ({
          set: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
        }),
      };
      return fn(mockTx);
    });

    const checkLocalSpy = vi
      .spyOn(simsubService, 'checkLocal')
      .mockResolvedValue([]);
    const checkRemoteSpy = vi
      .spyOn(simsubService, 'checkRemote')
      .mockResolvedValue([]);

    await simsubService.performFullCheck(
      makeEnv(),
      'sub1',
      'v1',
      'user1',
      'org1',
    );

    // checkLocal should receive content fingerprint (2nd arg)
    expect(checkLocalSpy).toHaveBeenCalledWith(
      'user1',
      contentFingerprint,
      'sub1',
    );
    checkLocalSpy.mockRestore();
    checkRemoteSpy.mockRestore();
  });

  it('passes federation fingerprint to checkRemote', async () => {
    mockWithRls.mockImplementation(async (_ctx: any, fn: any) => {
      const mockTx = {
        select: () => ({
          from: () => ({
            where: () => ({ limit: () => Promise.resolve([]) }),
          }),
        }),
        insert: () => ({ values: vi.fn().mockResolvedValue(undefined) }),
        update: () => ({
          set: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
        }),
      };
      return fn(mockTx);
    });

    const checkLocalSpy = vi
      .spyOn(simsubService, 'checkLocal')
      .mockResolvedValue([]);
    const checkRemoteSpy = vi
      .spyOn(simsubService, 'checkRemote')
      .mockResolvedValue([]);

    await simsubService.performFullCheck(
      makeEnv(),
      'sub1',
      'v1',
      'user1',
      'org1',
    );

    // checkRemote should receive federation fingerprint (2nd arg)
    expect(checkRemoteSpy).toHaveBeenCalledWith(
      expect.anything(),
      federationFingerprint,
      expect.stringContaining('did:web:'),
      'org1',
    );
    checkLocalSpy.mockRestore();
    checkRemoteSpy.mockRestore();
  });

  it('stores both fingerprints in sim_sub_checks', async () => {
    mockWithRls.mockImplementation(async (_ctx: any, fn: any) => {
      const insertValues = vi.fn().mockResolvedValue(undefined);
      const mockTx = {
        select: () => ({
          from: () => ({
            where: () => ({ limit: () => Promise.resolve([]) }),
          }),
        }),
        insert: () => ({ values: insertValues }),
        update: () => ({
          set: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
        }),
      };
      return fn(mockTx);
    });

    const checkLocalSpy = vi
      .spyOn(simsubService, 'checkLocal')
      .mockResolvedValue([]);
    const checkRemoteSpy = vi
      .spyOn(simsubService, 'checkRemote')
      .mockResolvedValue([]);

    const result = await simsubService.performFullCheck(
      makeEnv(),
      'sub1',
      'v1',
      'user1',
      'org1',
    );

    expect(result.fingerprint).toBe(contentFingerprint);
    expect(result.federationFingerprint).toBe(federationFingerprint);
    checkLocalSpy.mockRestore();
    checkRemoteSpy.mockRestore();
  });
});

describe('simsubService.handleInboundCheck — uses federation fingerprint', () => {
  it('passes federation column to checkLocal', async () => {
    dbSelectResult = [{ id: 'user1' }];

    const checkLocalSpy = vi
      .spyOn(simsubService, 'checkLocal')
      .mockResolvedValueOnce([]);

    await simsubService.handleInboundCheck(
      makeEnv(),
      'did:web:test.example.com:users:alice',
      'fingerprint123',
    );

    // handleInboundCheck should pass 'federation' as the column parameter
    expect(checkLocalSpy).toHaveBeenCalledWith(
      'user1',
      'fingerprint123',
      undefined,
      'federation',
    );
    checkLocalSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// PR3: resolveEffectivePolicy
// ---------------------------------------------------------------------------

describe('resolveEffectivePolicy', () => {
  it('returns base type when no overrides', () => {
    const result = resolveEffectivePolicy({ type: 'prohibited' }, 'poetry');
    expect(result).toBe('prohibited');
  });

  it('returns base type when genre does not match overrides', () => {
    const result = resolveEffectivePolicy(
      {
        type: 'allowed',
        genreOverrides: [{ genre: 'fiction', type: 'prohibited' }],
      },
      'poetry',
    );
    expect(result).toBe('allowed');
  });

  it('applies genre override when genre matches', () => {
    const result = resolveEffectivePolicy(
      {
        type: 'allowed',
        genreOverrides: [{ genre: 'poetry', type: 'prohibited' }],
      },
      'poetry',
    );
    expect(result).toBe('prohibited');
  });

  it('returns base type when genre is null', () => {
    const result = resolveEffectivePolicy(
      {
        type: 'prohibited',
        genreOverrides: [{ genre: 'poetry', type: 'allowed' }],
      },
      null,
    );
    expect(result).toBe('prohibited');
  });

  it('returns base type when genre is undefined', () => {
    const result = resolveEffectivePolicy(
      {
        type: 'allowed_notify',
        genreOverrides: [{ genre: 'fiction', type: 'prohibited' }],
      },
      undefined,
    );
    expect(result).toBe('allowed_notify');
  });
});

// ---------------------------------------------------------------------------
// PR3: checkSiblingVersions
// ---------------------------------------------------------------------------

describe('simsubService.checkSiblingVersions', () => {
  it('returns empty when version not found', async () => {
    mockWithRls.mockImplementationOnce(async (_ctx: any, fn: any) => {
      return fn({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      });
    });

    const result = await simsubService.checkSiblingVersions('user1', 'v1');
    expect(result).toEqual([]);
  });

  it('returns empty when no sibling versions exist', async () => {
    mockWithRls.mockImplementationOnce(async (_ctx: any, fn: any) => {
      return fn({
        select: () => ({
          from: () => ({
            where: (..._args: any[]) => {
              // First call: find version → return manuscriptId
              // Second call: find siblings → return empty
              return {
                limit: () => Promise.resolve([{ manuscriptId: 'm1' }]),
              };
            },
          }),
        }),
      });
    });

    // The mock above returns manuscriptId but no siblings
    // We need the second select to return empty
    let callCount = 0;
    mockWithRls.mockReset();
    mockWithRls.mockImplementationOnce(async (_ctx: any, fn: any) => {
      return fn({
        select: () => ({
          from: () => ({
            where: () => {
              callCount++;
              if (callCount === 1) {
                return {
                  limit: () => Promise.resolve([{ manuscriptId: 'm1' }]),
                };
              }
              return { limit: () => Promise.resolve([]) };
            },
          }),
        }),
      });
    });

    const result = await simsubService.checkSiblingVersions('user1', 'v1');
    expect(result).toEqual([]);
  });

  it('returns conflicts for active sibling submissions', async () => {
    // Phase 1: user-scoped — find manuscriptId and sibling versions
    let phase1Call = 0;
    mockWithRls.mockImplementationOnce(async (_ctx: any, fn: any) => {
      return fn({
        select: () => ({
          from: () => ({
            where: () => {
              phase1Call++;
              if (phase1Call === 1) {
                return {
                  limit: () => Promise.resolve([{ manuscriptId: 'm1' }]),
                };
              }
              return {
                limit: () => Promise.resolve([{ id: 'v2', versionNumber: 2 }]),
              };
            },
          }),
        }),
      });
    });

    // Phase 2: superuser — find active submissions on sibling versions
    dbSelectResult = [
      {
        submissionId: 's2',
        manuscriptVersionId: 'v2',
        publicationName: 'Lit Mag X',
        status: 'SUBMITTED',
        submittedAt: new Date('2026-02-01'),
      },
    ];

    const result = await simsubService.checkSiblingVersions(
      'user1',
      'v1',
      's1',
    );
    expect(result).toHaveLength(1);
    expect(result[0].publicationName).toBe('Lit Mag X');
    expect(result[0].versionNumber).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// PR3: checkWriterDisclosed
// ---------------------------------------------------------------------------

describe('simsubService.checkWriterDisclosed', () => {
  it('returns active external submissions for manuscript', async () => {
    mockWithRls.mockImplementationOnce(async (_ctx: any, fn: any) => {
      return fn({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve([
                  {
                    id: 'ext1',
                    journalName: 'Poetry Journal',
                    status: 'sent',
                    sentAt: new Date('2026-01-15'),
                  },
                  {
                    id: 'ext2',
                    journalName: 'Fiction Review',
                    status: 'in_review',
                    sentAt: new Date('2026-02-01'),
                  },
                ]),
            }),
          }),
        }),
      });
    });

    const result = await simsubService.checkWriterDisclosed('user1', 'm1');
    expect(result).toHaveLength(2);
    expect(result[0].journalName).toBe('Poetry Journal');
    expect(result[1].journalName).toBe('Fiction Review');
  });

  it('returns empty when no active external submissions', async () => {
    mockWithRls.mockImplementationOnce(async (_ctx: any, fn: any) => {
      return fn({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      });
    });

    const result = await simsubService.checkWriterDisclosed('user1', 'm1');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// PR3: preSubmitCheck — policy model
// ---------------------------------------------------------------------------

describe('simsubService.preSubmitCheck', () => {
  function makeMockTx(overrides: Record<string, unknown> = {}) {
    const selectResults =
      (overrides.selectResults as Record<number, unknown[]>) ?? {};
    let selectCallCount = 0;

    return {
      select: () => ({
        from: () => ({
          where: () => {
            selectCallCount++;
            const result = selectResults[selectCallCount] ?? [];
            return { limit: () => Promise.resolve(result) };
          },
        }),
      }),
      update: () => ({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      insert: () => ({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    };
  }

  it('skips check when policy is allowed', async () => {
    const performFullCheckSpy = vi.spyOn(simsubService, 'performFullCheck');

    const tx = makeMockTx({
      selectResults: {
        // 1st select: submission
        1: [
          {
            manuscriptVersionId: 'v1',
            submissionPeriodId: 'p1',
            simSubOverride: false,
          },
        ],
        // 2nd select: period policy
        2: [{ simSubPolicy: { type: 'allowed' } }],
      },
    });

    await simsubService.preSubmitCheck(
      makeEnv(),
      tx as any,
      'sub1',
      'user1',
      'org1',
    );

    expect(performFullCheckSpy).not.toHaveBeenCalled();
    performFullCheckSpy.mockRestore();
  });

  it('skips check when simSubOverride is true', async () => {
    const performFullCheckSpy = vi.spyOn(simsubService, 'performFullCheck');

    const tx = makeMockTx({
      selectResults: {
        1: [
          {
            manuscriptVersionId: 'v1',
            submissionPeriodId: 'p1',
            simSubOverride: true,
          },
        ],
      },
    });

    await simsubService.preSubmitCheck(
      makeEnv(),
      tx as any,
      'sub1',
      'user1',
      'org1',
    );

    expect(performFullCheckSpy).not.toHaveBeenCalled();
    performFullCheckSpy.mockRestore();
  });

  it('throws SimSubConflictError for prohibited + CONFLICT', async () => {
    const tx = makeMockTx({
      selectResults: {
        1: [
          {
            manuscriptVersionId: 'v1',
            submissionPeriodId: 'p1',
            simSubOverride: false,
          },
        ],
        2: [{ simSubPolicy: { type: 'prohibited' } }],
        3: [{ manuscriptId: 'm1' }], // version lookup
        4: [{ genre: { primary: 'poetry' } }], // manuscript genre
      },
    });

    const performFullCheckSpy = vi
      .spyOn(simsubService, 'performFullCheck')
      .mockResolvedValue({
        result: 'CONFLICT',
        fingerprint: 'fp',
        federationFingerprint: 'ffp',
        localConflicts: [
          { publicationName: 'Test Mag', submittedAt: '2026-01-01' },
        ],
        remoteResults: [],
      });

    await expect(
      simsubService.preSubmitCheck(
        makeEnv(),
        tx as any,
        'sub1',
        'user1',
        'org1',
      ),
    ).rejects.toThrow(SimSubConflictError);

    performFullCheckSpy.mockRestore();
  });

  it('records notify requirement for allowed_notify + CONFLICT', async () => {
    const mockSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    let selectCallCount = 0;
    const tx = {
      select: () => ({
        from: () => ({
          where: () => {
            selectCallCount++;
            if (selectCallCount === 1) {
              return {
                limit: () =>
                  Promise.resolve([
                    {
                      manuscriptVersionId: 'v1',
                      submissionPeriodId: 'p1',
                      simSubOverride: false,
                    },
                  ]),
              };
            }
            if (selectCallCount === 2) {
              return {
                limit: () =>
                  Promise.resolve([
                    {
                      simSubPolicy: {
                        type: 'allowed_notify',
                        notifyWindowHours: 48,
                      },
                    },
                  ]),
              };
            }
            if (selectCallCount === 3) {
              return { limit: () => Promise.resolve([{ manuscriptId: 'm1' }]) };
            }
            if (selectCallCount === 4) {
              return {
                limit: () =>
                  Promise.resolve([{ genre: { primary: 'poetry' } }]),
              };
            }
            return { limit: () => Promise.resolve([]) };
          },
        }),
      }),
      update: () => ({ set: mockSet }),
      insert: () => ({ values: vi.fn().mockResolvedValue(undefined) }),
    };

    const performFullCheckSpy = vi
      .spyOn(simsubService, 'performFullCheck')
      .mockResolvedValue({
        result: 'CONFLICT',
        fingerprint: 'fp',
        federationFingerprint: 'ffp',
        localConflicts: [
          { publicationName: 'Test Mag', submittedAt: '2026-01-01' },
        ],
        remoteResults: [],
      });

    await simsubService.preSubmitCheck(
      makeEnv(),
      tx as any,
      'sub1',
      'user1',
      'org1',
    );

    // Should have called update to set the policy requirement
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        simSubPolicyRequirement: expect.objectContaining({
          type: 'notify',
          windowHours: 48,
        }),
      }),
    );

    performFullCheckSpy.mockRestore();
  });

  it('applies genre override: base allowed, fiction override prohibited', async () => {
    const tx = makeMockTx({
      selectResults: {
        1: [
          {
            manuscriptVersionId: 'v1',
            submissionPeriodId: 'p1',
            simSubOverride: false,
          },
        ],
        2: [
          {
            simSubPolicy: {
              type: 'allowed',
              genreOverrides: [{ genre: 'fiction', type: 'prohibited' }],
            },
          },
        ],
        3: [{ manuscriptId: 'm1' }],
        4: [{ genre: { primary: 'fiction' } }],
      },
    });

    const performFullCheckSpy = vi
      .spyOn(simsubService, 'performFullCheck')
      .mockResolvedValue({
        result: 'CONFLICT',
        fingerprint: 'fp',
        federationFingerprint: 'ffp',
        localConflicts: [
          { publicationName: 'Test Mag', submittedAt: '2026-01-01' },
        ],
        remoteResults: [],
      });

    await expect(
      simsubService.preSubmitCheck(
        makeEnv(),
        tx as any,
        'sub1',
        'user1',
        'org1',
      ),
    ).rejects.toThrow(SimSubConflictError);

    performFullCheckSpy.mockRestore();
  });

  it('genre override allows: base prohibited, poetry override allowed', async () => {
    const performFullCheckSpy = vi.spyOn(simsubService, 'performFullCheck');

    const tx = makeMockTx({
      selectResults: {
        1: [
          {
            manuscriptVersionId: 'v1',
            submissionPeriodId: 'p1',
            simSubOverride: false,
          },
        ],
        2: [
          {
            simSubPolicy: {
              type: 'prohibited',
              genreOverrides: [{ genre: 'poetry', type: 'allowed' }],
            },
          },
        ],
        3: [{ manuscriptId: 'm1' }],
        4: [{ genre: { primary: 'poetry' } }],
      },
    });

    await simsubService.preSubmitCheck(
      makeEnv(),
      tx as any,
      'sub1',
      'user1',
      'org1',
    );

    // Should NOT call performFullCheck because effective type is 'allowed'
    expect(performFullCheckSpy).not.toHaveBeenCalled();
    performFullCheckSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// PR3: performFullCheck — includes sibling + writer-disclosed
// ---------------------------------------------------------------------------

describe('simsubService.performFullCheck — version-aware checks', () => {
  const contentFingerprint = 'c'.repeat(64);
  const federationFingerprint = 'f'.repeat(64);

  beforeEach(() => {
    mockGetOrCompute.mockResolvedValue({
      contentFingerprint,
      federationFingerprint,
    });
    dbSelectResult = [{ email: 'alice@test.example.com' }];
  });

  it('includes sibling and writer-disclosed conflicts in result', async () => {
    mockWithRls.mockImplementation(async (_ctx: any, fn: any) => {
      const mockTx = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ manuscriptId: 'm1' }]),
            }),
          }),
        }),
        insert: () => ({ values: vi.fn().mockResolvedValue(undefined) }),
        update: () => ({
          set: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
        }),
      };
      return fn(mockTx);
    });

    const checkLocalSpy = vi
      .spyOn(simsubService, 'checkLocal')
      .mockResolvedValue([]);
    const checkRemoteSpy = vi
      .spyOn(simsubService, 'checkRemote')
      .mockResolvedValue([]);
    const checkSiblingSpy = vi
      .spyOn(simsubService, 'checkSiblingVersions')
      .mockResolvedValue([
        {
          versionId: 'v2',
          versionNumber: 2,
          submissionId: 's2',
          publicationName: 'Sibling Mag',
          status: 'SUBMITTED',
          submittedAt: '2026-02-01T00:00:00Z',
        },
      ]);
    const checkWriterSpy = vi
      .spyOn(simsubService, 'checkWriterDisclosed')
      .mockResolvedValue([
        {
          externalSubmissionId: 'ext1',
          journalName: 'External Journal',
          status: 'sent',
          sentAt: '2026-01-15T00:00:00Z',
        },
      ]);

    const result = await simsubService.performFullCheck(
      makeEnv(),
      'sub1',
      'v1',
      'user1',
      'org1',
    );

    expect(result.result).toBe('CONFLICT');
    expect(result.siblingVersionConflicts).toHaveLength(1);
    expect(result.writerDisclosedConflicts).toHaveLength(1);
    expect(result.siblingVersionConflicts![0].publicationName).toBe(
      'Sibling Mag',
    );
    expect(result.writerDisclosedConflicts![0].journalName).toBe(
      'External Journal',
    );

    checkLocalSpy.mockRestore();
    checkRemoteSpy.mockRestore();
    checkSiblingSpy.mockRestore();
    checkWriterSpy.mockRestore();
  });

  it('returns CLEAR when no conflicts of any kind', async () => {
    mockWithRls.mockImplementation(async (_ctx: any, fn: any) => {
      const mockTx = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ manuscriptId: 'm1' }]),
            }),
          }),
        }),
        insert: () => ({ values: vi.fn().mockResolvedValue(undefined) }),
        update: () => ({
          set: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
        }),
      };
      return fn(mockTx);
    });

    const checkLocalSpy = vi
      .spyOn(simsubService, 'checkLocal')
      .mockResolvedValue([]);
    const checkRemoteSpy = vi
      .spyOn(simsubService, 'checkRemote')
      .mockResolvedValue([]);
    const checkSiblingSpy = vi
      .spyOn(simsubService, 'checkSiblingVersions')
      .mockResolvedValue([]);
    const checkWriterSpy = vi
      .spyOn(simsubService, 'checkWriterDisclosed')
      .mockResolvedValue([]);

    const result = await simsubService.performFullCheck(
      makeEnv(),
      'sub1',
      'v1',
      'user1',
      'org1',
    );

    expect(result.result).toBe('CLEAR');
    expect(result.siblingVersionConflicts).toHaveLength(0);
    expect(result.writerDisclosedConflicts).toHaveLength(0);

    checkLocalSpy.mockRestore();
    checkRemoteSpy.mockRestore();
    checkSiblingSpy.mockRestore();
    checkWriterSpy.mockRestore();
  });
});
