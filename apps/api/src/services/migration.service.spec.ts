import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockWithRls, mockDb } = vi.hoisted(() => {
  const mockWithRls = vi.fn();
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
  };
  return { mockWithRls, mockDb };
});

vi.mock('@colophony/db', () => ({
  db: mockDb,
  withRls: (...args: unknown[]) => mockWithRls(...args),
  identityMigrations: {
    id: 'identityMigrations.id',
    userId: 'identityMigrations.userId',
    organizationId: 'identityMigrations.organizationId',
    direction: 'identityMigrations.direction',
    peerDomain: 'identityMigrations.peerDomain',
    peerInstanceUrl: 'identityMigrations.peerInstanceUrl',
    userDid: 'identityMigrations.userDid',
    peerUserDid: 'identityMigrations.peerUserDid',
    status: 'identityMigrations.status',
    migrationToken: 'identityMigrations.migrationToken',
    callbackUrl: 'identityMigrations.callbackUrl',
    bundleMetadata: 'identityMigrations.bundleMetadata',
  },
  submissions: {
    id: 'submissions.id',
    organizationId: 'submissions.organizationId',
    submitterId: 'submissions.submitterId',
    title: 'submissions.title',
    coverLetter: 'submissions.coverLetter',
    content: 'submissions.content',
    status: 'submissions.status',
    formData: 'submissions.formData',
    transferredFromDomain: 'submissions.transferredFromDomain',
    transferredFromTransferId: 'submissions.transferredFromTransferId',
  },
  trustedPeers: {
    domain: 'trustedPeers.domain',
    instanceUrl: 'trustedPeers.instanceUrl',
    status: 'trustedPeers.status',
    id: 'trustedPeers.id',
    organizationId: 'trustedPeers.organizationId',
  },
  users: {
    id: 'users.id',
    email: 'users.email',
    deletedAt: 'users.deletedAt',
    isGuest: 'users.isGuest',
    migratedAt: 'users.migratedAt',
    migratedToDomain: 'users.migratedToDomain',
    migratedToDid: 'users.migratedToDid',
  },
  files: {
    id: 'files.id',
    filename: 'files.filename',
    mimeType: 'files.mimeType',
    size: 'files.size',
    storageKey: 'files.storageKey',
    scanStatus: 'files.scanStatus',
  },
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
  not: vi.fn(),
  inArray: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  count: vi.fn(),
  getTableColumns: vi.fn().mockReturnValue({}),
}));

const { mockSignJWT } = vi.hoisted(() => ({
  mockSignJWT: {
    setProtectedHeader: vi.fn().mockReturnThis(),
    setIssuer: vi.fn().mockReturnThis(),
    setSubject: vi.fn().mockReturnThis(),
    setAudience: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    setJti: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue('mock.jwt.token'),
  },
}));

vi.mock('jose', () => ({
  SignJWT: vi.fn().mockImplementation(() => mockSignJWT),
  jwtVerify: vi.fn(),
}));

vi.mock('./federation.service.js', () => ({
  federationService: {
    getOrInitConfig: vi.fn().mockResolvedValue({
      publicKey:
        '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEARhJrpKFgxPmbYP07KnlUuSkZordGLP7bkL8JrMRK0QM=\n-----END PUBLIC KEY-----',
      privateKey: 'test-private-key',
      keyId: 'local.example.com#main',
      enabled: true,
    }),
  },
  domainToDid: vi.fn((d: string) => d.replace(/:/g, '%3A')),
}));

vi.mock('../federation/http-signatures.js', () => ({
  signFederationRequest: vi.fn().mockReturnValue({
    headers: { signature: 'mock-sig', 'signature-input': 'mock-input' },
  }),
}));

