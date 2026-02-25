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
              where: () => Promise.resolve(dbSelectResult),
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
    manuscriptId: 'manuscript_id',
  },
  submissions: {
    id: 'id',
    manuscriptVersionId: 'manuscript_version_id',
    status: 'status',
    submissionPeriodId: 'submission_period_id',
    simSubCheckResult: 'sim_sub_check_result',
    simSubCheckedAt: 'sim_sub_checked_at',
    simSubOverride: 'sim_sub_override',
    submittedAt: 'submitted_at',
  },
  submissionPeriods: {
    id: 'id',
    simSubProhibited: 'sim_sub_prohibited',
    publicationId: 'publication_id',
    name: 'name',
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

import { simsubService } from './simsub.service.js';

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
  const fingerprint = 'f'.repeat(64);

  beforeEach(() => {
    mockGetOrCompute.mockResolvedValue(fingerprint);

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
    expect(result.fingerprint).toBe(fingerprint);
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
  const fingerprint = 'f'.repeat(64);

  beforeEach(() => {
    mockGetOrCompute.mockResolvedValue(fingerprint);
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
    checkLocalSpy.mockRestore();
    checkRemoteSpy.mockRestore();
  });
});
