import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

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
  },
  SubmissionNotFoundError: class SubmissionNotFoundError extends Error {
    name = 'SubmissionNotFoundError';
    constructor(id = 'unknown') {
      super(`Submission "${id}" not found`);
    }
  },
  InvalidStatusTransitionError: class InvalidStatusTransitionError extends Error {
    name = 'InvalidStatusTransitionError';
    constructor(from = 'X', to = 'Y') {
      super(`Invalid status transition from "${from}" to "${to}"`);
    }
  },
  NotDraftError: class NotDraftError extends Error {
    name = 'NotDraftError';
    constructor() {
      super('Submission must be in DRAFT status for this operation');
    }
  },
  UnscannedFilesError: class UnscannedFilesError extends Error {
    name = 'UnscannedFilesError';
    constructor() {
      super(
        'Cannot submit: one or more files are still pending or being scanned',
      );
    }
  },
  InfectedFilesError: class InfectedFilesError extends Error {
    name = 'InfectedFilesError';
    constructor() {
      super('Cannot submit: one or more files have been flagged as infected');
    }
  },
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

import { submissionService } from '../../services/submission.service.js';
import { appRouter } from '../router.js';
import type { TRPCContext } from '../context.js';

const mockService = vi.mocked(submissionService);

function makeContext(overrides: Partial<TRPCContext> = {}): TRPCContext {
  return {
    authContext: null,
    dbTx: null,
    audit: vi.fn(),
    ...overrides,
  };
}

function authedContext(overrides: Partial<TRPCContext> = {}): TRPCContext {
  return makeContext({
    authContext: {
      userId: 'user-1',
      zitadelUserId: 'zid-1',
      email: 'test@example.com',
      emailVerified: true,
    },
    ...overrides,
  });
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
      orgId: 'org-1',
      role,
    },
    dbTx: mockTx,
    audit: vi.fn(),
    ...overrides,
  });
}