vi.mock('./audit.service.js', () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
    logDirect: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('./migration-bundle.service.js', () => ({
  migrationBundleService: {
    assembleBundleForUser: vi.fn().mockResolvedValue({
      protocolVersion: '1.0',
      originDomain: 'local.example.com',
      userDid: 'did:web:local.example.com:users:test',
      destinationDomain: 'remote.example.com',
      destinationUserDid: null,
      identity: { email: 'test@local.example.com', alsoKnownAs: [] },
      submissionHistory: [
        {
          originSubmissionId: 'sub-1',
          title: 'Old',
          status: 'rejected',
          statusHistory: [],
        },
      ],
      activeSubmissions: [],
      bundleToken: 'mock.bundle.jwt',
      createdAt: new Date().toISOString(),
    }),
    signBundleToken: vi.fn().mockResolvedValue({
      token: 'mock.bundle.jwt',
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    }),
  },
}));

vi.mock('./s3.js', () => ({
  createS3Client: vi.fn(),
  getObjectStream: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  migrationService,
  MigrationInvalidStateError,
  MigrationCapabilityError,
  MigrationAlreadyActiveError,
  MigrationUserNotFoundError,
  MigrationTokenError,
} from './migration.service.js';
import * as jose from 'jose';
import { auditService } from './audit.service.js';

const validUuid = '00000000-0000-4000-a000-000000000001';
const validUuid2 = '00000000-0000-4000-a000-000000000002';
const validUuid3 = '00000000-0000-4000-a000-000000000003';

const testEnv = {
  FEDERATION_ENABLED: true,
  FEDERATION_DOMAIN: 'local.example.com',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'submissions',
  S3_ACCESS_KEY: 'minioadmin',
  S3_SECRET_KEY: 'minioadmin',
  S3_REGION: 'us-east-1',
} as any;

describe('migrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish mock chain after clearAllMocks clears implementations
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.limit.mockReturnThis();
    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.returning.mockReturnThis();
    mockDb.orderBy.mockReturnThis();
    mockDb.offset.mockReturnThis();
    // Reset global fetch
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            migrationId: validUuid,
            status: 'pending_approval',
          }),
        text: () => Promise.resolve('ok'),
      }),
    );
  });

  // ─── Origin-side ───

  describe('handleMigrationRequest', () => {
    it('creates PENDING_APPROVAL record for valid request', async () => {
      // User lookup
      mockDb.limit.mockResolvedValueOnce([
        {
          id: validUuid,
          email: 'test@local.example.com',
          deletedAt: null,
          isGuest: false,
          migratedAt: null,
        },
      ]);

      // No existing migration
      mockDb.limit.mockResolvedValueOnce([]);

      // Trusted peer exists
      mockDb.limit.mockResolvedValueOnce([{ id: validUuid2 }]);

      // Insert succeeds
      mockDb.values.mockResolvedValueOnce(undefined);

      const result = await migrationService.handleMigrationRequest(
        testEnv,
        'remote.example.com',
        {
          userEmail: 'test@local.example.com',
          destinationDomain: 'remote.example.com',
          destinationUserDid: null,
          callbackUrl:
            'https://remote.example.com/federation/v1/migrations/bundle-delivery',
          protocolVersion: '1.0',
        },
      );

      expect(result.status).toBe('pending_approval');
      expect(result.migrationId).toBeTruthy();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(auditService.logDirect).toHaveBeenCalled();
    });

    it('rejects unknown user', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(
        migrationService.handleMigrationRequest(testEnv, 'remote.example.com', {
          userEmail: 'nobody@local.example.com',
          destinationDomain: 'remote.example.com',
          destinationUserDid: null,
          callbackUrl: 'https://remote.example.com/cb',
          protocolVersion: '1.0',
        }),
      ).rejects.toThrow(MigrationUserNotFoundError);
    });

    it('rejects untrusted peer', async () => {
      // User found
      mockDb.limit.mockResolvedValueOnce([
        {
          id: validUuid,
          email: 'test@local.example.com',
          deletedAt: null,
          isGuest: false,
          migratedAt: null,
        },
      ]);
      // No existing migration
      mockDb.limit.mockResolvedValueOnce([]);
      // No trusted peer
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(
        migrationService.handleMigrationRequest(
          testEnv,
          'untrusted.example.com',
          {
            userEmail: 'test@local.example.com',
            destinationDomain: 'untrusted.example.com',
            destinationUserDid: null,
            callbackUrl: 'https://untrusted.example.com/cb',
            protocolVersion: '1.0',
          },
        ),
      ).rejects.toThrow(MigrationCapabilityError);
    });

    it('rejects duplicate active migration', async () => {
      // User found
      mockDb.limit.mockResolvedValueOnce([
        {
          id: validUuid,
          email: 'test@local.example.com',
          deletedAt: null,
          isGuest: false,
          migratedAt: null,
        },
      ]);
      // Existing active migration
      mockDb.limit.mockResolvedValueOnce([{ id: validUuid2 }]);

      await expect(
        migrationService.handleMigrationRequest(testEnv, 'remote.example.com', {
          userEmail: 'test@local.example.com',
          destinationDomain: 'remote.example.com',
          destinationUserDid: null,
          callbackUrl: 'https://remote.example.com/cb',
          protocolVersion: '1.0',
        }),
      ).rejects.toThrow(MigrationAlreadyActiveError);
    });
  });

  describe('approveMigration', () => {
    it('builds bundle and POSTs to callback', async () => {
      mockWithRls.mockImplementation(async (_ctx: any, fn: any) => {
        const mockTx = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([
            {
              id: validUuid,
              userId: validUuid2,
              status: 'PENDING_APPROVAL',
              direction: 'outbound',
              peerDomain: 'remote.example.com',
              callbackUrl: 'https://remote.example.com/cb',
              userDid: 'did:web:local.example.com:users:test',
              peerUserDid: null,
            },
          ]),
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
        };
        return fn(mockTx);
      });

      // User lookup
      mockDb.limit.mockResolvedValueOnce([{ email: 'test@local.example.com' }]);

      await migrationService.approveMigration(testEnv, {
        userId: validUuid2,
        migrationId: validUuid,
      });

      expect(fetch).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(auditService.logDirect).toHaveBeenCalled();
    });

    it('rejects non-PENDING_APPROVAL migration', async () => {
      mockWithRls.mockImplementation(async (_ctx: any, fn: any) => {
        const mockTx = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([
            {
              id: validUuid,
              status: 'BUNDLE_SENT',
              direction: 'outbound',
            },
          ]),
        };
        return fn(mockTx);
      });

      await expect(
        migrationService.approveMigration(testEnv, {
          userId: validUuid2,
          migrationId: validUuid,
        }),
      ).rejects.toThrow(MigrationInvalidStateError);
    });
  });

  describe('rejectMigration', () => {
    it('transitions to REJECTED', async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockSet = vi.fn().mockReturnThis();
      const mockWhere2 = vi.fn().mockResolvedValue(undefined);

      mockWithRls.mockImplementation(async (_ctx: any, fn: any) => {
        const mockTx = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([
            {
              id: validUuid,
              status: 'PENDING_APPROVAL',
              direction: 'outbound',
            },
          ]),
          update: mockUpdate,
          set: mockSet,
        };
        // On second call (update), chain differently
        mockSet.mockReturnValue({ where: mockWhere2 });
        mockUpdate.mockReturnValue({ set: mockSet });
        return fn(mockTx);
      });

      await migrationService.rejectMigration(testEnv, {
        userId: validUuid2,
        migrationId: validUuid,
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(auditService.logDirect).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'MIGRATION_REJECTED',
        }),
      );
    });
  });

  describe('handleMigrationComplete', () => {
    it('soft-deactivates user and broadcasts', async () => {
      // The implementation makes these db calls in order:
      // 1. db.select().from().where().limit() — find migration
      // 2. db.update(users).set({...}).where(...) — soft deactivate
      // 3. db.select().from().where() — broadcast peers query (no .limit())
      // 4. db.update(identityMigrations).set({...}).where(...) — update migration status
      //
      // We use mockResolvedValueOnce on .limit() for query #1, and
      // mockReturnValueOnce on .set() for the two update chains.
      // For the broadcast peers query (#3), .where() returns [] (no peers).

      // Query #1: find migration — terminates at .limit()
      mockDb.limit.mockResolvedValueOnce([
        {
          id: validUuid,
          userId: validUuid2,
          peerDomain: 'remote.example.com',
          direction: 'outbound',
          userDid: 'did:web:local.example.com:users:test',
        },
      ]);

      // Query #2: soft-deactivate — db.update().set().where()
      // .set() needs to return { where: fn } once
      mockDb.set.mockReturnValueOnce({
        where: vi.fn().mockResolvedValue(undefined),
      });

      // Query #3: broadcast peers — db.select().from().where()
      // .where() is the terminal call here (no .limit()).
      // mockDb.where is called twice on mockDb:
      //   1st for find migration (needs to return this for .limit() chain)
      //   2nd for broadcast peers (needs to resolve to [])
      // Queue: first returns mockDb (to preserve chain), second resolves to []
      mockDb.where
        .mockReturnValueOnce(mockDb) // 1st .where() — chain to .limit()
        .mockResolvedValueOnce([]); // 2nd .where() — broadcast peers terminal

      // Query #4: update migration status — db.update().set().where()
      mockDb.set.mockReturnValueOnce({
        where: vi.fn().mockResolvedValue(undefined),
      });

      await migrationService.handleMigrationComplete(
        testEnv,
        'remote.example.com',
        {
          migrationId: validUuid,
          destinationUserDid: 'did:web:remote.example.com:users:test',
          status: 'completed',
        },
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(auditService.logDirect).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'MIGRATION_COMPLETED',
        }),
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(auditService.logDirect).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USER_SOFT_DEACTIVATED',
        }),
      );
    });
  });

  // ─── Destination-side ───

  describe('requestMigration', () => {
    it('sends S2S request to origin', async () => {
      // Peer lookup via withRls
      mockWithRls.mockImplementation(async (_ctx: any, fn: any) => {
        const mockTx = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([
            {
              domain: 'origin.example.com',
              instanceUrl: 'https://origin.example.com',
            },
          ]),
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockResolvedValue(undefined),
        };
        return fn(mockTx);
      });

      // User email lookup
      mockDb.limit.mockResolvedValueOnce([{ email: 'user@local.example.com' }]);

      const result = await migrationService.requestMigration(testEnv, {
        userId: validUuid,
        organizationId: validUuid2,
        originDomain: 'origin.example.com',
        originEmail: 'user@origin.example.com',
      });

      expect(result.migrationId).toBeTruthy();
      expect(result.status).toBe('pending');
      expect(fetch).toHaveBeenCalled();
    });
  });

  describe('handleBundleDelivery', () => {
    it('imports closed submissions with provenance', async () => {
      // Find pending migration (superuser) — db.select().from().where().limit()
      mockDb.limit.mockResolvedValueOnce([
        {
          id: validUuid,
          organizationId: validUuid2,
          direction: 'inbound',
          peerDomain: 'origin.example.com',
          peerInstanceUrl: 'https://origin.example.com',
          status: 'PENDING',
          userDid: 'did:web:local.example.com:users:test',
        },
      ]);

      // Import submissions (withRls) — called twice (history + active)
      mockWithRls.mockImplementation(async (_ctx: any, fn: any) => {
        const mockTx = {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockResolvedValue(undefined),
        };
        return fn(mockTx);
      });

      // Migration update — db.update().set().where()
      mockDb.set.mockReturnValueOnce({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const result = await migrationService.handleBundleDelivery(
        testEnv,
        'origin.example.com',
        {
          migrationId: validUuid,
          bundle: {
            protocolVersion: '1.0',
            originDomain: 'origin.example.com',
            userDid: 'did:web:origin.example.com:users:test',
            destinationDomain: 'local.example.com',
            destinationUserDid: null,
            identity: {
              email: 'test@origin.example.com',
              alsoKnownAs: [],
            },
            submissionHistory: [
              {
                originSubmissionId: validUuid3,
                title: 'Old Story',
                genre: null,
                coverLetter: null,
                status: 'rejected',
                formData: null,
                submittedAt: null,
                decidedAt: null,
                publicationName: 'Test Mag',
                periodName: null,
                statusHistory: [],
              },
            ],
            activeSubmissions: [],
            bundleToken: 'mock.bundle.jwt',
            createdAt: new Date().toISOString(),
          },
        },
      );

      expect(result.status).toBe('accepted');
      expect(result.migrationId).toBe(validUuid);
    });

    it('is idempotent on replay (PROCESSING status)', async () => {
      // No PENDING migration found
      mockDb.limit.mockResolvedValueOnce([]);

      // But find PROCESSING migration
      mockDb.limit.mockResolvedValueOnce([
        { id: validUuid, status: 'PROCESSING' },
      ]);

      const result = await migrationService.handleBundleDelivery(
        testEnv,
        'origin.example.com',
        {
          migrationId: validUuid,
          bundle: {
            protocolVersion: '1.0',
            originDomain: 'origin.example.com',
            userDid: 'did:web:origin.example.com:users:test',
            destinationDomain: 'local.example.com',
            destinationUserDid: null,
            identity: {
              email: 'test@origin.example.com',
              alsoKnownAs: [],
            },
            submissionHistory: [],
            activeSubmissions: [],
            bundleToken: 'mock.bundle.jwt',
            createdAt: new Date().toISOString(),
          },
        },
      );

      expect(result.status).toBe('accepted');
      expect(result.message).toBe('Already processed');
    });
  });

  describe('handleMigrationBroadcast', () => {
    it('logs audit for broadcast', async () => {
      await migrationService.handleMigrationBroadcast(
        testEnv,
        'origin.example.com',
        {
          userDid: 'did:web:origin.example.com:users:test',
          migratedToDomain: 'remote.example.com',
          migratedToUserDid: 'did:web:remote.example.com:users:test',
          originDomain: 'origin.example.com',
        },
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(auditService.logDirect).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'MIGRATION_BROADCAST_RECEIVED',
        }),
      );
    });
  });

  // ─── File serving ───

  describe('verifyMigrationToken', () => {
    it('validates JWT and returns userId', async () => {
      // Migration lookup
      mockDb.limit.mockResolvedValueOnce([
        {
          id: validUuid,
          userId: validUuid2,
          status: 'BUNDLE_SENT',
        },
      ]);

      // JWT verify
      (jose.jwtVerify as any).mockResolvedValueOnce({
        payload: {
          jti: validUuid,
          fileIds: ['file-1', 'file-2'],
        },
      });

      // Submission ownership check
      mockDb.limit.mockResolvedValueOnce([{ id: validUuid3 }]);

      const result = await migrationService.verifyMigrationToken(
        testEnv,
        'valid.jwt.token',
        validUuid,
        validUuid3,
        'file-1',
      );

      expect(result.userId).toBe(validUuid2);
    });

    it('rejects expired token', async () => {
      mockDb.limit.mockResolvedValueOnce([
        {
          id: validUuid,
          userId: validUuid2,
          status: 'BUNDLE_SENT',
        },
      ]);

      (jose.jwtVerify as any).mockRejectedValueOnce(new Error('Token expired'));

      await expect(
        migrationService.verifyMigrationToken(
          testEnv,
          'expired.jwt.token',
          validUuid,
          validUuid3,
          'file-1',
        ),
      ).rejects.toThrow(MigrationTokenError);
    });

    it('rejects when submissionId does not belong to migration user', async () => {
      // Migration lookup
      mockDb.limit.mockResolvedValueOnce([
        {
          id: validUuid,
          userId: validUuid2,
          status: 'BUNDLE_SENT',
        },
      ]);

      // JWT verify — valid token with fileId in allowlist
      (jose.jwtVerify as any).mockResolvedValueOnce({
        payload: {
          jti: validUuid,
          fileIds: ['file-1', 'file-2'],
        },
      });

      // Submission ownership check — no match
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(
        migrationService.verifyMigrationToken(
          testEnv,
          'valid.jwt.token',
          validUuid,
          validUuid3,
          'file-1',
        ),
      ).rejects.toThrow(MigrationTokenError);
    });

    it('rejects file not in allowlist', async () => {
      mockDb.limit.mockResolvedValueOnce([
        {
          id: validUuid,
          userId: validUuid2,
          status: 'BUNDLE_SENT',
        },
      ]);

      (jose.jwtVerify as any).mockResolvedValueOnce({
        payload: {
          jti: validUuid,
          fileIds: ['file-1', 'file-2'],
        },
      });

      await expect(
        migrationService.verifyMigrationToken(
          testEnv,
          'valid.jwt.token',
          validUuid,
          validUuid3,
          'file-not-allowed',
        ),
      ).rejects.toThrow(MigrationTokenError);
    });
  });
});
