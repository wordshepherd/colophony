import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

// Mock file service
vi.mock('../../services/file.service.js', () => ({
  fileService: {
    listByManuscriptVersion: vi.fn(),
    getById: vi.fn(),
    getByStorageKey: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    countByManuscriptVersion: vi.fn(),
    totalSizeByManuscriptVersion: vi.fn(),
    validateMimeType: vi.fn(),
    validateFileSize: vi.fn(),
    validateLimits: vi.fn(),
    getDownloadUrl: vi.fn(),
    deleteWithS3: vi.fn(),
    // Access-aware methods (PR 2)
    listByManuscriptVersionWithAccess: vi.fn(),
    getDownloadUrlWithAccess: vi.fn(),
    deleteAsOwner: vi.fn(),
  },
  FileNotFoundError: class FileNotFoundError extends Error {
    name = 'FileNotFoundError';
    constructor(id = 'unknown') {
      super(`File "${id}" not found`);
    }
  },
  FileNotCleanError: class FileNotCleanError extends Error {
    name = 'FileNotCleanError';
    constructor(fileId = 'unknown', scanStatus = 'PENDING') {
      super(
        `File "${fileId}" has scan status "${scanStatus}" — download blocked`,
      );
    }
  },
}));

// Mock submission service
vi.mock('../../services/submission.service.js', () => ({
  submissionService: {
    listBySubmitter: vi.fn(),
    listAll: vi.fn(),
    create: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    delete: vi.fn(),
    getHistory: vi.fn(),
    getByIdWithAccess: vi.fn(),
    createWithAudit: vi.fn(),
    updateAsOwner: vi.fn(),
    submitAsOwner: vi.fn(),
    deleteAsOwner: vi.fn(),
    withdrawAsOwner: vi.fn(),
    updateStatusAsEditor: vi.fn(),
    getHistoryWithAccess: vi.fn(),
  },
  SubmissionNotFoundError: class SubmissionNotFoundError extends Error {
    name = 'SubmissionNotFoundError';
    constructor(id = 'unknown') {
      super(`Submission "${id}" not found`);
    }
  },
  InvalidStatusTransitionError: class extends Error {
    name = 'InvalidStatusTransitionError';
  },
  NotDraftError: class extends Error {
    name = 'NotDraftError';
    constructor() {
      super('Submission must be in DRAFT status for this operation');
    }
  },
  UnscannedFilesError: class extends Error {
    name = 'UnscannedFilesError';
  },
  InfectedFilesError: class extends Error {
    name = 'InfectedFilesError';
  },
  FormDefinitionMismatchError: class extends Error {
    name = 'FormDefinitionMismatchError';
  },
}));

// Mock adapter registry (replaces old S3 + env mocks)
vi.mock('../../adapters/registry-accessor.js', () => ({
  getGlobalRegistry: vi.fn(() => ({
    resolve: vi.fn(() => ({
      defaultBucket: 'test-bucket',
      quarantineBucket: 'test-quarantine',
      getSignedUrlFromBucket: vi.fn(),
      deleteFromBucket: vi.fn(),
    })),
    tryResolve: vi.fn(() => null),
  })),
}));