function editorContext(overrides: Partial<TRPCContext> = {}): TRPCContext {
  return orgContext('EDITOR', overrides);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createCaller = (appRouter as any).createCaller as (
  ctx: TRPCContext,
) => any;

const SUBMISSION_ID = 'a1111111-1111-1111-1111-111111111111';

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

describe('submissions tRPC router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Auth / access control
  // -------------------------------------------------------------------------

  describe('auth and access', () => {
    it('mySubmissions requires authentication', async () => {
      const caller = createCaller(makeContext());
      await expect(
        caller.submissions.mySubmissions({ page: 1, limit: 20 }),
      ).rejects.toThrow(TRPCError);
    });

    it('mySubmissions requires org context', async () => {
      const caller = createCaller(authedContext());
      await expect(
        caller.submissions.mySubmissions({ page: 1, limit: 20 }),
      ).rejects.toThrow(TRPCError);
    });

    it('list requires EDITOR or ADMIN role', async () => {
      const caller = createCaller(orgContext('READER'));
      await expect(
        caller.submissions.list({ page: 1, limit: 20 }),
      ).rejects.toThrow('Editor or admin role required');
    });

    it('list allows EDITOR role', async () => {
      mockService.listAll.mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      } as never);
      const caller = createCaller(editorContext());
      const result = await caller.submissions.list({ page: 1, limit: 20 });
      expect(result.items).toEqual([]);
    });

    it('updateStatus requires EDITOR or ADMIN role', async () => {
      const caller = createCaller(orgContext('READER'));
      await expect(
        caller.submissions.updateStatus({
          id: SUBMISSION_ID,
          status: 'UNDER_REVIEW',
        }),
      ).rejects.toThrow('Editor or admin role required');
    });

    it('update requires ownership', async () => {
      mockService.getById.mockResolvedValueOnce(
        makeDraftSubmission('other-user') as never,
      );
      const caller = createCaller(orgContext());
      await expect(
        caller.submissions.update({ id: SUBMISSION_ID, title: 'New Title' }),
      ).rejects.toThrow('Only the submitter');
    });

    it('submit requires ownership', async () => {
      mockService.getById.mockResolvedValueOnce(
        makeDraftSubmission('other-user') as never,
      );
      const caller = createCaller(orgContext());
      await expect(
        caller.submissions.submit({ id: SUBMISSION_ID }),
      ).rejects.toThrow('Only the submitter');
    });

    it('delete requires ownership', async () => {
      mockService.getById.mockResolvedValueOnce(
        makeDraftSubmission('other-user') as never,
      );
      const caller = createCaller(orgContext());
      await expect(
        caller.submissions.delete({ id: SUBMISSION_ID }),
      ).rejects.toThrow('Only the submitter');
    });

    it('withdraw requires ownership', async () => {
      mockService.getById.mockResolvedValueOnce(
        makeDraftSubmission('other-user') as never,
      );
      const caller = createCaller(orgContext());
      await expect(
        caller.submissions.withdraw({ id: SUBMISSION_ID }),
      ).rejects.toThrow('Only the submitter');
    });

    it('getById allows owner to view', async () => {
      const sub = makeDraftSubmission('user-1');
      mockService.getById.mockResolvedValueOnce(sub as never);
      const caller = createCaller(orgContext('READER'));
      const result = await caller.submissions.getById({ id: SUBMISSION_ID });
      expect(result.id).toBe(SUBMISSION_ID);
    });

    it('getById allows EDITOR to view others submissions', async () => {
      const sub = makeDraftSubmission('other-user');
      mockService.getById.mockResolvedValueOnce(sub as never);
      const caller = createCaller(editorContext());
      const result = await caller.submissions.getById({ id: SUBMISSION_ID });
      expect(result.id).toBe(SUBMISSION_ID);
    });

    it('getById denies READER from viewing others submissions', async () => {
      const sub = makeDraftSubmission('other-user');
      mockService.getById.mockResolvedValueOnce(sub as never);
      const caller = createCaller(orgContext('READER'));
      await expect(
        caller.submissions.getById({ id: SUBMISSION_ID }),
      ).rejects.toThrow('do not have access');
    });
  });

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  describe('mySubmissions', () => {
    it('passes userId filter to service', async () => {
      const response = {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      };
      mockService.listBySubmitter.mockResolvedValueOnce(response as never);

      const caller = createCaller(orgContext());
      await caller.submissions.mySubmissions({ page: 1, limit: 20 });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockService.listBySubmitter).toHaveBeenCalledWith(
        expect.anything(),
        'user-1',
        { page: 1, limit: 20 },
      );
    });
  });

  describe('list', () => {
    it('calls listAll (not listBySubmitter)', async () => {
      const response = {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      };
      mockService.listAll.mockResolvedValueOnce(response as never);

      const caller = createCaller(orgContext('ADMIN'));
      await caller.submissions.list({ page: 1, limit: 20 });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockService.listAll).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockService.listBySubmitter).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('returns submission when found', async () => {
      const sub = makeDraftSubmission();
      mockService.getById.mockResolvedValueOnce(sub as never);

      const caller = createCaller(orgContext());
      const result = await caller.submissions.getById({ id: SUBMISSION_ID });
      expect(result).toEqual(sub);
    });

    it('throws NOT_FOUND when missing', async () => {
      mockService.getById.mockResolvedValueOnce(null as never);

      const caller = createCaller(orgContext());
      await expect(
        caller.submissions.getById({ id: SUBMISSION_ID }),
      ).rejects.toThrow('not found');
    });
  });

  describe('getHistory', () => {
    it('returns history array', async () => {
      const history = [
        {
          id: 'h-1',
          submissionId: SUBMISSION_ID,
          fromStatus: null,
          toStatus: 'DRAFT',
          changedBy: 'user-1',
          comment: null,
          changedAt: new Date(),
        },
      ];
      mockService.getHistory.mockResolvedValueOnce(history as never);

      const caller = createCaller(orgContext());
      const result = await caller.submissions.getHistory({
        submissionId: SUBMISSION_ID,
      });
      expect(result).toHaveLength(1);
      expect(result[0].toStatus).toBe('DRAFT');
    });
  });

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  describe('create', () => {
    it('returns submission and calls audit', async () => {
      const sub = {
        id: SUBMISSION_ID,
        title: 'My Poem',
        status: 'DRAFT',
      };
      mockService.create.mockResolvedValueOnce(sub as never);

      const ctx = orgContext();
      const caller = createCaller(ctx);
      const result = await caller.submissions.create({ title: 'My Poem' });

      expect(result.id).toBe(SUBMISSION_ID);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockService.create).toHaveBeenCalledWith(
        expect.anything(),
        { title: 'My Poem' },
        'org-1',
        'user-1',
      );
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBMISSION_CREATED' }),
      );
    });
  });

  describe('update', () => {
    it('succeeds on DRAFT and calls audit', async () => {
      const sub = makeDraftSubmission();
      const updated = { ...sub, title: 'Updated Title' };
      mockService.getById.mockResolvedValueOnce(sub as never);
      mockService.update.mockResolvedValueOnce(updated as never);

      const ctx = orgContext();
      const caller = createCaller(ctx);
      const result = await caller.submissions.update({
        id: SUBMISSION_ID,
        title: 'Updated Title',
      });

      expect(result.title).toBe('Updated Title');
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBMISSION_UPDATED' }),
      );
    });

    it('throws BAD_REQUEST on non-DRAFT', async () => {
      const sub = makeDraftSubmission();
      mockService.getById.mockResolvedValueOnce(sub as never);
      const { NotDraftError } =
        await import('../../services/submission.service.js');
      mockService.update.mockRejectedValueOnce(new NotDraftError());

      const caller = createCaller(orgContext());
      await expect(
        caller.submissions.update({
          id: SUBMISSION_ID,
          title: 'Updated Title',
        }),
      ).rejects.toThrow('DRAFT');
    });
  });

  describe('submit', () => {
    it('DRAFT→SUBMITTED succeeds and calls audit', async () => {
      const sub = makeDraftSubmission();
      mockService.getById.mockResolvedValueOnce(sub as never);
      mockService.updateStatus.mockResolvedValueOnce({
        submission: { ...sub, status: 'SUBMITTED' },
        historyEntry: { id: 'h-1' },
      } as never);

      const ctx = orgContext();
      const caller = createCaller(ctx);
      const result = await caller.submissions.submit({ id: SUBMISSION_ID });

      expect(result.submission.status).toBe('SUBMITTED');
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBMISSION_SUBMITTED' }),
      );
    });

    it('throws BAD_REQUEST with unscanned files', async () => {
      const sub = makeDraftSubmission();
      mockService.getById.mockResolvedValueOnce(sub as never);
      const { UnscannedFilesError } =
        await import('../../services/submission.service.js');
      mockService.updateStatus.mockRejectedValueOnce(new UnscannedFilesError());

      const caller = createCaller(orgContext());
      await expect(
        caller.submissions.submit({ id: SUBMISSION_ID }),
      ).rejects.toThrow('pending or being scanned');
    });

    it('throws BAD_REQUEST with infected files', async () => {
      const sub = makeDraftSubmission();
      mockService.getById.mockResolvedValueOnce(sub as never);
      const { InfectedFilesError } =
        await import('../../services/submission.service.js');
      mockService.updateStatus.mockRejectedValueOnce(new InfectedFilesError());

      const caller = createCaller(orgContext());
      await expect(
        caller.submissions.submit({ id: SUBMISSION_ID }),
      ).rejects.toThrow('infected');
    });
  });

  describe('delete', () => {
    it('succeeds on DRAFT and calls audit', async () => {
      const sub = makeDraftSubmission();
      mockService.getById.mockResolvedValueOnce(sub as never);
      mockService.delete.mockResolvedValueOnce(sub as never);

      const ctx = orgContext();
      const caller = createCaller(ctx);
      const result = await caller.submissions.delete({ id: SUBMISSION_ID });

      expect(result).toEqual({ success: true });
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBMISSION_DELETED' }),
      );
    });

    it('throws BAD_REQUEST on non-DRAFT', async () => {
      const sub = makeDraftSubmission();
      mockService.getById.mockResolvedValueOnce(sub as never);
      const { NotDraftError } =
        await import('../../services/submission.service.js');
      mockService.delete.mockRejectedValueOnce(new NotDraftError());

      const caller = createCaller(orgContext());
      await expect(
        caller.submissions.delete({ id: SUBMISSION_ID }),
      ).rejects.toThrow('DRAFT');
    });
  });

  describe('withdraw', () => {
    it('succeeds from valid state and calls audit', async () => {
      const sub = { ...makeDraftSubmission(), status: 'SUBMITTED' as const };
      mockService.getById.mockResolvedValueOnce(sub as never);
      mockService.updateStatus.mockResolvedValueOnce({
        submission: { ...sub, status: 'WITHDRAWN' },
        historyEntry: { id: 'h-2' },
      } as never);

      const ctx = orgContext();
      const caller = createCaller(ctx);
      const result = await caller.submissions.withdraw({ id: SUBMISSION_ID });

      expect(result.submission.status).toBe('WITHDRAWN');
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBMISSION_WITHDRAWN' }),
      );
    });

    it('throws BAD_REQUEST from terminal state', async () => {
      const sub = { ...makeDraftSubmission(), status: 'ACCEPTED' as const };
      mockService.getById.mockResolvedValueOnce(sub as never);
      const { InvalidStatusTransitionError } =
        await import('../../services/submission.service.js');
      mockService.updateStatus.mockRejectedValueOnce(
        new InvalidStatusTransitionError('ACCEPTED', 'WITHDRAWN'),
      );

      const caller = createCaller(orgContext());
      await expect(
        caller.submissions.withdraw({ id: SUBMISSION_ID }),
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('updateStatus', () => {
    it('editor transition succeeds and calls audit', async () => {
      mockService.updateStatus.mockResolvedValueOnce({
        submission: { id: SUBMISSION_ID, status: 'UNDER_REVIEW' },
        historyEntry: { id: 'h-3' },
      } as never);

      const ctx = editorContext();
      const caller = createCaller(ctx);
      const result = await caller.submissions.updateStatus({
        id: SUBMISSION_ID,
        status: 'UNDER_REVIEW',
      });

      expect(result.submission.status).toBe('UNDER_REVIEW');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockService.updateStatus).toHaveBeenCalledWith(
        expect.anything(),
        SUBMISSION_ID,
        'UNDER_REVIEW',
        'user-1',
        undefined,
        'editor',
      );
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBMISSION_STATUS_CHANGED' }),
      );
    });

    it('throws NOT_FOUND when submission missing', async () => {
      const { SubmissionNotFoundError } =
        await import('../../services/submission.service.js');
      mockService.updateStatus.mockRejectedValueOnce(
        new SubmissionNotFoundError(SUBMISSION_ID),
      );

      const caller = createCaller(editorContext());
      await expect(
        caller.submissions.updateStatus({
          id: SUBMISSION_ID,
          status: 'UNDER_REVIEW',
        }),
      ).rejects.toThrow(TRPCError);
    });

    it('throws BAD_REQUEST on invalid transition', async () => {
      const { InvalidStatusTransitionError } =
        await import('../../services/submission.service.js');
      mockService.updateStatus.mockRejectedValueOnce(
        new InvalidStatusTransitionError('DRAFT', 'UNDER_REVIEW'),
      );

      const caller = createCaller(editorContext());
      await expect(
        caller.submissions.updateStatus({
          id: SUBMISSION_ID,
          status: 'UNDER_REVIEW',
        }),
      ).rejects.toThrow(TRPCError);
    });

    it('passes comment to service', async () => {
      mockService.updateStatus.mockResolvedValueOnce({
        submission: { id: SUBMISSION_ID, status: 'REJECTED' },
        historyEntry: { id: 'h-4' },
      } as never);

      const caller = createCaller(orgContext('ADMIN'));
      await caller.submissions.updateStatus({
        id: SUBMISSION_ID,
        status: 'REJECTED',
        comment: 'Not a good fit',
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockService.updateStatus).toHaveBeenCalledWith(
        expect.anything(),
        SUBMISSION_ID,
        'REJECTED',
        'user-1',
        'Not a good fit',
        'editor',
      );
    });
  });
});
