import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ServiceContext } from './types.js';
import { ForbiddenError } from './errors.js';

// We need to spy on the "inner" methods (getById, create, etc.) that the
// "outer" access-aware methods delegate to. Vitest's vi.mock auto-mocks
// replace the entire module with vi.fn() stubs, but since the outer methods
// call inner methods on the *same* object, we can't use vi.mock. Instead we
// use vi.spyOn after importing the real module.

// Mock @colophony/db
vi.mock('@colophony/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
  submissions: {},
  submissionFiles: {},
  submissionHistory: {},
  submissionPeriods: {},
  formDefinitions: {},
  users: { migratedAt: 'migratedAt' },
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

vi.mock('./migration.service.js', () => ({
  MigrationInvalidStateError: class MigrationInvalidStateError extends Error {
    override name = 'MigrationInvalidStateError' as const;
  },
}));

// Mock form.service.js (imported by submission.service.ts)
vi.mock('./form.service.js', () => ({
  formService: { validateFormData: vi.fn() },
  FormNotFoundError: class extends Error {
    override name = 'FormNotFoundError';
  },
  FormNotPublishedError: class extends Error {
    override name = 'FormNotPublishedError';
  },
  InvalidFormDataError: class extends Error {
    override name = 'InvalidFormDataError';
  },
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  desc: vi.fn(),
  asc: vi.fn(),
  ilike: vi.fn(),
  count: vi.fn(),
}));

// Mock outbox (used by submitAsOwner, withdrawAsOwner, updateStatusAsEditor)
vi.mock('./outbox.js', () => ({
  enqueueOutboxEvent: vi.fn(),
}));

// Mock @colophony/types — provide status transition functions
vi.mock('@colophony/types', () => ({
  isValidStatusTransition: vi.fn(() => true),
  isEditorAllowedTransition: vi.fn(() => true),
  AuditActions: {
    SUBMISSION_CREATED: 'SUBMISSION_CREATED',
    SUBMISSION_UPDATED: 'SUBMISSION_UPDATED',
    SUBMISSION_SUBMITTED: 'SUBMISSION_SUBMITTED',
    SUBMISSION_STATUS_CHANGED: 'SUBMISSION_STATUS_CHANGED',
    SUBMISSION_DELETED: 'SUBMISSION_DELETED',
    SUBMISSION_WITHDRAWN: 'SUBMISSION_WITHDRAWN',
  },
  AuditResources: {
    SUBMISSION: 'submission',
  },
}));

import {
  submissionService,
  SubmissionNotFoundError,
} from './submission.service.js';

function makeSvc(overrides: Partial<ServiceContext> = {}): ServiceContext {
  return {
    tx: {} as never,
    actor: { userId: 'user-1', orgId: 'org-1', role: 'READER' },
    audit: vi.fn(),
    ...overrides,
  };
}

const SUBMISSION_ID = 'a1111111-1111-1111-a111-111111111111';

function makeSubmission(submitterId = 'user-1') {
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

// Use spyOn with eslint-disable for the unbound-method rule.
// These spies intercept the inner methods so the outer access-aware methods
// don't hit real DB calls.
function setupSpies() {
  vi.spyOn(submissionService, 'getById');
  vi.spyOn(submissionService, 'create');
  vi.spyOn(submissionService, 'update');
  vi.spyOn(submissionService, 'updateStatus');
  vi.spyOn(submissionService, 'delete');
  vi.spyOn(submissionService, 'getHistory');
}

describe('submissionService access-aware methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSpies();
  });

  describe('getByIdWithAccess', () => {
    it('returns submission for owner', async () => {
      const sub = makeSubmission('user-1');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(submissionService.getById).mockResolvedValueOnce(sub as never);

      const svc = makeSvc();
      const result = await submissionService.getByIdWithAccess(
        svc,
        SUBMISSION_ID,
      );
      expect(result.id).toBe(SUBMISSION_ID);
    });

    it('returns submission for EDITOR viewing others', async () => {
      const sub = makeSubmission('other-user');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(submissionService.getById).mockResolvedValueOnce(sub as never);

      const svc = makeSvc({
        actor: { userId: 'user-1', orgId: 'org-1', role: 'EDITOR' },
      });
      const result = await submissionService.getByIdWithAccess(
        svc,
        SUBMISSION_ID,
      );
      expect(result.id).toBe(SUBMISSION_ID);
    });

    it('throws ForbiddenError when READER views others', async () => {
      const sub = makeSubmission('other-user');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(submissionService.getById).mockResolvedValueOnce(sub as never);

      const svc = makeSvc();
      await expect(
        submissionService.getByIdWithAccess(svc, SUBMISSION_ID),
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws SubmissionNotFoundError when not found', async () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(submissionService.getById).mockResolvedValueOnce(null as never);

      const svc = makeSvc();
      await expect(
        submissionService.getByIdWithAccess(svc, SUBMISSION_ID),
      ).rejects.toThrow(SubmissionNotFoundError);
    });
  });

  describe('createWithAudit', () => {
    it('calls create and audit', async () => {
      const sub = makeSubmission();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(submissionService.create).mockResolvedValueOnce(sub as never);

      const svc = makeSvc();
      const result = await submissionService.createWithAudit(svc, {
        title: 'Test',
      });

      expect(result.id).toBe(SUBMISSION_ID);
      expect(svc.audit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBMISSION_CREATED' }),
      );
    });
  });

  describe('updateAsOwner', () => {
    it('updates and audits for owner', async () => {
      const sub = makeSubmission('user-1');
      const updated = { ...sub, title: 'Updated' };
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(submissionService.getById).mockResolvedValueOnce(sub as never);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(submissionService.update).mockResolvedValueOnce(
        updated as never,
      );

      const svc = makeSvc();
      const result = await submissionService.updateAsOwner(svc, SUBMISSION_ID, {
        title: 'Updated',
      });

      expect(result.title).toBe('Updated');
      expect(svc.audit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBMISSION_UPDATED' }),
      );
    });

    it('throws ForbiddenError for non-owner', async () => {
      const sub = makeSubmission('other-user');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(submissionService.getById).mockResolvedValueOnce(sub as never);

      const svc = makeSvc();
      await expect(
        submissionService.updateAsOwner(svc, SUBMISSION_ID, {
          title: 'Updated',
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws SubmissionNotFoundError when not found', async () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(submissionService.getById).mockResolvedValueOnce(null as never);

      const svc = makeSvc();
      await expect(
        submissionService.updateAsOwner(svc, SUBMISSION_ID, {
          title: 'Updated',
        }),
      ).rejects.toThrow(SubmissionNotFoundError);
    });
  });

  describe('deleteAsOwner', () => {
    it('deletes and audits for owner', async () => {
      const sub = makeSubmission('user-1');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(submissionService.getById).mockResolvedValueOnce(sub as never);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(submissionService.delete).mockResolvedValueOnce(sub as never);

      const svc = makeSvc();
      const result = await submissionService.deleteAsOwner(svc, SUBMISSION_ID);

      expect(result).toEqual({ success: true });
      expect(svc.audit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBMISSION_DELETED' }),
      );
    });

    it('throws ForbiddenError for non-owner', async () => {
      const sub = makeSubmission('other-user');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(submissionService.getById).mockResolvedValueOnce(sub as never);

      const svc = makeSvc();
      await expect(
        submissionService.deleteAsOwner(svc, SUBMISSION_ID),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('submitAsOwner', () => {
    it('submits and audits for owner', async () => {
      const sub = makeSubmission('user-1');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(submissionService.getById).mockResolvedValueOnce(sub as never);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(submissionService.updateStatus).mockResolvedValueOnce({
        submission: { ...sub, status: 'SUBMITTED' },
        historyEntry: { id: 'h-1' },
      } as never);

      const svc = makeSvc();
      const result = await submissionService.submitAsOwner(svc, SUBMISSION_ID);

      expect(result.submission.status).toBe('SUBMITTED');
      expect(svc.audit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBMISSION_SUBMITTED' }),
      );
    });

    it('throws ForbiddenError for non-owner', async () => {
      const sub = makeSubmission('other-user');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(submissionService.getById).mockResolvedValueOnce(sub as never);

      const svc = makeSvc();
      await expect(
        submissionService.submitAsOwner(svc, SUBMISSION_ID),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('withdrawAsOwner', () => {
    it('withdraws and audits for owner', async () => {
      const sub = makeSubmission('user-1');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(submissionService.getById).mockResolvedValueOnce(sub as never);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(submissionService.updateStatus).mockResolvedValueOnce({
        submission: { ...sub, status: 'WITHDRAWN' },
        historyEntry: { id: 'h-2' },
      } as never);

      const svc = makeSvc();
      const result = await submissionService.withdrawAsOwner(
        svc,
        SUBMISSION_ID,
      );

      expect(result.submission.status).toBe('WITHDRAWN');
      expect(svc.audit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBMISSION_WITHDRAWN' }),
      );
    });
  });

  describe('updateStatusAsEditor', () => {
    it('updates status and audits for editor', async () => {
      const sub = makeSubmission('user-1');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(submissionService.getById).mockResolvedValueOnce(sub as never);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(submissionService.updateStatus).mockResolvedValueOnce({
        submission: { id: SUBMISSION_ID, status: 'UNDER_REVIEW' },
        historyEntry: { id: 'h-3' },
      } as never);

      const svc = makeSvc({
        actor: { userId: 'user-1', orgId: 'org-1', role: 'EDITOR' },
      });
      const result = await submissionService.updateStatusAsEditor(
        svc,
        SUBMISSION_ID,
        'UNDER_REVIEW' as never,
        undefined,
      );

      expect(result.submission.status).toBe('UNDER_REVIEW');
      expect(svc.audit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBMISSION_STATUS_CHANGED' }),
      );
    });

    it('throws ForbiddenError for READER', async () => {
      const svc = makeSvc();
      await expect(
        submissionService.updateStatusAsEditor(
          svc,
          SUBMISSION_ID,
          'UNDER_REVIEW' as never,
          undefined,
        ),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('getHistoryWithAccess', () => {
    it('returns history for owner', async () => {
      const sub = makeSubmission('user-1');
      const history = [{ id: 'h-1', toStatus: 'DRAFT' }];
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(submissionService.getById).mockResolvedValueOnce(sub as never);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(submissionService.getHistory).mockResolvedValueOnce(
        history as never,
      );

      const svc = makeSvc();
      const result = await submissionService.getHistoryWithAccess(
        svc,
        SUBMISSION_ID,
      );
      expect(result).toHaveLength(1);
    });

    it('throws ForbiddenError when READER views others history', async () => {
      const sub = makeSubmission('other-user');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(submissionService.getById).mockResolvedValueOnce(sub as never);

      const svc = makeSvc();
      await expect(
        submissionService.getHistoryWithAccess(svc, SUBMISSION_ID),
      ).rejects.toThrow(ForbiddenError);
    });
  });
});
