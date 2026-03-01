import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockDb,
  mockWithRls,
  mockAuditService,
  mockSubmissionService,
  mockFileService,
  mockStatusTokenService,
  mockEnqueueOutboxEvent,
} = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
  };
  const mockWithRls = vi.fn();
  const mockAuditService = {
    log: vi.fn(),
    logDirect: vi.fn(),
  };
  const mockSubmissionService = {
    create: vi.fn(),
    updateStatus: vi.fn(),
  };
  const mockFileService = {
    listByManuscriptVersion: vi.fn(),
  };
  const mockStatusTokenService = {
    generateAndStore: vi.fn().mockResolvedValue('col_sta_testtoken123'),
  };
  const mockEnqueueOutboxEvent = vi.fn();
  return {
    mockDb,
    mockWithRls,
    mockAuditService,
    mockSubmissionService,
    mockFileService,
    mockStatusTokenService,
    mockEnqueueOutboxEvent,
  };
});

vi.mock('@colophony/db', () => ({
  db: mockDb,
  withRls: mockWithRls,
  users: {
    id: 'id',
    email: 'email',
    isGuest: 'is_guest',
    emailVerified: 'email_verified',
  },
  manuscripts: { id: 'id', ownerId: 'owner_id', title: 'title' },
  manuscriptVersions: {
    id: 'id',
    manuscriptId: 'manuscript_id',
    versionNumber: 'version_number',
  },
  formDefinitions: { id: 'id', name: 'name' },
  formFields: {
    formDefinitionId: 'form_definition_id',
    sortOrder: 'sort_order',
  },
  formPages: {
    formDefinitionId: 'form_definition_id',
    sortOrder: 'sort_order',
  },
  submissions: { id: 'id', statusTokenHash: 'status_token_hash' },
  pool: { query: vi.fn() },
  eq: vi.fn((_col: unknown, val: unknown) => val),
  sql: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  asc: vi.fn(),
}));

vi.mock('./audit.service.js', () => ({
  auditService: mockAuditService,
}));

vi.mock('./submission.service.js', () => ({
  submissionService: mockSubmissionService,
}));

vi.mock('./file.service.js', () => ({
  fileService: mockFileService,
}));

vi.mock('./status-token.service.js', () => ({
  statusTokenService: mockStatusTokenService,
}));

vi.mock('./outbox.js', () => ({
  enqueueOutboxEvent: mockEnqueueOutboxEvent,
}));

vi.mock('../config/env.js', () => ({
  validateEnv: vi.fn(() => ({
    STATUS_TOKEN_TTL_DAYS: 90,
  })),
}));

import {
  embedSubmissionService,
  PeriodClosedError,
} from './embed-submission.service.js';
import type { VerifiedEmbedToken } from './embed-token.service.js';

function makeToken(
  overrides: Partial<VerifiedEmbedToken> = {},
): VerifiedEmbedToken {
  const now = new Date();
  return {
    id: 'token-1',
    organizationId: 'org-1',
    submissionPeriodId: 'period-1',
    allowedOrigins: [],
    themeConfig: null,
    active: true,
    expiresAt: null,
    period: {
      name: 'Fall 2026',
      opensAt: new Date(now.getTime() - 86400000),
      closesAt: new Date(now.getTime() + 86400000),
      formDefinitionId: null,
      maxSubmissions: null,
      fee: null,
    },
    ...overrides,
  };
}

/** Helper to mock `db.select().from().where().limit()` chain */
function mockSelectChain(results: unknown[]) {
  mockDb.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(results),
      }),
    }),
  });
}

/** Helper to mock `tx.insert().values().returning()` chain inside withRls */
function mockInsertChain(returning: unknown[]) {
  return {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(returning),
    }),
  };
}

