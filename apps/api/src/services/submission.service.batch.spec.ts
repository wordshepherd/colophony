import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ServiceContext } from './types.js';
import { ForbiddenError } from './errors.js';

// Mock @colophony/db
vi.mock('@colophony/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
  submissions: { id: 'id', status: 'status' },
  submissionHistory: {},
  submissionPeriods: {},
  formDefinitions: {},
  files: {},
  manuscriptVersions: {},
  manuscripts: {},
  users: { migratedAt: 'migratedAt' },
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  })),
}));

vi.mock('./migration.service.js', () => ({
  MigrationInvalidStateError: class MigrationInvalidStateError extends Error {
    override name = 'MigrationInvalidStateError' as const;
  },
}));

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

vi.mock('drizzle-orm', () => ({
  desc: vi.fn(),
  asc: vi.fn(),
  ilike: vi.fn(),
  count: vi.fn(),
}));

vi.mock('./outbox.js', () => ({
  enqueueOutboxEvent: vi.fn(),
}));

vi.mock('./blind-review.helper.js', () => ({
  resolveBlindMode: vi.fn().mockResolvedValue('none'),
  applySubmitterBlinding: vi.fn((item: unknown) => item),
}));

// Mock the reviewer service
const mockAssign = vi.fn();
const mockValidateOrgMembership = vi.fn();
vi.mock('./submission-reviewer.service.js', () => ({
  submissionReviewerService: {
    assign: (...args: unknown[]) => mockAssign(...args),
    validateOrgMembership: (...args: unknown[]) =>
      mockValidateOrgMembership(...args),
  },
  ReviewerAlreadyAssignedError: class ReviewerAlreadyAssignedError extends Error {
    override name = 'ReviewerAlreadyAssignedError' as const;
    constructor(reviewerUserId: string) {
      super(`Reviewer "${reviewerUserId}" is already assigned`);
    }
  },
  ReviewerNotOrgMemberError: class ReviewerNotOrgMemberError extends Error {
    override name = 'ReviewerNotOrgMemberError' as const;
    constructor(reviewerUserId: string) {
      super(`User "${reviewerUserId}" is not a member of this organization`);
    }
  },
}));

vi.mock('@colophony/types', () => ({
  isValidStatusTransition: vi.fn(() => true),
  isEditorAllowedTransition: vi.fn(),
  shouldBlindSubmitter: vi.fn(() => false),
  shouldBlindPeerIdentity: vi.fn(() => false),
  AuditActions: {
    SUBMISSION_CREATED: 'SUBMISSION_CREATED',
    SUBMISSION_UPDATED: 'SUBMISSION_UPDATED',
    SUBMISSION_SUBMITTED: 'SUBMISSION_SUBMITTED',
    SUBMISSION_STATUS_CHANGED: 'SUBMISSION_STATUS_CHANGED',
    SUBMISSION_DELETED: 'SUBMISSION_DELETED',
    SUBMISSION_WITHDRAWN: 'SUBMISSION_WITHDRAWN',
    REVIEWER_ASSIGNED: 'REVIEWER_ASSIGNED',
  },
  AuditResources: {
    SUBMISSION: 'submission',
  },
}));

import { isEditorAllowedTransition } from '@colophony/types';
import { enqueueOutboxEvent } from './outbox.js';
import {
  submissionService,
  MissingRevisionNotesError,
} from './submission.service.js';
import { ReviewerNotOrgMemberError } from './submission-reviewer.service.js';

const SUB_1 = 'a1111111-1111-1111-a111-111111111111';
const SUB_2 = 'a2222222-2222-2222-a222-222222222222';
const SUB_3 = 'a3333333-3333-3333-a333-333333333333';
const REVIEWER_1 = 'r1111111-1111-1111-r111-111111111111';
const REVIEWER_2 = 'r2222222-2222-2222-r222-222222222222';

function makeTx() {
  const tx = {
    execute: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    for: vi.fn(),
  };
  return tx;
}

