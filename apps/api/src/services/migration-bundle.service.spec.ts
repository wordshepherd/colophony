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
          // Orgs lookup
          return [{ id: validUuid2, name: 'Test Magazine' }];
        }
        // Files for active submission
        if (selectCallCount === 3) {
          return [
            {
              id: 'file-1',
              filename: 'story.docx',
              mimeType: 'application/docx',
              size: 12345,
            },
          ];
        }
        // Manuscript version fingerprint
        if (selectCallCount === 4) {
          mockDb.limit.mockResolvedValueOnce([
            { contentFingerprint: 'abc123' },
          ]);
          return mockDb;
        }
        return mockDb;
      });

      // For the limit() calls on specific queries
      mockDb.limit.mockResolvedValue([{ contentFingerprint: 'abc123' }]);

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