describe('embedSubmissionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findOrCreateGuestUser', () => {
    it('creates user with isGuest=true for unknown email', async () => {
      // Mock select (find existing) — empty result
      mockSelectChain([]);

      // Mock insert (create guest)
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'new-user-1' }]),
        }),
      });

      const result =
        await embedSubmissionService.findOrCreateGuestUser('New@Example.COM');

      expect(result.id).toBe('new-user-1');
      expect(result.isNew).toBe(true);
    });

    it('returns existing user for known email (case-insensitive)', async () => {
      mockSelectChain([{ id: 'existing-user-1' }]);

      const result = await embedSubmissionService.findOrCreateGuestUser(
        'EXISTING@example.com',
      );

      expect(result.id).toBe('existing-user-1');
      expect(result.isNew).toBe(false);
    });
  });

  describe('findGuestUser', () => {
    it('returns user when found by email', async () => {
      mockSelectChain([{ id: 'user-1' }]);

      const result =
        await embedSubmissionService.findGuestUser('writer@example.com');

      expect(result).toEqual({ id: 'user-1' });
    });

    it('returns null for unknown email', async () => {
      mockSelectChain([]);

      const result = await embedSubmissionService.findGuestUser(
        'unknown@example.com',
      );

      expect(result).toBeNull();
    });
  });

  describe('prepareUpload', () => {
    it('creates guest user and manuscript version', async () => {
      // Mock findOrCreateGuestUser (new user)
      mockSelectChain([]);
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'guest-1' }]),
        }),
      });
      mockAuditService.logDirect.mockResolvedValue(undefined);

      // Mock withRls callback
      mockWithRls.mockImplementation(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
          let insertCallCount = 0;
          const mockTx = {
            insert: vi.fn().mockImplementation(() => {
              insertCallCount++;
              if (insertCallCount === 1) {
                // manuscript insert
                return mockInsertChain([{ id: 'manuscript-1' }]);
              }
              // version insert
              return mockInsertChain([{ id: 'version-1' }]);
            }),
          };
          return fn(mockTx);
        },
      );
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await embedSubmissionService.prepareUpload(
        makeToken(),
        { email: 'writer@example.com', name: 'Writer' },
        '127.0.0.1',
        'TestAgent/1.0',
        'http://localhost:1080/files/',
      );

      expect(result.manuscriptVersionId).toBe('version-1');
      expect(result.guestUserId).toBe('guest-1');
      expect(result.tusEndpoint).toBe('http://localhost:1080/files/');
      expect(result.maxFileSize).toBeGreaterThan(0);
      expect(result.maxFiles).toBeGreaterThan(0);
      expect(result.allowedMimeTypes.length).toBeGreaterThan(0);
    });

    it('reuses existing guest user', async () => {
      // Mock findOrCreateGuestUser (existing user)
      mockSelectChain([{ id: 'existing-1' }]);

      mockWithRls.mockImplementation(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
          let insertCallCount = 0;
          const mockTx = {
            insert: vi.fn().mockImplementation(() => {
              insertCallCount++;
              if (insertCallCount === 1) {
                return mockInsertChain([{ id: 'manuscript-1' }]);
              }
              return mockInsertChain([{ id: 'version-1' }]);
            }),
          };
          return fn(mockTx);
        },
      );
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await embedSubmissionService.prepareUpload(
        makeToken(),
        { email: 'existing@example.com' },
        '127.0.0.1',
        undefined,
        'http://localhost:1080/files/',
      );

      expect(result.guestUserId).toBe('existing-1');
      // Should NOT call logDirect for guest user creation
      expect(mockAuditService.logDirect).not.toHaveBeenCalled();
    });

    it('throws for expired period', async () => {
      const closedToken = makeToken({
        period: {
          name: 'Expired Period',
          opensAt: new Date('2020-01-01'),
          closesAt: new Date('2020-12-31'),
          formDefinitionId: null,
          maxSubmissions: null,
          fee: null,
        },
      });

      await expect(
        embedSubmissionService.prepareUpload(
          closedToken,
          { email: 'writer@example.com' },
          '127.0.0.1',
          undefined,
          'http://localhost:1080/files/',
        ),
      ).rejects.toThrow(PeriodClosedError);
    });

    it('throws for not-yet-open period', async () => {
      const futureToken = makeToken({
        period: {
          name: 'Future Period',
          opensAt: new Date('2030-01-01'),
          closesAt: new Date('2030-12-31'),
          formDefinitionId: null,
          maxSubmissions: null,
          fee: null,
        },
      });

      await expect(
        embedSubmissionService.prepareUpload(
          futureToken,
          { email: 'writer@example.com' },
          '127.0.0.1',
          undefined,
          'http://localhost:1080/files/',
        ),
      ).rejects.toThrow(PeriodClosedError);
    });

    it('audit logs manuscript creation', async () => {
      mockSelectChain([{ id: 'user-1' }]);

      mockWithRls.mockImplementation(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
          let insertCallCount = 0;
          const mockTx = {
            insert: vi.fn().mockImplementation(() => {
              insertCallCount++;
              if (insertCallCount === 1) {
                return mockInsertChain([{ id: 'manuscript-1' }]);
              }
              return mockInsertChain([{ id: 'version-1' }]);
            }),
          };
          return fn(mockTx);
        },
      );
      mockAuditService.log.mockResolvedValue(undefined);

      await embedSubmissionService.prepareUpload(
        makeToken(),
        { email: 'writer@example.com' },
        '127.0.0.1',
        'TestAgent/1.0',
        'http://localhost:1080/files/',
      );

      // Should be called twice: MANUSCRIPT_CREATED + MANUSCRIPT_VERSION_CREATED
      expect(mockAuditService.log).toHaveBeenCalledTimes(2);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'MANUSCRIPT_CREATED' }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'MANUSCRIPT_VERSION_CREATED' }),
      );
    });
  });

  describe('getUploadStatus', () => {
    it('returns files with scan statuses', async () => {
      // Mock findGuestUser
      mockSelectChain([{ id: 'user-1' }]);

      const mockFiles = [
        {
          id: 'file-1',
          filename: 'poem.pdf',
          size: BigInt(1024),
          mimeType: 'application/pdf',
          scanStatus: 'CLEAN',
        },
        {
          id: 'file-2',
          filename: 'story.docx',
          size: BigInt(2048),
          mimeType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          scanStatus: 'PENDING',
        },
      ];

      mockWithRls.mockImplementation(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
          return fn({});
        },
      );
      mockFileService.listByManuscriptVersion.mockResolvedValue(mockFiles);

      const result = await embedSubmissionService.getUploadStatus(
        makeToken(),
        'version-1',
        'writer@example.com',
      );

      expect(result.files).toHaveLength(2);
      expect(result.allClean).toBe(false);
      expect(result.files[0].size).toBe(1024);
      expect(result.files[1].scanStatus).toBe('PENDING');
    });

    it('returns allClean when all files CLEAN', async () => {
      mockSelectChain([{ id: 'user-1' }]);

      const mockFiles = [
        {
          id: 'file-1',
          filename: 'poem.pdf',
          size: BigInt(1024),
          mimeType: 'application/pdf',
          scanStatus: 'CLEAN',
        },
      ];

      mockWithRls.mockImplementation(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
          return fn({});
        },
      );
      mockFileService.listByManuscriptVersion.mockResolvedValue(mockFiles);

      const result = await embedSubmissionService.getUploadStatus(
        makeToken(),
        'version-1',
        'writer@example.com',
      );

      expect(result.allClean).toBe(true);
    });

    it('scopes RLS query to token org + user', async () => {
      mockSelectChain([{ id: 'user-1' }]);

      mockWithRls.mockImplementation(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
          return fn({});
        },
      );
      mockFileService.listByManuscriptVersion.mockResolvedValue([]);

      const token = makeToken({ organizationId: 'org-specific-123' });
      await embedSubmissionService.getUploadStatus(
        token,
        'version-1',
        'writer@example.com',
      );

      expect(mockWithRls).toHaveBeenCalledWith(
        { orgId: 'org-specific-123', userId: 'user-1' },
        expect.any(Function),
      );
    });

    it('throws 404 for unknown email', async () => {
      mockSelectChain([]);

      await expect(
        embedSubmissionService.getUploadStatus(
          makeToken(),
          'version-1',
          'unknown@example.com',
        ),
      ).rejects.toThrow('User not found');
    });
  });

  describe('submitFromEmbed', () => {
    it('creates submission in SUBMITTED status with history entries', async () => {
      // Mock findOrCreateGuestUser
      mockSelectChain([{ id: 'user-1' }]);

      // Mock withRls to execute the callback
      mockWithRls.mockImplementation(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
          return fn({} as never);
        },
      );

      mockSubmissionService.create.mockResolvedValue({
        id: 'sub-1',
        status: 'DRAFT',
      });
      mockSubmissionService.updateStatus.mockResolvedValue({
        submission: { id: 'sub-1', status: 'SUBMITTED' },
        historyEntry: { id: 'history-1' },
      });
      mockAuditService.log.mockResolvedValue(undefined);

      const token = makeToken();
      const result = await embedSubmissionService.submitFromEmbed(
        token,
        {
          email: 'writer@example.com',
          title: 'My Poem',
          content: 'Roses are red...',
        },
        '127.0.0.1',
        'TestAgent/1.0',
      );

      expect(result.submissionId).toBe('sub-1');
      expect(result.userId).toBe('user-1');

      // Verify create was called for DRAFT
      expect(mockSubmissionService.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ title: 'My Poem' }),
        'org-1',
        'user-1',
      );

      // Verify updateStatus was called for DRAFT→SUBMITTED
      expect(mockSubmissionService.updateStatus).toHaveBeenCalledWith(
        expect.anything(),
        'sub-1',
        'SUBMITTED',
        'user-1',
        undefined,
        'submitter',
      );
    });

    it('throws PeriodClosedError when period not open', async () => {
      mockSelectChain([{ id: 'user-1' }]);

      mockWithRls.mockImplementation(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
          return fn({} as never);
        },
      );

      const closedToken = makeToken({
        period: {
          name: 'Expired Period',
          opensAt: new Date('2020-01-01'),
          closesAt: new Date('2020-12-31'),
          formDefinitionId: null,
          maxSubmissions: null,
          fee: null,
        },
      });

      await expect(
        embedSubmissionService.submitFromEmbed(
          closedToken,
          {
            email: 'writer@example.com',
            title: 'Late Submission',
          },
          '127.0.0.1',
          undefined,
        ),
      ).rejects.toThrow(PeriodClosedError);
    });

    it('uses existing registered user when email matches', async () => {
      // Existing user found
      mockSelectChain([{ id: 'existing-user' }]);

      mockWithRls.mockImplementation(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
          return fn({} as never);
        },
      );

      mockSubmissionService.create.mockResolvedValue({ id: 'sub-1' });
      mockSubmissionService.updateStatus.mockResolvedValue({
        submission: { id: 'sub-1' },
        historyEntry: {},
      });
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await embedSubmissionService.submitFromEmbed(
        makeToken(),
        { email: 'existing@example.com', title: 'Test' },
        '127.0.0.1',
        undefined,
      );

      expect(result.userId).toBe('existing-user');
      // Should NOT call logDirect for guest user creation
      expect(mockAuditService.logDirect).not.toHaveBeenCalled();
    });

    it('passes manuscriptVersionId to submissionService.create', async () => {
      mockSelectChain([{ id: 'user-1' }]);

      mockWithRls.mockImplementation(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
          return fn({} as never);
        },
      );

      mockSubmissionService.create.mockResolvedValue({
        id: 'sub-1',
        status: 'DRAFT',
      });
      mockSubmissionService.updateStatus.mockResolvedValue({
        submission: { id: 'sub-1', status: 'SUBMITTED' },
        historyEntry: { id: 'history-1' },
      });
      mockAuditService.log.mockResolvedValue(undefined);

      await embedSubmissionService.submitFromEmbed(
        makeToken(),
        {
          email: 'writer@example.com',
          title: 'My Poem',
          manuscriptVersionId: 'mv-123',
        },
        '127.0.0.1',
        undefined,
      );

      expect(mockSubmissionService.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ manuscriptVersionId: 'mv-123' }),
        'org-1',
        'user-1',
      );
    });
  });
});