function makeSvc(
  overrides: Partial<ServiceContext> = {},
): ServiceContext & { tx: ReturnType<typeof makeTx> } {
  const tx = makeTx();
  return {
    tx: tx as never,
    actor: { userId: 'user-1', orgId: 'org-1', roles: ['EDITOR'] },
    audit: vi.fn(),
    ...overrides,
  } as ServiceContext & { tx: ReturnType<typeof makeTx> };
}

describe('submissionService batch operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── batchUpdateStatusAsEditor ───

  describe('batchUpdateStatusAsEditor', () => {
    it('rejects non-editor role', async () => {
      const svc = makeSvc({
        actor: { userId: 'user-1', orgId: 'org-1', roles: ['READER'] },
      });

      await expect(
        submissionService.batchUpdateStatusAsEditor(svc, {
          submissionIds: [SUB_1],
          status: 'UNDER_REVIEW',
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('rejects R&R without comment', async () => {
      const svc = makeSvc();

      await expect(
        submissionService.batchUpdateStatusAsEditor(svc, {
          submissionIds: [SUB_1],
          status: 'REVISE_AND_RESUBMIT',
        }),
      ).rejects.toThrow(MissingRevisionNotesError);
    });

    it('succeeds for all valid submissions', async () => {
      vi.mocked(isEditorAllowedTransition).mockReturnValue(true);

      const svc = makeSvc();
      svc.tx.for.mockResolvedValueOnce([
        { id: SUB_1, status: 'SUBMITTED', submitterId: 'submitter-1' },
        { id: SUB_2, status: 'SUBMITTED', submitterId: 'submitter-2' },
        { id: SUB_3, status: 'SUBMITTED', submitterId: 'submitter-3' },
      ]);

      const result = await submissionService.batchUpdateStatusAsEditor(svc, {
        submissionIds: [SUB_1, SUB_2, SUB_3],
        status: 'UNDER_REVIEW',
      });

      expect(result.succeeded).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(svc.audit).toHaveBeenCalledTimes(3);
    });

    it('handles partial failure: invalid transitions', async () => {
      vi.mocked(isEditorAllowedTransition).mockImplementation(
        (from: string) => from === 'SUBMITTED',
      );

      const svc = makeSvc();
      svc.tx.for.mockResolvedValueOnce([
        { id: SUB_1, status: 'SUBMITTED', submitterId: 'submitter-1' },
        { id: SUB_2, status: 'SUBMITTED', submitterId: 'submitter-2' },
        { id: SUB_3, status: 'ACCEPTED', submitterId: 'submitter-3' },
      ]);

      const result = await submissionService.batchUpdateStatusAsEditor(svc, {
        submissionIds: [SUB_1, SUB_2, SUB_3],
        status: 'UNDER_REVIEW',
      });

      expect(result.succeeded).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].submissionId).toBe(SUB_3);
      expect(result.failed[0].error).toContain('Invalid transition');
    });

    it('handles missing submissions', async () => {
      vi.mocked(isEditorAllowedTransition).mockReturnValue(true);

      const svc = makeSvc();
      svc.tx.for.mockResolvedValueOnce([
        { id: SUB_1, status: 'SUBMITTED', submitterId: 'submitter-1' },
        { id: SUB_2, status: 'SUBMITTED', submitterId: 'submitter-2' },
      ]);

      const result = await submissionService.batchUpdateStatusAsEditor(svc, {
        submissionIds: [SUB_1, SUB_2, SUB_3],
        status: 'UNDER_REVIEW',
      });

      expect(result.succeeded).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].submissionId).toBe(SUB_3);
      expect(result.failed[0].error).toBe('Submission not found');
    });

    it('enqueues outbox events for REJECTED', async () => {
      vi.mocked(isEditorAllowedTransition).mockReturnValue(true);

      const svc = makeSvc();
      svc.tx.for.mockResolvedValueOnce([
        { id: SUB_1, status: 'SUBMITTED', submitterId: 'submitter-1' },
        { id: SUB_2, status: 'SUBMITTED', submitterId: 'submitter-2' },
      ]);

      await submissionService.batchUpdateStatusAsEditor(svc, {
        submissionIds: [SUB_1, SUB_2],
        status: 'REJECTED',
      });

      expect(enqueueOutboxEvent).toHaveBeenCalledTimes(2);
      expect(enqueueOutboxEvent).toHaveBeenCalledWith(
        expect.anything(),
        'hopper/submission.rejected',
        expect.objectContaining({ submissionId: SUB_1 }),
      );
      expect(enqueueOutboxEvent).toHaveBeenCalledWith(
        expect.anything(),
        'hopper/submission.rejected',
        expect.objectContaining({ submissionId: SUB_2 }),
      );
    });

    it('enqueues outbox events for ACCEPTED', async () => {
      vi.mocked(isEditorAllowedTransition).mockReturnValue(true);

      const svc = makeSvc();
      svc.tx.for.mockResolvedValueOnce([
        {
          id: SUB_1,
          status: 'UNDER_REVIEW',
          submitterId: 'submitter-1',
        },
        {
          id: SUB_2,
          status: 'UNDER_REVIEW',
          submitterId: 'submitter-2',
        },
      ]);

      await submissionService.batchUpdateStatusAsEditor(svc, {
        submissionIds: [SUB_1, SUB_2],
        status: 'ACCEPTED',
      });

      expect(enqueueOutboxEvent).toHaveBeenCalledTimes(2);
      expect(enqueueOutboxEvent).toHaveBeenCalledWith(
        expect.anything(),
        'hopper/submission.accepted',
        expect.objectContaining({ submissionId: SUB_1 }),
      );
    });
  });

  // ─── batchAssignReviewersAsEditor ───

  describe('batchAssignReviewersAsEditor', () => {
    it('rejects non-editor role', async () => {
      const svc = makeSvc({
        actor: { userId: 'user-1', orgId: 'org-1', roles: ['READER'] },
      });

      await expect(
        submissionService.batchAssignReviewersAsEditor(svc, {
          submissionIds: [SUB_1],
          reviewerUserIds: [REVIEWER_1],
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('fails fast if reviewer not org member', async () => {
      mockValidateOrgMembership.mockRejectedValueOnce(
        new ReviewerNotOrgMemberError(REVIEWER_1),
      );

      const svc = makeSvc();

      await expect(
        submissionService.batchAssignReviewersAsEditor(svc, {
          submissionIds: [SUB_1],
          reviewerUserIds: [REVIEWER_1],
        }),
      ).rejects.toThrow(ReviewerNotOrgMemberError);
    });

    it('assigns to all valid submissions', async () => {
      mockValidateOrgMembership.mockResolvedValueOnce(undefined);
      mockAssign.mockResolvedValue({
        id: 'rev-1',
        submissionId: '',
        reviewerUserId: '',
        assignedBy: 'user-1',
        assignedAt: new Date(),
        readAt: null,
      });

      const svc = makeSvc();
      // Mock select().from().where() chain for finding submissions
      svc.tx.where.mockResolvedValueOnce([{ id: SUB_1 }, { id: SUB_2 }]);

      const result = await submissionService.batchAssignReviewersAsEditor(svc, {
        submissionIds: [SUB_1, SUB_2],
        reviewerUserIds: [REVIEWER_1, REVIEWER_2],
      });

      expect(result.succeeded).toHaveLength(2);
      expect(result.succeeded[0].assignedCount).toBe(2);
      expect(result.succeeded[1].assignedCount).toBe(2);
      expect(result.failed).toHaveLength(0);
    });

    it('reports not-found as failed', async () => {
      mockValidateOrgMembership.mockResolvedValueOnce(undefined);
      mockAssign.mockResolvedValue({
        id: 'rev-1',
        submissionId: '',
        reviewerUserId: '',
        assignedBy: 'user-1',
        assignedAt: new Date(),
        readAt: null,
      });

      const svc = makeSvc();
      svc.tx.where.mockResolvedValueOnce([{ id: SUB_1 }, { id: SUB_2 }]);

      const result = await submissionService.batchAssignReviewersAsEditor(svc, {
        submissionIds: [SUB_1, SUB_2, SUB_3],
        reviewerUserIds: [REVIEWER_1],
      });

      expect(result.succeeded).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].submissionId).toBe(SUB_3);
      expect(result.failed[0].error).toBe('Submission not found');
    });
  });
});
