import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb, mockWithRls, mockAuditService, mockSubmissionService } =
  vi.hoisted(() => {
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
    return { mockDb, mockWithRls, mockAuditService, mockSubmissionService };
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
  formDefinitions: { id: 'id', name: 'name' },
  formFields: {
    formDefinitionId: 'form_definition_id',
    sortOrder: 'sort_order',
  },
  formPages: {
    formDefinitionId: 'form_definition_id',
    sortOrder: 'sort_order',
  },
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

describe('embedSubmissionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findOrCreateGuestUser', () => {
    it('creates user with isGuest=true for unknown email', async () => {
      // Mock select (find existing) — empty result
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

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
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'existing-user-1' }]),
          }),
        }),
      });

      const result = await embedSubmissionService.findOrCreateGuestUser(
        'EXISTING@example.com',
      );

      expect(result.id).toBe('existing-user-1');
      expect(result.isNew).toBe(false);
    });
  });

  describe('submitFromEmbed', () => {
    it('creates submission in SUBMITTED status with history entries', async () => {
      // Mock findOrCreateGuestUser
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'user-1' }]),
          }),
        }),
      });

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
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'user-1' }]),
          }),
        }),
      });

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
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'existing-user' }]),
          }),
        }),
      });

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
  });
});
