import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
  };
  return { mockDb };
});

vi.mock('@colophony/db', () => ({
  db: mockDb,
  submissions: {
    id: 'submissions.id',
    submitterId: 'submissions.submitterId',
    title: 'submissions.title',
    coverLetter: 'submissions.coverLetter',
    content: 'submissions.content',
    status: 'submissions.status',
    formData: 'submissions.formData',
    submittedAt: 'submissions.submittedAt',
    organizationId: 'submissions.organizationId',
    manuscriptVersionId: 'submissions.manuscriptVersionId',
    submissionPeriodId: 'submissions.submissionPeriodId',
  },
  files: {
    id: 'files.id',
    filename: 'files.filename',
    mimeType: 'files.mimeType',
    size: 'files.size',
    scanStatus: 'files.scanStatus',
    manuscriptVersionId: 'files.manuscriptVersionId',
  },
  manuscriptVersions: {
    id: 'manuscriptVersions.id',
    contentFingerprint: 'manuscriptVersions.contentFingerprint',
    manuscriptId: 'manuscriptVersions.manuscriptId',
  },
  manuscripts: {
    id: 'manuscripts.id',
    genre: 'manuscripts.genre',
  },
  organizations: { id: 'organizations.id', name: 'organizations.name' },
  submissionPeriods: {
    id: 'submissionPeriods.id',
    name: 'submissionPeriods.name',
  },
  submissionHistory: {
    submissionId: 'submissionHistory.submissionId',
    fromStatus: 'submissionHistory.fromStatus',
    toStatus: 'submissionHistory.toStatus',
    changedAt: 'submissionHistory.changedAt',
    comment: 'submissionHistory.comment',
  },
  users: { id: 'users.id' },
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
}));

const { mockSignJWT } = vi.hoisted(() => ({
  mockSignJWT: {
    setProtectedHeader: vi.fn().mockReturnThis(),
    setIssuer: vi.fn().mockReturnThis(),
    setSubject: vi.fn().mockReturnThis(),
    setAudience: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    setJti: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue('mock.bundle.jwt'),
  },
}));

vi.mock('jose', () => {
  // Must use a real class so `new jose.SignJWT(...)` works
  class MockSignJWT {
    setProtectedHeader() {
      return this;
    }
    setIssuer(...args: unknown[]) {
      mockSignJWT.setIssuer(...args);
      return this;
    }
    setSubject(...args: unknown[]) {
      mockSignJWT.setSubject(...args);
      return this;
    }
    setAudience(...args: unknown[]) {
      mockSignJWT.setAudience(...args);
      return this;
    }
    setExpirationTime(...args: unknown[]) {
      mockSignJWT.setExpirationTime(...args);
      return this;
    }
    setJti(...args: unknown[]) {
      mockSignJWT.setJti(...args);
      return this;
    }
    async sign() {
      return mockSignJWT.sign();
    }
  }
  return { SignJWT: MockSignJWT };
});

vi.mock('node:crypto', async () => {
  const actual =
    await vi.importActual<typeof import('node:crypto')>('node:crypto');
  return {
    ...actual,
    default: {
      ...actual,
      createPrivateKey: vi.fn().mockReturnValue('mock-private-key-obj'),
    },
  };
});

