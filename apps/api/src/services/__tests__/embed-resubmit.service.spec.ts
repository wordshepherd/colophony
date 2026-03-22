import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
const mockGetResubmitContext = vi.fn();
const mockGenerateAndStore = vi.fn();
const mockVerifyToken = vi.fn();

vi.mock('../status-token.service.js', () => ({
  statusTokenService: {
    getResubmitContext: (...args: unknown[]) => mockGetResubmitContext(...args),
    generateAndStore: (...args: unknown[]) => mockGenerateAndStore(...args),
    verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
  },
}));

const mockSubmissionCreate = vi.fn();
const mockSubmissionUpdateStatus = vi.fn();
const mockSubmissionGetById = vi.fn();

vi.mock('../submission.service.js', () => ({
  submissionService: {
    create: (...args: unknown[]) => mockSubmissionCreate(...args),
    updateStatus: (...args: unknown[]) => mockSubmissionUpdateStatus(...args),
    getById: (...args: unknown[]) => mockSubmissionGetById(...args),
  },
  NotReviseAndResubmitError: class NotReviseAndResubmitError extends Error {
    constructor() {
      super('Submission must be in REVISE_AND_RESUBMIT status');
      this.name = 'NotReviseAndResubmitError';
    }
  },
  UnscannedFilesError: class UnscannedFilesError extends Error {
    constructor() {
      super('Files still pending scan');
      this.name = 'UnscannedFilesError';
    }
  },
  InfectedFilesError: class InfectedFilesError extends Error {
    constructor() {
      super('Files infected');
      this.name = 'InfectedFilesError';
    }
  },
}));

const mockAuditLog = vi.fn();
const mockAuditLogDirect = vi.fn();
vi.mock('../audit.service.js', () => ({
  auditService: {
    log: (...args: unknown[]) => mockAuditLog(...args),
    logDirect: (...args: unknown[]) => mockAuditLogDirect(...args),
  },
}));

const mockFileServiceListByMV = vi.fn();
vi.mock('../file.service.js', () => ({
  fileService: {
    listByManuscriptVersion: (...args: unknown[]) =>
      mockFileServiceListByMV(...args),
  },
}));

const mockEnqueueOutboxEvent = vi.fn();
vi.mock('../outbox.js', () => ({
  enqueueOutboxEvent: (...args: unknown[]) => mockEnqueueOutboxEvent(...args),
}));

vi.mock('../../config/env.js', () => ({
  validateEnv: () => ({
    STATUS_TOKEN_TTL_DAYS: 30,
    TUS_ENDPOINT: 'http://localhost:1080/files/',
  }),
}));

vi.mock('@colophony/db', () => {
  const mockSelect = vi.fn();
  const mockFrom = vi.fn();
  const mockWhere = vi.fn();
  const mockLimit = vi.fn();
  const mockInnerJoin = vi.fn();
  const mockInsert = vi.fn();
  const mockValues = vi.fn();
  const mockReturning = vi.fn();
  const mockUpdate = vi.fn();
  const mockSet = vi.fn();

  // Build chain for select queries
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockWhere, innerJoin: mockInnerJoin });
  mockInnerJoin.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ limit: mockLimit });
  mockLimit.mockResolvedValue([]);

  // Build chain for insert
  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockReturnValue({ returning: mockReturning });
  mockReturning.mockResolvedValue([{ id: 'new-id' }]);

  // Build chain for update
  mockUpdate.mockReturnValue({ set: mockSet });
  mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

  const tx = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  };

  return {
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ email: 'test@example.com' }]),
          }),
        }),
      }),
    },
    users: { id: 'id', email: 'email' },
    submissions: {
      id: 'id',
      status: 'status',
      submitterId: 'submitter_id',
      organizationId: 'organization_id',
      manuscriptVersionId: 'manuscript_version_id',
      updatedAt: 'updated_at',
    },
    manuscripts: { id: 'id', ownerId: 'owner_id' },
    manuscriptVersions: { id: 'id', manuscriptId: 'manuscript_id' },
    files: {
      scanStatus: 'scan_status',
      manuscriptVersionId: 'manuscript_version_id',
    },
    formDefinitions: { id: 'id', name: 'name' },
    formPages: {
      formDefinitionId: 'form_definition_id',
      sortOrder: 'sort_order',
    },
    formFields: {
      formDefinitionId: 'form_definition_id',
      sortOrder: 'sort_order',
    },
    eq: vi.fn(),
    and: vi.fn(),
    sql: vi.fn(),
    withRls: vi.fn(
      async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(tx),
    ),
  };
});

