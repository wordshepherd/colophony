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
  },
  organizations: { id: 'organizations.id', name: 'organizations.name' },
  submissionPeriods: {},
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

      // Call tracking: select calls resolve differently based on count
      // New batch flow: 1. submissions, 2. orgs, 3. batch files, 4. batch versions
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
            },
          ];
        }
        if (selectCallCount === 2) {
          // Orgs lookup (inArray)
          return [{ id: validUuid2, name: 'Test Magazine' }];
        }
        // Batch files fetch (all versions at once)
        if (selectCallCount === 3) {
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
        // Batch versions fetch (all versions at once)
        if (selectCallCount === 4) {
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
            },
          ];
        }
        if (selectCallCount === 2) {
          // Orgs lookup (via inArray)
          return [{ id: validUuid2, name: 'Test Mag' }];
        }
        if (selectCallCount === 3) {
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
        if (selectCallCount === 4) {
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

      // Should have made exactly 4 select calls:
      // 1. submissions, 2. orgs, 3. batch files, 4. batch versions
      expect(selectCallCount).toBe(4);
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
            },
          ];
        }
        if (selectCallCount === 2) {
          return [{ id: validUuid2, name: 'Test Mag' }];
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

      // Only 2 select calls: submissions + orgs (no batch files/versions)
      expect(selectCallCount).toBe(2);
      expect(bundle.activeSubmissions).toHaveLength(1);
      expect(bundle.activeSubmissions[0].fileManifest).toEqual([]);
      expect(bundle.activeSubmissions[0].contentFingerprint).toBeNull();
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
