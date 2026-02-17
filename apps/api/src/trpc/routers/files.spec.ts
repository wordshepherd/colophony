import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

// Mock file service
vi.mock('../../services/file.service.js', () => ({
  fileService: {
    listBySubmission: vi.fn(),
    getById: vi.fn(),
    getByStorageKey: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    countBySubmission: vi.fn(),
    totalSizeBySubmission: vi.fn(),
    validateMimeType: vi.fn(),
    validateFileSize: vi.fn(),
    validateLimits: vi.fn(),
  },
  FileNotFoundError: class FileNotFoundError extends Error {
    name = 'FileNotFoundError';
    constructor(id = 'unknown') {
      super(`File "${id}" not found`);
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
  },
  SubmissionNotFoundError: class SubmissionNotFoundError extends Error {
    name = 'SubmissionNotFoundError';
  },
  InvalidStatusTransitionError: class extends Error {
    name = 'InvalidStatusTransitionError';
  },
  NotDraftError: class extends Error {
    name = 'NotDraftError';
  },
  UnscannedFilesError: class extends Error {
    name = 'UnscannedFilesError';
  },
  InfectedFilesError: class extends Error {
    name = 'InfectedFilesError';
  },
}));

// Mock S3
vi.mock('../../services/s3.js', () => ({
  createS3Client: vi.fn(() => ({})),
  getPresignedDownloadUrl: vi.fn(
    async () => 'https://s3.example.com/signed-url',
  ),
  deleteS3Object: vi.fn(async () => undefined),
}));

// Mock env
vi.mock('../../config/env.js', () => ({
  validateEnv: vi.fn(() => ({
    S3_ENDPOINT: 'http://localhost:9000',
    S3_BUCKET: 'submissions',
    S3_QUARANTINE_BUCKET: 'quarantine',
    S3_ACCESS_KEY: 'minioadmin',
    S3_SECRET_KEY: 'minioadmin',
    S3_REGION: 'us-east-1',
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
  submissionFiles: {},
  submissionHistory: {},
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

import { fileService } from '../../services/file.service.js';
import { submissionService } from '../../services/submission.service.js';
import { deleteS3Object } from '../../services/s3.js';
import { appRouter } from '../router.js';
import type { TRPCContext } from '../context.js';

const mockFileService = vi.mocked(fileService);
const mockSubmissionService = vi.mocked(submissionService);
const mockDeleteS3 = vi.mocked(deleteS3Object);

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createCaller = (appRouter as any).createCaller as (
  ctx: TRPCContext,
) => any;

const SUBMISSION_ID = 'a1111111-1111-1111-a111-111111111111';
const FILE_ID = 'f1111111-1111-1111-a111-111111111111';

function makeDraftSubmission(submitterId = 'user-1') {
  return {
    id: SUBMISSION_ID,
    organizationId: 'org-1',
    submitterId,
    submissionPeriodId: null,
    title: 'Test Poem',
    content: 'Roses are red...',
    coverLetter: null,
    status: 'DRAFT' as const,
    submittedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    files: [],
    submitterEmail: 'test@example.com',
  };
}

function makeFile(overrides = {}) {
  return {
    id: FILE_ID,
    submissionId: SUBMISSION_ID,
    filename: 'poem.pdf',
    mimeType: 'application/pdf',
    size: 1024,
    storageKey: 'quarantine/abc123',
    scanStatus: 'CLEAN' as const,
    scannedAt: new Date(),
    uploadedAt: new Date(),
    ...overrides,
  };
}

describe('files tRPC router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Auth / access control
  // -------------------------------------------------------------------------

  describe('auth and access', () => {
    it('listBySubmission requires authentication', async () => {
      const caller = createCaller(makeContext());
      await expect(
        caller.files.listBySubmission({ submissionId: SUBMISSION_ID }),
      ).rejects.toThrow(TRPCError);
    });

    it('listBySubmission requires org context', async () => {
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
        caller.files.listBySubmission({ submissionId: SUBMISSION_ID }),
      ).rejects.toThrow(TRPCError);
    });

    it('listBySubmission denies READER from viewing others files', async () => {
      const sub = makeDraftSubmission('other-user');
      mockSubmissionService.getById.mockResolvedValueOnce(sub as never);
      const caller = createCaller(orgContext('READER'));
      await expect(
        caller.files.listBySubmission({ submissionId: SUBMISSION_ID }),
      ).rejects.toThrow('do not have access');
    });

    it('listBySubmission allows EDITOR to view others files', async () => {
      const sub = makeDraftSubmission('other-user');
      mockSubmissionService.getById.mockResolvedValueOnce(sub as never);
      mockFileService.listBySubmission.mockResolvedValueOnce([] as never);
      const caller = createCaller(orgContext('EDITOR'));
      const result = await caller.files.listBySubmission({
        submissionId: SUBMISSION_ID,
      });
      expect(result).toEqual([]);
    });

    it('delete requires ownership', async () => {
      const file = makeFile();
      const sub = makeDraftSubmission('other-user');
      mockFileService.getById.mockResolvedValueOnce(file as never);
      mockSubmissionService.getById.mockResolvedValueOnce(sub as never);
      const caller = createCaller(orgContext('READER'));
      await expect(caller.files.delete({ fileId: FILE_ID })).rejects.toThrow(
        'Only the submitter',
      );
    });
  });

  // -------------------------------------------------------------------------
  // listBySubmission
  // -------------------------------------------------------------------------

  describe('listBySubmission', () => {
    it('returns files for the submission', async () => {
      const sub = makeDraftSubmission();
      const files = [makeFile()];
      mockSubmissionService.getById.mockResolvedValueOnce(sub as never);
      mockFileService.listBySubmission.mockResolvedValueOnce(files as never);

      const caller = createCaller(orgContext());
      const result = await caller.files.listBySubmission({
        submissionId: SUBMISSION_ID,
      });
      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('poem.pdf');
    });

    it('throws NOT_FOUND when submission missing', async () => {
      mockSubmissionService.getById.mockResolvedValueOnce(null as never);
      const caller = createCaller(orgContext());
      await expect(
        caller.files.listBySubmission({ submissionId: SUBMISSION_ID }),
      ).rejects.toThrow('not found');
    });
  });

  // -------------------------------------------------------------------------
  // getDownloadUrl
  // -------------------------------------------------------------------------

  describe('getDownloadUrl', () => {
    it('returns presigned URL for CLEAN file', async () => {
      const file = makeFile();
      const sub = makeDraftSubmission();
      mockFileService.getById.mockResolvedValueOnce(file as never);
      mockSubmissionService.getById.mockResolvedValueOnce(sub as never);

      const caller = createCaller(orgContext());
      const result = await caller.files.getDownloadUrl({ fileId: FILE_ID });
      expect(result.url).toBe('https://s3.example.com/signed-url');
      expect(result.filename).toBe('poem.pdf');
    });

    it('rejects file not yet scanned', async () => {
      const file = makeFile({ scanStatus: 'PENDING' });
      const sub = makeDraftSubmission();
      mockFileService.getById.mockResolvedValueOnce(file as never);
      mockSubmissionService.getById.mockResolvedValueOnce(sub as never);

      const caller = createCaller(orgContext());
      await expect(
        caller.files.getDownloadUrl({ fileId: FILE_ID }),
      ).rejects.toThrow('virus scan');
    });

    it('rejects infected file', async () => {
      const file = makeFile({ scanStatus: 'INFECTED' });
      const sub = makeDraftSubmission();
      mockFileService.getById.mockResolvedValueOnce(file as never);
      mockSubmissionService.getById.mockResolvedValueOnce(sub as never);

      const caller = createCaller(orgContext());
      await expect(
        caller.files.getDownloadUrl({ fileId: FILE_ID }),
      ).rejects.toThrow('virus scan');
    });

    it('throws NOT_FOUND for missing file', async () => {
      mockFileService.getById.mockResolvedValueOnce(null as never);
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
    it('succeeds on DRAFT and calls audit', async () => {
      const file = makeFile();
      const sub = makeDraftSubmission();
      mockFileService.getById.mockResolvedValueOnce(file as never);
      mockSubmissionService.getById.mockResolvedValueOnce(sub as never);
      mockFileService.delete.mockResolvedValueOnce(file as never);

      const ctx = orgContext();
      const caller = createCaller(ctx);
      const result = await caller.files.delete({ fileId: FILE_ID });

      expect(result).toEqual({ success: true });
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'FILE_DELETED' }),
      );
    });

    it('rejects deletion from non-DRAFT submission', async () => {
      const file = makeFile();
      const sub = { ...makeDraftSubmission(), status: 'SUBMITTED' as const };
      mockFileService.getById.mockResolvedValueOnce(file as never);
      mockSubmissionService.getById.mockResolvedValueOnce(sub as never);

      const caller = createCaller(orgContext());
      await expect(caller.files.delete({ fileId: FILE_ID })).rejects.toThrow(
        'DRAFT',
      );
    });

    it('attempts S3 deletion after DB delete', async () => {
      const file = makeFile();
      const sub = makeDraftSubmission();
      mockFileService.getById.mockResolvedValueOnce(file as never);
      mockSubmissionService.getById.mockResolvedValueOnce(sub as never);
      mockFileService.delete.mockResolvedValueOnce(file as never);

      const caller = createCaller(orgContext());
      await caller.files.delete({ fileId: FILE_ID });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockDeleteS3).toHaveBeenCalledWith(
        expect.anything(),
        'submissions', // CLEAN files live in submissions bucket after scan
        file.storageKey,
      );
    });

    it('throws NOT_FOUND for missing file', async () => {
      mockFileService.getById.mockResolvedValueOnce(null as never);
      const caller = createCaller(orgContext());
      await expect(caller.files.delete({ fileId: FILE_ID })).rejects.toThrow(
        'not found',
      );
    });
  });
});