// Mock @colophony/db
vi.mock('@colophony/db', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  db: { query: {} },
  organizations: {},
  organizationMembers: {},
  users: {},
  submissions: {},
  files: {},
  submissionHistory: {},
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

import { fileService } from '../../services/file.service.js';
import { ForbiddenError } from '../../services/errors.js';
import { appRouter } from '../router.js';
import type { TRPCContext } from '../context.js';

const mockFileService = vi.mocked(fileService);

function makeContext(overrides: Partial<TRPCContext> = {}): TRPCContext {
  return {
    authContext: null,
    dbTx: null,
    audit: vi.fn(),
    ...overrides,
  };
}

function orgContext(
  role: 'ADMIN' | 'EDITOR' | 'READER' = 'READER',
  overrides: Partial<TRPCContext> = {},
): TRPCContext {
  const mockTx = {} as never;
  return makeContext({
    authContext: {
      userId: 'user-1',
      zitadelUserId: 'zid-1',
      email: 'test@example.com',
      emailVerified: true,
      authMethod: 'test',
      orgId: 'org-1',
      role,
    },
    dbTx: mockTx,
    audit: vi.fn(),
    ...overrides,
  });
}

const createCaller = (appRouter as any).createCaller as (
  ctx: TRPCContext,
) => any;

const SUBMISSION_ID = 'a1111111-1111-1111-a111-111111111111';
const MANUSCRIPT_VERSION_ID = 'b1111111-1111-1111-a111-111111111111';
const FILE_ID = 'f1111111-1111-1111-a111-111111111111';

describe('files tRPC router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Auth / access control
  // -------------------------------------------------------------------------

  describe('auth and access', () => {
    it('listByManuscriptVersion requires authentication', async () => {
      const caller = createCaller(makeContext());
      await expect(
        caller.files.listByManuscriptVersion({
          manuscriptVersionId: MANUSCRIPT_VERSION_ID,
        }),
      ).rejects.toThrow(TRPCError);
    });

    it('listByManuscriptVersion requires user context (auth + dbTx)', async () => {
      const caller = createCaller(
        makeContext({
          authContext: {
            userId: 'user-1',
            zitadelUserId: 'zid-1',
            email: 'test@example.com',
            emailVerified: true,
            authMethod: 'test',
          },
        }),
      );
      await expect(
        caller.files.listByManuscriptVersion({
          manuscriptVersionId: MANUSCRIPT_VERSION_ID,
        }),
      ).rejects.toThrow(TRPCError);
    });

    it('listByManuscriptVersion maps ForbiddenError from service', async () => {
      mockFileService.listByManuscriptVersionWithAccess.mockRejectedValueOnce(
        new ForbiddenError('You do not have access to this submission'),
      );
      const caller = createCaller(orgContext('READER'));
      await expect(
        caller.files.listByManuscriptVersion({
          manuscriptVersionId: MANUSCRIPT_VERSION_ID,
        }),
      ).rejects.toThrow('do not have access');
    });

    it('listByManuscriptVersion succeeds for EDITOR', async () => {
      mockFileService.listByManuscriptVersionWithAccess.mockResolvedValueOnce(
        [] as never,
      );
      const caller = createCaller(orgContext('EDITOR'));
      const result = await caller.files.listByManuscriptVersion({
        manuscriptVersionId: MANUSCRIPT_VERSION_ID,
      });
      expect(result).toEqual([]);
    });

    it('delete maps ForbiddenError from service', async () => {
      mockFileService.deleteAsOwner.mockRejectedValueOnce(
        new ForbiddenError('Only the submitter can delete files'),
      );
      const caller = createCaller(orgContext('READER'));
      await expect(caller.files.delete({ fileId: FILE_ID })).rejects.toThrow(
        'Only the submitter',
      );
    });
  });

  // -------------------------------------------------------------------------
  // listByManuscriptVersion
  // -------------------------------------------------------------------------

  describe('listByManuscriptVersion', () => {
    it('returns files for the manuscript version', async () => {
      const files = [
        {
          id: FILE_ID,
          manuscriptVersionId: MANUSCRIPT_VERSION_ID,
          filename: 'poem.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          storageKey: 'quarantine/abc123',
          scanStatus: 'CLEAN',
          scannedAt: new Date(),
          uploadedAt: new Date(),
        },
      ];
      mockFileService.listByManuscriptVersionWithAccess.mockResolvedValueOnce(
        files as never,
      );

      const caller = createCaller(orgContext());
      const result = await caller.files.listByManuscriptVersion({
        manuscriptVersionId: MANUSCRIPT_VERSION_ID,
      });
      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('poem.pdf');
    });

    it('maps SubmissionNotFoundError to NOT_FOUND', async () => {
      const { SubmissionNotFoundError } =
        await import('../../services/submission.service.js');
      mockFileService.listByManuscriptVersionWithAccess.mockRejectedValueOnce(
        new SubmissionNotFoundError(SUBMISSION_ID),
      );
      const caller = createCaller(orgContext());
      await expect(
        caller.files.listByManuscriptVersion({
          manuscriptVersionId: MANUSCRIPT_VERSION_ID,
        }),
      ).rejects.toThrow('not found');
    });
  });

  // -------------------------------------------------------------------------
  // getDownloadUrl
  // -------------------------------------------------------------------------

  describe('getDownloadUrl', () => {
    it('returns presigned URL for CLEAN file', async () => {
      mockFileService.getDownloadUrlWithAccess.mockResolvedValueOnce({
        url: 'https://s3.example.com/signed-url',
        filename: 'poem.pdf',
        mimeType: 'application/pdf',
      } as never);

      const caller = createCaller(orgContext());
      const result = await caller.files.getDownloadUrl({ fileId: FILE_ID });
      expect(result.url).toBe('https://s3.example.com/signed-url');
      expect(result.filename).toBe('poem.pdf');
    });

    it('maps FileNotCleanError to PRECONDITION_FAILED', async () => {
      const { FileNotCleanError } =
        await import('../../services/file.service.js');
      mockFileService.getDownloadUrlWithAccess.mockRejectedValueOnce(
        new FileNotCleanError(FILE_ID, 'PENDING'),
      );

      const caller = createCaller(orgContext());
      await expect(
        caller.files.getDownloadUrl({ fileId: FILE_ID }),
      ).rejects.toThrow('download blocked');
    });

    it('maps FileNotFoundError to NOT_FOUND', async () => {
      const { FileNotFoundError } =
        await import('../../services/file.service.js');
      mockFileService.getDownloadUrlWithAccess.mockRejectedValueOnce(
        new FileNotFoundError(FILE_ID),
      );
      const caller = createCaller(orgContext());
      await expect(
        caller.files.getDownloadUrl({ fileId: FILE_ID }),
      ).rejects.toThrow('not found');
    });
  });

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------

  describe('delete', () => {
    it('succeeds and returns success', async () => {
      mockFileService.deleteAsOwner.mockResolvedValueOnce({
        success: true,
      } as never);

      const ctx = orgContext();
      const caller = createCaller(ctx);
      const result = await caller.files.delete({ fileId: FILE_ID });

      expect(result).toEqual({ success: true });
    });

    it('maps NotDraftError to BAD_REQUEST', async () => {
      const { NotDraftError } =
        await import('../../services/submission.service.js');
      mockFileService.deleteAsOwner.mockRejectedValueOnce(new NotDraftError());

      const caller = createCaller(orgContext());
      await expect(caller.files.delete({ fileId: FILE_ID })).rejects.toThrow(
        'DRAFT',
      );
    });

    it('maps FileNotFoundError to NOT_FOUND', async () => {
      const { FileNotFoundError } =
        await import('../../services/file.service.js');
      mockFileService.deleteAsOwner.mockRejectedValueOnce(
        new FileNotFoundError(FILE_ID),
      );
      const caller = createCaller(orgContext());
      await expect(caller.files.delete({ fileId: FILE_ID })).rejects.toThrow(
        'not found',
      );
    });
  });
});
