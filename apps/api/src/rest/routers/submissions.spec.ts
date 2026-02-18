import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ORPCError } from '@orpc/server';

// Mock the submission service before importing the router
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
  },
  NotDraftError: class NotDraftError extends Error {
    name = 'NotDraftError';
    constructor() {
      super('Submission must be in DRAFT status for this operation');
    }
  },
  InvalidStatusTransitionError: class InvalidStatusTransitionError extends Error {
    name = 'InvalidStatusTransitionError';
    constructor(from: string, to: string) {
      super(`Invalid status transition from "${from}" to "${to}"`);
    }
  },
  UnscannedFilesError: class UnscannedFilesError extends Error {
    name = 'UnscannedFilesError';
  },
  InfectedFilesError: class InfectedFilesError extends Error {
    name = 'InfectedFilesError';
  },
}));

vi.mock('../../services/errors.js', async (importOriginal) => {
  return importOriginal();
});

vi.mock('@colophony/db', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  db: { query: {} },
  submissions: {},
  submissionFiles: {},
  submissionHistory: {},
  users: {},
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

import { submissionService } from '../../services/submission.service.js';
import { ForbiddenError } from '../../services/errors.js';
import { submissionsRouter } from './submissions.js';
import type { RestContext } from '../context.js';
import { createProcedureClient } from '@orpc/server';

const mockService = vi.mocked(submissionService);

// Deterministic UUIDs for tests
const USER_ID = 'a0000000-0000-4000-a000-000000000001';
const ORG_ID = 'b0000000-0000-4000-a000-000000000001';
const SUBMISSION_ID = 'd0000000-0000-4000-a000-000000000001';

// ---------------------------------------------------------------------------
// Context helpers
// ---------------------------------------------------------------------------

function baseContext(): RestContext {
  return {
    authContext: null,
    dbTx: null,
    audit: vi.fn(),
  };
}

function authedContext(): RestContext {
  return {
    authContext: {
      userId: USER_ID,
      zitadelUserId: 'zid-1',
      email: 'test@example.com',
      emailVerified: true,
      authMethod: 'test',
    },
    dbTx: null,
    audit: vi.fn(),
  };
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

function client<T>(procedure: T, context: RestContext) {
  return createProcedureClient(procedure as any, { context }) as any;
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('submissions REST router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // GET /submissions/mine
  // -------------------------------------------------------------------------

  describe('GET /submissions/mine (mine)', () => {
    it('requires authentication', async () => {
      const call = client(submissionsRouter.mine, baseContext());
      await expect(call({})).rejects.toThrow(ORPCError);
    });

    it('requires org context', async () => {
      const call = client(submissionsRouter.mine, authedContext());
      await expect(call({})).rejects.toThrow(ORPCError);
    });

    it('returns submissions for the current user', async () => {
      const response = {
        items: [{ id: SUBMISSION_ID, title: 'My Sub' }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      mockService.listBySubmitter.mockResolvedValueOnce(response as never);

      const call = client(submissionsRouter.mine, orgContext('READER'));
      const result = await call({ page: 1, limit: 20 });
      expect(result.items).toHaveLength(1);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockService.listBySubmitter).toHaveBeenCalledWith(
        expect.anything(),
        USER_ID,
        expect.objectContaining({ page: 1, limit: 20 }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // GET /submissions
  // -------------------------------------------------------------------------

  describe('GET /submissions (list)', () => {
    it('requires org context', async () => {
      const call = client(submissionsRouter.list, authedContext());
      await expect(call({})).rejects.toThrow(ORPCError);
    });

    it('rejects READER role', async () => {
      const call = client(submissionsRouter.list, orgContext('READER'));
      await expect(call({ page: 1, limit: 20 })).rejects.toThrow(
        'Editor or admin role required',
      );
    });

    it('returns all submissions for EDITOR', async () => {
      const response = {
        items: [{ id: SUBMISSION_ID }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      mockService.listAll.mockResolvedValueOnce(response as never);

      const call = client(submissionsRouter.list, orgContext('EDITOR'));
      const result = await call({ page: 1, limit: 20 });
      expect(result.items).toHaveLength(1);
    });

    it('returns all submissions for ADMIN', async () => {
      const response = {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      };
      mockService.listAll.mockResolvedValueOnce(response as never);

      const call = client(submissionsRouter.list, orgContext('ADMIN'));
      const result = await call({ page: 1, limit: 20 });
      expect(result.items).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // POST /submissions
  // -------------------------------------------------------------------------

  describe('POST /submissions (create)', () => {
    it('requires org context', async () => {
      const call = client(submissionsRouter.create, authedContext());
      await expect(call({ title: 'Test' })).rejects.toThrow(ORPCError);
    });

    it('creates a submission', async () => {
      const submission = {
        id: SUBMISSION_ID,
        title: 'Test',
        status: 'DRAFT',
      };
      mockService.createWithAudit.mockResolvedValueOnce(submission as never);

      const call = client(submissionsRouter.create, orgContext('READER'));
      const result = await call({ title: 'Test' });
      expect(result.id).toBe(SUBMISSION_ID);
    });
  });

  // -------------------------------------------------------------------------
  // GET /submissions/{id}
  // -------------------------------------------------------------------------

  describe('GET /submissions/{id} (get)', () => {
    it('requires org context', async () => {
      const call = client(submissionsRouter.get, authedContext());
      await expect(call({ id: SUBMISSION_ID })).rejects.toThrow(ORPCError);
    });

    it('returns submission with details', async () => {
      const submission = {
        id: SUBMISSION_ID,
        title: 'Test',
        files: [],
        submitterEmail: 'test@example.com',
      };
      mockService.getByIdWithAccess.mockResolvedValueOnce(submission as never);

      const call = client(submissionsRouter.get, orgContext('READER'));
      const result = await call({ id: SUBMISSION_ID });
      expect(result.id).toBe(SUBMISSION_ID);
    });

    it('maps SubmissionNotFoundError to NOT_FOUND', async () => {
      const { SubmissionNotFoundError } =
        await import('../../services/submission.service.js');
      mockService.getByIdWithAccess.mockRejectedValueOnce(
        new SubmissionNotFoundError(SUBMISSION_ID),
      );

      const call = client(submissionsRouter.get, orgContext('READER'));
      await expect(call({ id: SUBMISSION_ID })).rejects.toThrow(ORPCError);
    });

    it('maps ForbiddenError to FORBIDDEN', async () => {
      mockService.getByIdWithAccess.mockRejectedValueOnce(
        new ForbiddenError('You do not have access'),
      );

      const call = client(submissionsRouter.get, orgContext('READER'));
      await expect(call({ id: SUBMISSION_ID })).rejects.toThrow(
        'You do not have access',
      );
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /submissions/{id}
  // -------------------------------------------------------------------------

  describe('PATCH /submissions/{id} (update)', () => {
    it('requires org context', async () => {
      const call = client(submissionsRouter.update, authedContext());
      await expect(
        call({ id: SUBMISSION_ID, title: 'New Title' }),
      ).rejects.toThrow(ORPCError);
    });

    it('updates a DRAFT submission', async () => {
      const updated = { id: SUBMISSION_ID, title: 'New Title' };
      mockService.updateAsOwner.mockResolvedValueOnce(updated as never);

      const call = client(submissionsRouter.update, orgContext('READER'));
      const result = await call({ id: SUBMISSION_ID, title: 'New Title' });
      expect(result.title).toBe('New Title');
    });

    it('maps NotDraftError to BAD_REQUEST', async () => {
      const { NotDraftError } =
        await import('../../services/submission.service.js');
      mockService.updateAsOwner.mockRejectedValueOnce(new NotDraftError());

      const call = client(submissionsRouter.update, orgContext('READER'));
      await expect(call({ id: SUBMISSION_ID, title: 'New' })).rejects.toThrow(
        'DRAFT',
      );
    });

    it('maps ForbiddenError when not owner', async () => {
      mockService.updateAsOwner.mockRejectedValueOnce(
        new ForbiddenError('Only the submitter can update'),
      );

      const call = client(submissionsRouter.update, orgContext('READER'));
      await expect(call({ id: SUBMISSION_ID, title: 'New' })).rejects.toThrow(
        'submitter',
      );
    });
  });

  // -------------------------------------------------------------------------
  // POST /submissions/{id}/submit
  // -------------------------------------------------------------------------

  describe('POST /submissions/{id}/submit', () => {
    it('requires org context', async () => {
      const call = client(submissionsRouter.submit, authedContext());
      await expect(call({ id: SUBMISSION_ID })).rejects.toThrow(ORPCError);
    });

    it('submits a DRAFT submission', async () => {
      const result = {
        submission: { id: SUBMISSION_ID, status: 'SUBMITTED' },
        historyEntry: { id: 'h-1' },
      };
      mockService.submitAsOwner.mockResolvedValueOnce(result as never);

      const call = client(submissionsRouter.submit, orgContext('READER'));
      const response = await call({ id: SUBMISSION_ID });
      expect(response.submission.status).toBe('SUBMITTED');
    });

    it('maps ForbiddenError when not owner', async () => {
      mockService.submitAsOwner.mockRejectedValueOnce(
        new ForbiddenError('Only the submitter can submit'),
      );

      const call = client(submissionsRouter.submit, orgContext('READER'));
      await expect(call({ id: SUBMISSION_ID })).rejects.toThrow('submitter');
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /submissions/{id}
  // -------------------------------------------------------------------------

  describe('DELETE /submissions/{id} (delete)', () => {
    it('requires org context', async () => {
      const call = client(submissionsRouter.delete, authedContext());
      await expect(call({ id: SUBMISSION_ID })).rejects.toThrow(ORPCError);
    });

    it('deletes a DRAFT submission', async () => {
      mockService.deleteAsOwner.mockResolvedValueOnce({
        success: true,
      } as never);

      const call = client(submissionsRouter.delete, orgContext('READER'));
      const result = await call({ id: SUBMISSION_ID });
      expect(result).toEqual({ success: true });
    });

    it('maps NotDraftError to BAD_REQUEST', async () => {
      const { NotDraftError } =
        await import('../../services/submission.service.js');
      mockService.deleteAsOwner.mockRejectedValueOnce(new NotDraftError());

      const call = client(submissionsRouter.delete, orgContext('READER'));
      await expect(call({ id: SUBMISSION_ID })).rejects.toThrow('DRAFT');
    });

    it('maps SubmissionNotFoundError to NOT_FOUND', async () => {
      const { SubmissionNotFoundError } =
        await import('../../services/submission.service.js');
      mockService.deleteAsOwner.mockRejectedValueOnce(
        new SubmissionNotFoundError(SUBMISSION_ID),
      );

      const call = client(submissionsRouter.delete, orgContext('READER'));
      await expect(call({ id: SUBMISSION_ID })).rejects.toThrow(ORPCError);
    });
  });

  // -------------------------------------------------------------------------
  // POST /submissions/{id}/withdraw
  // -------------------------------------------------------------------------

  describe('POST /submissions/{id}/withdraw', () => {
    it('requires org context', async () => {
      const call = client(submissionsRouter.withdraw, authedContext());
      await expect(call({ id: SUBMISSION_ID })).rejects.toThrow(ORPCError);
    });

    it('withdraws a submission', async () => {
      const result = {
        submission: { id: SUBMISSION_ID, status: 'WITHDRAWN' },
        historyEntry: { id: 'h-1' },
      };
      mockService.withdrawAsOwner.mockResolvedValueOnce(result as never);

      const call = client(submissionsRouter.withdraw, orgContext('READER'));
      const response = await call({ id: SUBMISSION_ID });
      expect(response.submission.status).toBe('WITHDRAWN');
    });

    it('maps ForbiddenError when not owner', async () => {
      mockService.withdrawAsOwner.mockRejectedValueOnce(
        new ForbiddenError('Only the submitter can withdraw'),
      );

      const call = client(submissionsRouter.withdraw, orgContext('READER'));
      await expect(call({ id: SUBMISSION_ID })).rejects.toThrow('submitter');
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /submissions/{id}/status
  // -------------------------------------------------------------------------

  describe('PATCH /submissions/{id}/status (updateStatus)', () => {
    it('requires org context', async () => {
      const call = client(submissionsRouter.updateStatus, authedContext());
      await expect(
        call({ id: SUBMISSION_ID, status: 'UNDER_REVIEW' }),
      ).rejects.toThrow(ORPCError);
    });

    it('rejects READER role', async () => {
      mockService.updateStatusAsEditor.mockRejectedValueOnce(
        new ForbiddenError('Editor or admin role required'),
      );

      const call = client(submissionsRouter.updateStatus, orgContext('READER'));
      await expect(
        call({ id: SUBMISSION_ID, status: 'UNDER_REVIEW' }),
      ).rejects.toThrow('Editor or admin role required');
    });

    it('updates status as EDITOR', async () => {
      const result = {
        submission: { id: SUBMISSION_ID, status: 'UNDER_REVIEW' },
        historyEntry: { id: 'h-1' },
      };
      mockService.updateStatusAsEditor.mockResolvedValueOnce(result as never);

      const call = client(submissionsRouter.updateStatus, orgContext('EDITOR'));
      const response = await call({
        id: SUBMISSION_ID,
        status: 'UNDER_REVIEW',
      });
      expect(response.submission.status).toBe('UNDER_REVIEW');
    });

    it('maps InvalidStatusTransitionError to BAD_REQUEST', async () => {
      const { InvalidStatusTransitionError } =
        await import('../../services/submission.service.js');
      mockService.updateStatusAsEditor.mockRejectedValueOnce(
        new InvalidStatusTransitionError('DRAFT', 'ACCEPTED'),
      );

      const call = client(submissionsRouter.updateStatus, orgContext('EDITOR'));
      await expect(
        call({ id: SUBMISSION_ID, status: 'ACCEPTED' }),
      ).rejects.toThrow('Invalid status transition');
    });

    it('passes comment when provided', async () => {
      const result = {
        submission: { id: SUBMISSION_ID, status: 'REJECTED' },
        historyEntry: { id: 'h-1' },
      };
      mockService.updateStatusAsEditor.mockResolvedValueOnce(result as never);

      const call = client(submissionsRouter.updateStatus, orgContext('ADMIN'));
      await call({
        id: SUBMISSION_ID,
        status: 'REJECTED',
        comment: 'Not a fit',
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockService.updateStatusAsEditor).toHaveBeenCalledWith(
        expect.anything(),
        SUBMISSION_ID,
        'REJECTED',
        'Not a fit',
      );
    });
  });

  // -------------------------------------------------------------------------
  // GET /submissions/{id}/history
  // -------------------------------------------------------------------------

  describe('GET /submissions/{id}/history', () => {
    it('requires org context', async () => {
      const call = client(submissionsRouter.history, authedContext());
      await expect(call({ id: SUBMISSION_ID })).rejects.toThrow(ORPCError);
    });

    it('returns history for submission', async () => {
      const history = [
        { id: 'h-1', fromStatus: null, toStatus: 'DRAFT' },
        { id: 'h-2', fromStatus: 'DRAFT', toStatus: 'SUBMITTED' },
      ];
      mockService.getHistoryWithAccess.mockResolvedValueOnce(history as never);

      const call = client(submissionsRouter.history, orgContext('READER'));
      const result = await call({ id: SUBMISSION_ID });
      expect(result).toHaveLength(2);
    });

    it('maps SubmissionNotFoundError to NOT_FOUND', async () => {
      const { SubmissionNotFoundError } =
        await import('../../services/submission.service.js');
      mockService.getHistoryWithAccess.mockRejectedValueOnce(
        new SubmissionNotFoundError(SUBMISSION_ID),
      );

      const call = client(submissionsRouter.history, orgContext('READER'));
      await expect(call({ id: SUBMISSION_ID })).rejects.toThrow(ORPCError);
    });

    it('maps ForbiddenError to FORBIDDEN', async () => {
      mockService.getHistoryWithAccess.mockRejectedValueOnce(
        new ForbiddenError('You do not have access'),
      );

      const call = client(submissionsRouter.history, orgContext('READER'));
      await expect(call({ id: SUBMISSION_ID })).rejects.toThrow(
        'You do not have access',
      );
    });
  });

  // -------------------------------------------------------------------------
  // API key scope enforcement
  // -------------------------------------------------------------------------

  describe('API key scope enforcement', () => {
    it('denies submissions:read route with wrong scope', async () => {
      const ctx = apiKeyContext(['files:read']);
      const call = client(submissionsRouter.mine, ctx);
      await expect(call({ page: 1, limit: 20 })).rejects.toThrow(
        'Insufficient API key scope',
      );
    });

    it('denies submissions:write route with only read scope', async () => {
      const ctx = apiKeyContext(['submissions:read']);
      const call = client(submissionsRouter.create, ctx);
      await expect(call({ title: 'Test' })).rejects.toThrow(
        'Insufficient API key scope',
      );
    });

    it('allows API key with correct read scope', async () => {
      const response = {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      };
      mockService.listBySubmitter.mockResolvedValueOnce(response as never);

      const ctx = apiKeyContext(['submissions:read']);
      const call = client(submissionsRouter.mine, ctx);
      const result = await call({ page: 1, limit: 20 });
      expect(result.items).toHaveLength(0);
    });

    it('calls audit on scope denial', async () => {
      const ctx = apiKeyContext(['files:read']);
      const call = client(submissionsRouter.mine, ctx);
      await expect(call({ page: 1, limit: 20 })).rejects.toThrow();
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'API_KEY_SCOPE_DENIED',
          resource: 'api_key',
        }),
      );
    });
  });
});