vi.mock('@colophony/types', async () => {
  const actual =
    await vi.importActual<typeof import('@colophony/types')>(
      '@colophony/types',
    );
  return actual;
});

import { embedSubmissionService } from '../embed-submission.service.js';

describe('embedSubmissionService — resubmit flow', () => {
  const baseCtx = {
    submissionId: 'sub-1',
    title: 'My Poem',
    organizationId: 'org-1',
    organizationName: 'Poetry Review',
    submitterId: 'user-1',
    revisionNotes: 'Please fix the ending',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getResubmitContext', () => {
    it('returns context when token is valid and submission is R&R', async () => {
      mockGetResubmitContext.mockResolvedValue(baseCtx);

      const result = await embedSubmissionService.getResubmitContext(
        'col_sta_validtoken1234567890abcdef',
      );

      expect(result).toEqual({
        submissionId: 'sub-1',
        title: 'My Poem',
        organizationName: 'Poetry Review',
        revisionNotes: 'Please fix the ending',
      });
    });

    it('returns null for invalid/expired/non-R&R token', async () => {
      mockGetResubmitContext.mockResolvedValue(null);

      const result = await embedSubmissionService.getResubmitContext(
        'col_sta_invalidtoken000000000000',
      );

      expect(result).toBeNull();
    });

    it('defaults revisionNotes to empty string when null', async () => {
      mockGetResubmitContext.mockResolvedValue({
        ...baseCtx,
        revisionNotes: null,
      });

      const result = await embedSubmissionService.getResubmitContext(
        'col_sta_validtoken1234567890abcdef',
      );

      expect(result?.revisionNotes).toBe('');
    });
  });

  describe('prepareResubmitUpload', () => {
    it('returns upload context when token is valid', async () => {
      mockGetResubmitContext.mockResolvedValue(baseCtx);

      const result = await embedSubmissionService.prepareResubmitUpload(
        'col_sta_validtoken1234567890abcdef',
        '127.0.0.1',
        'test-agent',
      );

      expect(result).not.toBeNull();
      expect(result!.manuscriptVersionId).toBe('new-id');
      expect(result!.tusEndpoint).toBe('http://localhost:1080/files/');
      expect(result!.submitterId).toBe('user-1');
      expect(mockAuditLog).toHaveBeenCalled();
    });

    it('returns null for invalid token', async () => {
      mockGetResubmitContext.mockResolvedValue(null);

      const result = await embedSubmissionService.prepareResubmitUpload(
        'col_sta_invalid',
        '127.0.0.1',
        undefined,
      );

      expect(result).toBeNull();
    });
  });

  describe('submitResubmission', () => {
    it('returns null for invalid token', async () => {
      mockGetResubmitContext.mockResolvedValue(null);

      const result = await embedSubmissionService.submitResubmission(
        'col_sta_invalid',
        'mv-1',
        '127.0.0.1',
        undefined,
      );

      expect(result).toBeNull();
    });

    it('returns null when submitter email not found', async () => {
      mockGetResubmitContext.mockResolvedValue(baseCtx);

      // Override db.select to return empty
      const { db } = await import('@colophony/db');
      // eslint-disable-next-line @typescript-eslint/unbound-method -- db.select is a mock
      const dbSelectMock = vi.mocked(db.select);
      dbSelectMock.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never);

      const result = await embedSubmissionService.submitResubmission(
        'col_sta_validtoken1234567890abcdef',
        'mv-1',
        '127.0.0.1',
        undefined,
      );

      expect(result).toBeNull();

      // Restore
      dbSelectMock.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ email: 'test@example.com' }]),
          }),
        }),
      } as never);
    });
  });
});
