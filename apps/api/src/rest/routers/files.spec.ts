import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ORPCError } from '@orpc/server';

// Mock file service
vi.mock('../../services/file.service.js', () => ({
  fileService: {
    listByManuscriptVersion: vi.fn(),
    listByManuscriptVersionWithAccess: vi.fn(),
    getById: vi.fn(),
    getDownloadUrl: vi.fn(),
    getDownloadUrlWithAccess: vi.fn(),
    delete: vi.fn(),
    deleteWithS3: vi.fn(),
    deleteAsOwner: vi.fn(),
  },
  FileNotFoundError: class FileNotFoundError extends Error {
    name = 'FileNotFoundError';
  },
  FileNotCleanError: class FileNotCleanError extends Error {
    name = 'FileNotCleanError';
    constructor(fileId: string, scanStatus: string) {
      super(
        `File "${fileId}" has scan status "${scanStatus}" — download blocked`,
      );
    }
  },
}));

// Mock submission service (needed by file service access methods)
vi.mock('../../services/submission.service.js', () => ({
  submissionService: {},
  SubmissionNotFoundError: class SubmissionNotFoundError extends Error {
    name = 'SubmissionNotFoundError';
  },
  NotDraftError: class NotDraftError extends Error {
    name = 'NotDraftError';
    constructor() {
      super('Submission must be in DRAFT status for this operation');
    }
  },
  InvalidStatusTransitionError: class InvalidStatusTransitionError extends Error {
    name = 'InvalidStatusTransitionError';
  },
  UnscannedFilesError: class UnscannedFilesError extends Error {
    name = 'UnscannedFilesError';
  },
  InfectedFilesError: class InfectedFilesError extends Error {
    name = 'InfectedFilesError';
  },
  FormDefinitionMismatchError: class FormDefinitionMismatchError extends Error {
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

vi.mock('@colophony/db', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  db: { query: {} },
  files: {},
  eq: vi.fn(),
  sql: vi.fn(),
}));

import { fileService } from '../../services/file.service.js';
import { ForbiddenError } from '../../services/errors.js';
import { filesRouter } from './files.js';
import type { RestContext } from '../context.js';
import { createProcedureClient } from '@orpc/server';

const mockFileService = vi.mocked(fileService);

const USER_ID = 'a0000000-0000-4000-a000-000000000001';
const ORG_ID = 'b0000000-0000-4000-a000-000000000001';
const MANUSCRIPT_VERSION_ID = 'c0000000-0000-4000-a000-000000000001';
const FILE_ID = 'e0000000-0000-4000-a000-000000000001';

function baseContext(): RestContext {
  return { authContext: null, dbTx: null, audit: vi.fn() };
}

function orgContext(
  role: 'ADMIN' | 'EDITOR' | 'READER' = 'ADMIN',
): RestContext {
  return {
    authContext: {
      userId: USER_ID,
      zitadelUserId: 'zid-1',
      email: 'test@example.com',
      emailVerified: true,
      authMethod: 'test',
      orgId: ORG_ID,
      role,
    },
    dbTx: {} as never,
    audit: vi.fn(),
  };
}

function apiKeyContext(
  scopes: string[],
  role: 'ADMIN' | 'EDITOR' | 'READER' = 'ADMIN',
): RestContext {
  return {
    authContext: {
      userId: USER_ID,
      email: 'test@example.com',
      emailVerified: true,
      authMethod: 'apikey',
      apiKeyId: 'k0000000-0000-4000-a000-000000000001',
      apiKeyScopes: scopes as any,
      orgId: ORG_ID,
      role,
    },
    dbTx: {} as never,
    audit: vi.fn(),
  };
}

function client<T>(procedure: T, context: RestContext) {
  return createProcedureClient(procedure as any, { context }) as any;
}

describe('files REST router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // GET /manuscript-versions/{manuscriptVersionId}/files
  // -------------------------------------------------------------------------

  describe('GET /manuscript-versions/{manuscriptVersionId}/files (list)', () => {
    it('requires auth', async () => {
      const call = client(filesRouter.list, baseContext());
      await expect(
        call({ manuscriptVersionId: MANUSCRIPT_VERSION_ID }),
      ).rejects.toThrow(ORPCError);
    });

    it('returns files for a manuscript version', async () => {
      const files = [
        {
          id: FILE_ID,
          filename: 'test.pdf',
          manuscriptVersionId: MANUSCRIPT_VERSION_ID,
        },
      ];
      mockFileService.listByManuscriptVersionWithAccess.mockResolvedValueOnce(
        files as never,
      );

      const call = client(filesRouter.list, orgContext('READER'));
      const result = await call({ manuscriptVersionId: MANUSCRIPT_VERSION_ID });
      expect(result).toHaveLength(1);
    });

    it('maps ForbiddenError', async () => {
      mockFileService.listByManuscriptVersionWithAccess.mockRejectedValueOnce(
        new ForbiddenError('No access'),
      );

      const call = client(filesRouter.list, orgContext('READER'));
      await expect(
        call({ manuscriptVersionId: MANUSCRIPT_VERSION_ID }),
      ).rejects.toThrow('No access');
    });
  });

  // -------------------------------------------------------------------------
  // GET /files/{fileId}/download
  // -------------------------------------------------------------------------

  describe('GET /files/{fileId}/download', () => {
    it('requires auth', async () => {
      const call = client(filesRouter.download, baseContext());
      await expect(call({ fileId: FILE_ID })).rejects.toThrow(ORPCError);
    });

    it('returns presigned download URL', async () => {
      const downloadInfo = {
        url: 'https://s3.example.com/file',
        filename: 'test.pdf',
        mimeType: 'application/pdf',
      };
      mockFileService.getDownloadUrlWithAccess.mockResolvedValueOnce(
        downloadInfo as never,
      );

      const call = client(filesRouter.download, orgContext('READER'));
      const result = await call({ fileId: FILE_ID });
      expect(result.url).toBe('https://s3.example.com/file');
      expect(result.filename).toBe('test.pdf');
    });

    it('maps FileNotFoundError to NOT_FOUND', async () => {
      const { FileNotFoundError } =
        await import('../../services/file.service.js');
      mockFileService.getDownloadUrlWithAccess.mockRejectedValueOnce(
        new FileNotFoundError(FILE_ID),
      );

      const call = client(filesRouter.download, orgContext('READER'));
      await expect(call({ fileId: FILE_ID })).rejects.toThrow(ORPCError);
    });

    it('maps FileNotCleanError to BAD_REQUEST', async () => {
      const { FileNotCleanError } =
        await import('../../services/file.service.js');
      mockFileService.getDownloadUrlWithAccess.mockRejectedValueOnce(
        new FileNotCleanError(FILE_ID, 'INFECTED'),
      );

      const call = client(filesRouter.download, orgContext('READER'));
      await expect(call({ fileId: FILE_ID })).rejects.toThrow('INFECTED');
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /files/{fileId}
  // -------------------------------------------------------------------------

  describe('DELETE /files/{fileId}', () => {
    it('requires auth', async () => {
      const call = client(filesRouter.delete, baseContext());
      await expect(call({ fileId: FILE_ID })).rejects.toThrow(ORPCError);
    });

    it('deletes a file', async () => {
      mockFileService.deleteAsOwner.mockResolvedValueOnce({
        success: true,
      } as never);

      const call = client(filesRouter.delete, orgContext('READER'));
      const result = await call({ fileId: FILE_ID });
      expect(result).toEqual({ success: true });
    });

    it('maps NotDraftError to BAD_REQUEST', async () => {
      const { NotDraftError } =
        await import('../../services/submission.service.js');
      mockFileService.deleteAsOwner.mockRejectedValueOnce(new NotDraftError());

      const call = client(filesRouter.delete, orgContext('READER'));
      await expect(call({ fileId: FILE_ID })).rejects.toThrow('DRAFT');
    });

    it('maps FileNotFoundError to NOT_FOUND', async () => {
      const { FileNotFoundError } =
        await import('../../services/file.service.js');
      mockFileService.deleteAsOwner.mockRejectedValueOnce(
        new FileNotFoundError(FILE_ID),
      );

      const call = client(filesRouter.delete, orgContext('READER'));
      await expect(call({ fileId: FILE_ID })).rejects.toThrow(ORPCError);
    });
  });

  // -------------------------------------------------------------------------
  // API key scope enforcement
  // -------------------------------------------------------------------------

  describe('API key scope enforcement', () => {
    it('denies files:read route with wrong scope', async () => {
      const ctx = apiKeyContext(['submissions:read']);
      const call = client(filesRouter.list, ctx);
      await expect(
        call({ manuscriptVersionId: MANUSCRIPT_VERSION_ID }),
      ).rejects.toThrow('Insufficient API key scope');
    });

    it('denies files:write route with only read scope', async () => {
      const ctx = apiKeyContext(['files:read']);
      const call = client(filesRouter.delete, ctx);
      await expect(call({ fileId: FILE_ID })).rejects.toThrow(
        'Insufficient API key scope',
      );
    });

    it('allows API key with correct read scope', async () => {
      const files = [{ id: FILE_ID, filename: 'test.pdf' }];
      mockFileService.listByManuscriptVersionWithAccess.mockResolvedValueOnce(
        files as never,
      );

      const ctx = apiKeyContext(['files:read']);
      const call = client(filesRouter.list, ctx);
      const result = await call({ manuscriptVersionId: MANUSCRIPT_VERSION_ID });
      expect(result).toHaveLength(1);
    });
  });
});