vi.mock('./federation.service.js', () => ({
  federationService: {
    getOrInitConfig: vi.fn().mockResolvedValue({
      publicKey: 'test-pub-key',
      privateKey: 'test-private-key',
      keyId: 'local.example.com#main',
      enabled: true,
    }),
  },
  domainToDid: vi.fn((d: string) => d.replace(/:/g, '%3A')),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { migrationBundleService } from './migration-bundle.service.js';

const validUuid = '00000000-0000-4000-a000-000000000001';
const validUuid2 = '00000000-0000-4000-a000-000000000002';

const testEnv = {
  FEDERATION_ENABLED: true,
  FEDERATION_DOMAIN: 'local.example.com',
} as any;

describe('migrationBundleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('assembleBundleForUser', () => {
    it('separates closed and active submissions', async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        return mockDb;
      });

      // Batch flow: 1. submissions, 2. orgs, 3. periods, 4. genre JOIN,
      //             5. history, 6. batch files, 7. batch versions
      mockDb.where.mockImplementation(() => {
        if (selectCallCount === 1) {
          // Submissions query
          return [
            {
              id: validUuid,
              title: 'Rejected Story',
              coverLetter: 'Dear ed',
              content: null,
              status: 'REJECTED',
              formData: null,
              submittedAt: new Date('2025-01-01'),
              organizationId: validUuid2,
              manuscriptVersionId: null,
              submissionPeriodId: null,
            },
            {
              id: validUuid2,
              title: 'Active Draft',
              coverLetter: null,
              content: 'Some text',
              status: 'SUBMITTED',
              formData: null,
              submittedAt: new Date('2025-02-01'),
              organizationId: validUuid2,
              manuscriptVersionId: validUuid,
              submissionPeriodId: null,
            },
          ];
        }
        if (selectCallCount === 2) {
          // Orgs lookup
          return [{ id: validUuid2, name: 'Test Magazine' }];
        }
        // 3: periods — skipped (no submissionPeriodIds)
        if (selectCallCount === 3) {
          // Genre JOIN (one version)
          return [{ versionId: validUuid, genre: null }];
        }
        if (selectCallCount === 4) {
          // History
          return [];
        }
        if (selectCallCount === 5) {
          // Batch files
          return [
            {
              id: 'file-1',
              filename: 'story.docx',
              mimeType: 'application/docx',
              size: 12345,
              manuscriptVersionId: validUuid,
            },
          ];
        }
        if (selectCallCount === 6) {
          // Batch versions
          return [{ id: validUuid, contentFingerprint: 'abc123' }];
        }
        return [];
      });

      const bundle = await migrationBundleService.assembleBundleForUser(
        testEnv,
        {
          userId: validUuid,
          userEmail: 'user@test.com',
          userDid: 'did:web:local.example.com:users:user',
          destinationDomain: 'remote.example.com',
          destinationUserDid: null,
          migrationId: validUuid2,
        },
      );

      expect(bundle.protocolVersion).toBe('1.0');
      expect(bundle.originDomain).toBe('local.example.com');
      expect(bundle.bundleToken).toBe('mock.bundle.jwt');
      expect(bundle.identity.email).toBe('user@test.com');
      // CSR status mapping
      expect(bundle.submissionHistory[0].status).toBe('rejected');
      expect(bundle.activeSubmissions[0].status).toBe('sent');
      // statusHistory present
      expect(bundle.submissionHistory[0].statusHistory).toEqual([]);
      expect(bundle.activeSubmissions[0].statusHistory).toEqual([]);
    });

    it('handles no submissions gracefully', async () => {
      // Empty submissions
      mockDb.where.mockReturnValue([]);

      const bundle = await migrationBundleService.assembleBundleForUser(
        testEnv,
        {
          userId: validUuid,
          userEmail: 'user@test.com',
          userDid: 'did:web:local.example.com:users:user',
          destinationDomain: 'remote.example.com',
          destinationUserDid: null,
          migrationId: validUuid2,
        },
      );

      expect(bundle.submissionHistory).toEqual([]);
      expect(bundle.activeSubmissions).toEqual([]);
      expect(bundle.bundleToken).toBe('mock.bundle.jwt');
    });

    it('creates valid JWT with file IDs', async () => {
      // Empty submissions
      mockDb.where.mockReturnValue([]);

      await migrationBundleService.assembleBundleForUser(testEnv, {
        userId: validUuid,
        userEmail: 'user@test.com',
        userDid: 'did:web:local.example.com:users:user',
        destinationDomain: 'remote.example.com',
        destinationUserDid: null,
        migrationId: validUuid2,
      });

      expect(mockSignJWT.setIssuer).toHaveBeenCalledWith('local.example.com');
      expect(mockSignJWT.setSubject).toHaveBeenCalledWith(validUuid);
      expect(mockSignJWT.setAudience).toHaveBeenCalledWith(
        'remote.example.com',
      );
      expect(mockSignJWT.setJti).toHaveBeenCalledWith(validUuid2);
    });

    it('batch-fetches files and versions instead of per-submission queries', async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        return mockDb;
      });

      // Two active submissions with different manuscriptVersionIds
      const mvId1 = '00000000-0000-4000-a000-000000000010';
      const mvId2 = '00000000-0000-4000-a000-000000000020';

      mockDb.where.mockImplementation(() => {
        if (selectCallCount === 1) {
          // Submissions query
          return [
            {
              id: validUuid,
              title: 'Active 1',
              coverLetter: null,
              content: 'Text',
              status: 'SUBMITTED',
              formData: null,
              submittedAt: new Date('2025-01-01'),
              organizationId: validUuid2,
              manuscriptVersionId: mvId1,
              submissionPeriodId: null,
            },
            {
              id: validUuid2,
              title: 'Active 2',
              coverLetter: null,
              content: 'Text2',
              status: 'UNDER_REVIEW',
              formData: null,
              submittedAt: new Date('2025-02-01'),
              organizationId: validUuid2,
              manuscriptVersionId: mvId2,
              submissionPeriodId: null,
            },
          ];
        }
        if (selectCallCount === 2) {
          // Orgs lookup (via inArray)
          return [{ id: validUuid2, name: 'Test Mag' }];
        }
        // 3: periods — skipped (no submissionPeriodIds)
        if (selectCallCount === 3) {
          // Genre JOIN (both versions)
          return [
            { versionId: mvId1, genre: null },
            { versionId: mvId2, genre: null },
          ];
        }
        if (selectCallCount === 4) {
          // History
          return [];
        }
        if (selectCallCount === 5) {
          // Batch files fetch (single query for both versions)
          return [
            {
              id: 'f1',
              filename: 'a.docx',
              mimeType: 'application/docx',
              size: 100,
              manuscriptVersionId: mvId1,
            },
            {
              id: 'f2',
              filename: 'b.docx',
              mimeType: 'application/docx',
              size: 200,
              manuscriptVersionId: mvId2,
            },
          ];
        }
        if (selectCallCount === 6) {
          // Batch versions fetch
          return [
            { id: mvId1, contentFingerprint: 'fp-1' },
            { id: mvId2, contentFingerprint: 'fp-2' },
          ];
        }
        return [];
      });

      const bundle = await migrationBundleService.assembleBundleForUser(
        testEnv,
        {
          userId: validUuid,
          userEmail: 'user@test.com',
          userDid: 'did:web:local.example.com:users:user',
          destinationDomain: 'remote.example.com',
          destinationUserDid: null,
          migrationId: validUuid2,
        },
      );

      // Should have made exactly 6 select calls:
      // 1. submissions, 2. orgs, 3. genre JOIN, 4. history,
      // 5. batch files, 6. batch versions (no periods — all null)
      expect(selectCallCount).toBe(6);
      expect(bundle.activeSubmissions).toHaveLength(2);
      expect(bundle.activeSubmissions[0].fileManifest).toHaveLength(1);
      expect(bundle.activeSubmissions[1].fileManifest).toHaveLength(1);
    });

    it('handles submissions with no manuscriptVersionId (skips batch)', async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        return mockDb;
      });

      mockDb.where.mockImplementation(() => {
        if (selectCallCount === 1) {
          return [
            {
              id: validUuid,
              title: 'Draft No Version',
              coverLetter: null,
              content: 'Text',
              status: 'DRAFT',
              formData: null,
              submittedAt: null,
              organizationId: validUuid2,
              manuscriptVersionId: null,
              submissionPeriodId: null,
            },
          ];
        }
        if (selectCallCount === 2) {
          // Orgs lookup
          return [{ id: validUuid2, name: 'Test Mag' }];
        }
        if (selectCallCount === 3) {
          // History
          return [];
        }
        return [];
      });

      const bundle = await migrationBundleService.assembleBundleForUser(
        testEnv,
        {
          userId: validUuid,
          userEmail: 'user@test.com',
          userDid: 'did:web:local.example.com:users:user',
          destinationDomain: 'remote.example.com',
          destinationUserDid: null,
          migrationId: validUuid2,
        },
      );

      // 3 select calls: submissions + orgs + history (no periods, no genre, no files/versions)
      expect(selectCallCount).toBe(3);
      expect(bundle.activeSubmissions).toHaveLength(1);
      expect(bundle.activeSubmissions[0].fileManifest).toEqual([]);
      expect(bundle.activeSubmissions[0].contentFingerprint).toBeNull();
    });

    it('populates genre from manuscripts via version join', async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        return mockDb;
      });

      const mvId = '00000000-0000-4000-a000-000000000010';

      mockDb.where.mockImplementation(() => {
        if (selectCallCount === 1) {
          return [
            {
              id: validUuid,
              title: 'Poetry Sub',
              coverLetter: null,
              content: null,
              status: 'REJECTED',
              formData: null,
              submittedAt: new Date('2025-01-01'),
              organizationId: validUuid2,
              manuscriptVersionId: mvId,
              submissionPeriodId: null,
            },
          ];
        }
        if (selectCallCount === 2) {
          return [{ id: validUuid2, name: 'Test Mag' }];
        }
        // 3: genre JOIN
        if (selectCallCount === 3) {
          return [
            {
              versionId: mvId,
              genre: { primary: 'poetry', sub: 'lyric', hybrid: [] },
            },
          ];
        }
        // 4: history
        if (selectCallCount === 4) return [];
        return [];
      });

      const bundle = await migrationBundleService.assembleBundleForUser(
        testEnv,
        {
          userId: validUuid,
          userEmail: 'user@test.com',
          userDid: 'did:web:local.example.com:users:user',
          destinationDomain: 'remote.example.com',
          destinationUserDid: null,
          migrationId: validUuid2,
        },
      );

      expect(bundle.submissionHistory[0].genre).toEqual({
        primary: 'poetry',
        sub: 'lyric',
        hybrid: [],
      });
    });

    it('populates periodName from submission_periods', async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        return mockDb;
      });

      const periodId = '00000000-0000-4000-a000-000000000030';

      mockDb.where.mockImplementation(() => {
        if (selectCallCount === 1) {
          return [
            {
              id: validUuid,
              title: 'Period Sub',
              coverLetter: null,
              content: null,
              status: 'ACCEPTED',
              formData: null,
              submittedAt: new Date('2025-01-01'),
              organizationId: validUuid2,
              manuscriptVersionId: null,
              submissionPeriodId: periodId,
            },
          ];
        }
        if (selectCallCount === 2) {
          return [{ id: validUuid2, name: 'Test Mag' }];
        }
        // 3: periods
        if (selectCallCount === 3) {
          return [{ id: periodId, name: 'Spring 2025' }];
        }
        // 4: history
        if (selectCallCount === 4) return [];
        return [];
      });

      const bundle = await migrationBundleService.assembleBundleForUser(
        testEnv,
        {
          userId: validUuid,
          userEmail: 'user@test.com',
          userDid: 'did:web:local.example.com:users:user',
          destinationDomain: 'remote.example.com',
          destinationUserDid: null,
          migrationId: validUuid2,
        },
      );

      expect(bundle.submissionHistory[0].periodName).toBe('Spring 2025');
    });

    it('derives decidedAt from submission_history terminal transition', async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        return mockDb;
      });

      mockDb.where.mockImplementation(() => {
        if (selectCallCount === 1) {
          return [
            {
              id: validUuid,
              title: 'Decided Sub',
              coverLetter: null,
              content: null,
              status: 'REJECTED',
              formData: null,
              submittedAt: new Date('2025-01-01'),
              organizationId: validUuid2,
              manuscriptVersionId: null,
              submissionPeriodId: null,
            },
          ];
        }
        if (selectCallCount === 2) {
          return [{ id: validUuid2, name: 'Test Mag' }];
        }
        // 3: history
        if (selectCallCount === 3) {
          return [
            {
              submissionId: validUuid,
              fromStatus: null,
              toStatus: 'SUBMITTED',
              changedAt: new Date('2025-01-01T10:00:00Z'),
              comment: null,
            },
            {
              submissionId: validUuid,
              fromStatus: 'SUBMITTED',
              toStatus: 'UNDER_REVIEW',
              changedAt: new Date('2025-01-15T10:00:00Z'),
              comment: null,
            },
            {
              submissionId: validUuid,
              fromStatus: 'UNDER_REVIEW',
              toStatus: 'REJECTED',
              changedAt: new Date('2025-02-01T10:00:00Z'),
              comment: 'Not a fit',
            },
          ];
        }
        return [];
      });

      const bundle = await migrationBundleService.assembleBundleForUser(
        testEnv,
        {
          userId: validUuid,
          userEmail: 'user@test.com',
          userDid: 'did:web:local.example.com:users:user',
          destinationDomain: 'remote.example.com',
          destinationUserDid: null,
          migrationId: validUuid2,
        },
      );

      expect(bundle.submissionHistory[0].decidedAt).toBe(
        '2025-02-01T10:00:00.000Z',
      );
      expect(bundle.submissionHistory[0].statusHistory).toHaveLength(3);
      expect(bundle.submissionHistory[0].statusHistory[2]).toEqual({
        from: 'in_review',
        to: 'rejected',
        changedAt: '2025-02-01T10:00:00.000Z',
        comment: 'Not a fit',
      });
    });

    it('uses last terminal transition for decidedAt (not first)', async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        return mockDb;
      });

      mockDb.where.mockImplementation(() => {
        if (selectCallCount === 1) {
          return [
            {
              id: validUuid,
              title: 'Re-decided Sub',
              coverLetter: null,
              content: null,
              status: 'WITHDRAWN',
              formData: null,
              submittedAt: new Date('2025-01-01'),
              organizationId: validUuid2,
              manuscriptVersionId: null,
              submissionPeriodId: null,
            },
          ];
        }
        if (selectCallCount === 2) {
          return [{ id: validUuid2, name: 'Test Mag' }];
        }
        // 3: history — multiple terminal transitions
        if (selectCallCount === 3) {
          return [
            {
              submissionId: validUuid,
              fromStatus: null,
              toStatus: 'SUBMITTED',
              changedAt: new Date('2025-01-01T10:00:00Z'),
              comment: null,
            },
            {
              submissionId: validUuid,
              fromStatus: 'SUBMITTED',
              toStatus: 'REJECTED',
              changedAt: new Date('2025-02-01T10:00:00Z'),
              comment: 'Not a fit',
            },
            {
              submissionId: validUuid,
              fromStatus: 'REJECTED',
              toStatus: 'WITHDRAWN',
              changedAt: new Date('2025-03-01T10:00:00Z'),
              comment: 'Withdrawing',
            },
          ];
        }
        return [];
      });

      const bundle = await migrationBundleService.assembleBundleForUser(
        testEnv,
        {
          userId: validUuid,
          userEmail: 'user@test.com',
          userDid: 'did:web:local.example.com:users:user',
          destinationDomain: 'remote.example.com',
          destinationUserDid: null,
          migrationId: validUuid2,
        },
      );

      // Should use the LAST terminal transition (WITHDRAWN), not the first (REJECTED)
      expect(bundle.submissionHistory[0].decidedAt).toBe(
        '2025-03-01T10:00:00.000Z',
      );
    });

    it('falls back to null for malformed genre JSONB', async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        return mockDb;
      });

      const mvId = '00000000-0000-4000-a000-000000000010';

      mockDb.where.mockImplementation(() => {
        if (selectCallCount === 1) {
          return [
            {
              id: validUuid,
              title: 'Bad Genre Sub',
              coverLetter: null,
              content: null,
              status: 'REJECTED',
              formData: null,
              submittedAt: new Date('2025-01-01'),
              organizationId: validUuid2,
              manuscriptVersionId: mvId,
              submissionPeriodId: null,
            },
          ];
        }
        if (selectCallCount === 2) {
          return [{ id: validUuid2, name: 'Test Mag' }];
        }
        // 3: genre JOIN — malformed JSONB (missing required fields)
        if (selectCallCount === 3) {
          return [
            {
              versionId: mvId,
              genre: { invalid: 'data' },
            },
          ];
        }
        // 4: history
        if (selectCallCount === 4) return [];
        return [];
      });

      const bundle = await migrationBundleService.assembleBundleForUser(
        testEnv,
        {
          userId: validUuid,
          userEmail: 'user@test.com',
          userDid: 'did:web:local.example.com:users:user',
          destinationDomain: 'remote.example.com',
          destinationUserDid: null,
          migrationId: validUuid2,
        },
      );

      // Malformed genre should fall back to null, not crash
      expect(bundle.submissionHistory[0].genre).toBeNull();
    });

    it('applies submission query limit', async () => {
      mockDb.where.mockReturnValue([]);

      await migrationBundleService.assembleBundleForUser(testEnv, {
        userId: validUuid,
        userEmail: 'user@test.com',
        userDid: 'did:web:local.example.com:users:user',
        destinationDomain: 'remote.example.com',
        destinationUserDid: null,
        migrationId: validUuid2,
      });

      // Submissions query chain calls .limit(10000)
      expect(mockDb.limit).toHaveBeenCalledWith(10_000);
    });

    it('maps Hopper status to CSR status in bundle', async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        return mockDb;
      });

      mockDb.where.mockImplementation(() => {
        if (selectCallCount === 1) {
          return [
            {
              id: validUuid,
              title: 'Rejected',
              coverLetter: null,
              content: null,
              status: 'REJECTED',
              formData: null,
              submittedAt: new Date('2025-01-01'),
              organizationId: validUuid2,
              manuscriptVersionId: null,
              submissionPeriodId: null,
            },
            {
              id: validUuid2,
              title: 'Active',
              coverLetter: null,
              content: 'Text',
              status: 'SUBMITTED',
              formData: null,
              submittedAt: new Date('2025-02-01'),
              organizationId: validUuid2,
              manuscriptVersionId: null,
              submissionPeriodId: null,
            },
          ];
        }
        if (selectCallCount === 2) {
          return [{ id: validUuid2, name: 'Test Mag' }];
        }
        // 3: history
        if (selectCallCount === 3) return [];
        return [];
      });

      const bundle = await migrationBundleService.assembleBundleForUser(
        testEnv,
        {
          userId: validUuid,
          userEmail: 'user@test.com',
          userDid: 'did:web:local.example.com:users:user',
          destinationDomain: 'remote.example.com',
          destinationUserDid: null,
          migrationId: validUuid2,
        },
      );

      expect(bundle.submissionHistory[0].status).toBe('rejected');
      expect(bundle.activeSubmissions[0].status).toBe('sent');
    });
  });

  describe('signBundleToken', () => {
    it('creates valid JWT with correct claims', async () => {
      const result = await migrationBundleService.signBundleToken(testEnv, {
        migrationId: validUuid,
        userId: validUuid2,
        fileIds: ['file-1', 'file-2'],
        destinationDomain: 'remote.example.com',
      });

      expect(result.token).toBe('mock.bundle.jwt');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
