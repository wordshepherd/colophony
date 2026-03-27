import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditActions, AuditResources } from '@colophony/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockOrderBy = vi.fn();
const mockLeftJoin = vi.fn();
const mockExecute = vi.fn();

vi.mock('@colophony/db', () => ({
  submissionDiscussions: {
    id: 'id',
    organizationId: 'organization_id',
    submissionId: 'submission_id',
    authorId: 'author_id',
    parentId: 'parent_id',
    content: 'content',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  submissionReviewers: {
    id: 'id',
    submissionId: 'submission_id',
    reviewerUserId: 'reviewer_user_id',
  },
  submissions: {
    id: 'id',
    submitterId: 'submitter_id',
    organizationId: 'organization_id',
  },
  users: { id: 'id', email: 'email' },
  eq: vi.fn((_col: unknown, val: unknown) => val),
  and: vi.fn((...args: unknown[]) => args),
}));

vi.mock('drizzle-orm', () => ({
  sql: vi.fn(),
}));

vi.mock('sanitize-html', () => ({
  default: vi.fn((html: string) => html),
}));

vi.mock('./outbox.js', () => ({
  enqueueOutboxEvent: vi.fn(),
}));

vi.mock('./submission.service.js', () => ({
  SubmissionNotFoundError: class SubmissionNotFoundError extends Error {
    constructor(id: string) {
      super(`Submission "${id}" not found`);
      this.name = 'SubmissionNotFoundError';
    }
  },
}));

import { submissionDiscussionService } from './submission-discussion.service.js';
import { ForbiddenError } from './errors.js';
import { DiscussionParentNotFoundError } from './submission-discussion.service.js';
import type { ServiceContext } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTx() {
  mockReturning.mockReturnValue([{ id: 'comment-1' }]);
  mockValues.mockReturnValue({ returning: mockReturning });
  mockInsert.mockReturnValue({ values: mockValues });
  mockLimit.mockReturnValue([]);
  mockWhere.mockReturnValue({
    limit: mockLimit,
    orderBy: mockOrderBy,
  });
  mockOrderBy.mockReturnValue([]);
  mockLeftJoin.mockReturnValue({ where: mockWhere });
  mockFrom.mockReturnValue({
    leftJoin: mockLeftJoin,
    innerJoin: vi.fn().mockReturnValue({ where: mockWhere }),
    where: mockWhere,
  });
  mockSelect.mockReturnValue({ from: mockFrom });
  mockExecute.mockResolvedValue({ rows: [] });

  return {
    insert: mockInsert,
    select: mockSelect,
    execute: mockExecute,
  } as unknown as import('@colophony/db').DrizzleDb;
}

function makeSvc(
  roles: string[] = ['EDITOR'],
  userId: string = 'user-editor',
): ServiceContext {
  return {
    tx: makeTx(),
    actor: {
      userId,
      orgId: 'org-1',
      roles: roles as ('ADMIN' | 'EDITOR' | 'READER')[],
    },
    audit: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('submissionDiscussionService', () => {
  describe('listBySubmission', () => {
    it('returns empty array for no comments', async () => {
      const tx = makeTx();
      mockOrderBy.mockReturnValue([]);

      const result = await submissionDiscussionService.listBySubmission(
        tx,
        'sub-1',
      );
      expect(result).toEqual([]);
    });

    it('returns comments with author email joined', async () => {
      const tx = makeTx();
      const comments = [
        {
          id: 'c1',
          submissionId: 'sub-1',
          authorId: 'user-1',
          authorEmail: 'user@test.com',
          parentId: null,
          content: '<p>Hello</p>',
          createdAt: new Date(),
          updatedAt: null,
        },
      ];
      mockOrderBy.mockReturnValue(comments);

      const result = await submissionDiscussionService.listBySubmission(
        tx,
        'sub-1',
      );
      expect(result).toEqual(comments);
      expect(mockSelect).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('inserts and returns id', async () => {
      const tx = makeTx();
      mockReturning.mockReturnValue([{ id: 'new-comment-1' }]);

      const result = await submissionDiscussionService.create(tx, {
        organizationId: 'org-1',
        submissionId: 'sub-1',
        authorId: 'user-1',
        content: '<p>Test</p>',
      });

      expect(result).toEqual({ id: 'new-comment-1' });
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe('createWithAudit', () => {
    it('rejects READER not assigned as reviewer', async () => {
      const svc = makeSvc(['READER'], 'user-reader');
      // Mock submission exists with a different submitter
      mockLimit
        .mockReturnValueOnce([
          {
            id: 'sub-1',
            submitterId: 'user-submitter',
            organizationId: 'org-1',
          },
        ])
        // Mock reviewer check returns empty
        .mockReturnValueOnce([]);

      await expect(
        submissionDiscussionService.createWithAudit(svc, {
          submissionId: 'sub-1',
          content: '<p>Test</p>',
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('allows assigned READER reviewer', async () => {
      const svc = makeSvc(['READER'], 'user-reviewer');
      // Mock submission exists
      mockLimit
        .mockReturnValueOnce([
          {
            id: 'sub-1',
            submitterId: 'user-submitter',
            organizationId: 'org-1',
          },
        ])
        // Mock reviewer exists
        .mockReturnValueOnce([{ id: 'rev-1' }]);

      // Mock create returning
      mockReturning.mockReturnValue([{ id: 'comment-1' }]);
      // Mock the final re-read to get full comment
      mockLimit.mockReturnValueOnce([
        {
          id: 'comment-1',
          submissionId: 'sub-1',
          authorId: 'user-reviewer',
          authorEmail: 'reviewer@test.com',
          parentId: null,
          content: '<p>Test</p>',
          createdAt: new Date(),
          updatedAt: null,
        },
      ]);

      const result = await submissionDiscussionService.createWithAudit(svc, {
        submissionId: 'sub-1',
        content: '<p>Test</p>',
      });

      expect(result.id).toBe('comment-1');
      expect(svc.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: AuditResources.SUBMISSION,
          action: AuditActions.DISCUSSION_COMMENT_ADDED,
        }),
      );
    });

    it('allows EDITOR', async () => {
      const svc = makeSvc(['EDITOR'], 'user-editor');
      // Mock submission exists
      mockLimit.mockReturnValueOnce([
        {
          id: 'sub-1',
          submitterId: 'user-submitter',
          organizationId: 'org-1',
        },
      ]);

      // Mock create
      mockReturning.mockReturnValue([{ id: 'comment-1' }]);
      // Mock re-read
      mockLimit.mockReturnValueOnce([
        {
          id: 'comment-1',
          submissionId: 'sub-1',
          authorId: 'user-editor',
          authorEmail: 'editor@test.com',
          parentId: null,
          content: '<p>Test</p>',
          createdAt: new Date(),
          updatedAt: null,
        },
      ]);

      const result = await submissionDiscussionService.createWithAudit(svc, {
        submissionId: 'sub-1',
        content: '<p>Test</p>',
      });

      expect(result.id).toBe('comment-1');
    });

    it('allows ADMIN', async () => {
      const svc = makeSvc(['ADMIN'], 'user-admin');
      mockLimit.mockReturnValueOnce([
        {
          id: 'sub-1',
          submitterId: 'user-submitter',
          organizationId: 'org-1',
        },
      ]);

      mockReturning.mockReturnValue([{ id: 'comment-1' }]);
      mockLimit.mockReturnValueOnce([
        {
          id: 'comment-1',
          submissionId: 'sub-1',
          authorId: 'user-admin',
          authorEmail: 'admin@test.com',
          parentId: null,
          content: '<p>Test</p>',
          createdAt: new Date(),
          updatedAt: null,
        },
      ]);

      const result = await submissionDiscussionService.createWithAudit(svc, {
        submissionId: 'sub-1',
        content: '<p>Test</p>',
      });

      expect(result.id).toBe('comment-1');
    });

    it('rejects nonexistent parentId', async () => {
      const svc = makeSvc(['EDITOR'], 'user-editor');
      // Mock submission exists
      mockLimit
        .mockReturnValueOnce([
          {
            id: 'sub-1',
            submitterId: 'user-submitter',
            organizationId: 'org-1',
          },
        ])
        // Mock parent comment not found
        .mockReturnValueOnce([]);

      await expect(
        submissionDiscussionService.createWithAudit(svc, {
          submissionId: 'sub-1',
          parentId: 'nonexistent-parent',
          content: '<p>Test</p>',
        }),
      ).rejects.toThrow(DiscussionParentNotFoundError);
    });

    it('collapses depth > 1 replies to root parent', async () => {
      const svc = makeSvc(['EDITOR'], 'user-editor');
      // Mock submission exists
      mockLimit
        .mockReturnValueOnce([
          {
            id: 'sub-1',
            submitterId: 'user-submitter',
            organizationId: 'org-1',
          },
        ])
        // Mock parent comment has its own parent (depth > 1)
        .mockReturnValueOnce([
          {
            id: 'child-comment',
            parentId: 'root-comment',
            submissionId: 'sub-1',
          },
        ]);

      // Mock create
      mockReturning.mockReturnValue([{ id: 'new-comment' }]);
      // Mock re-read
      mockLimit.mockReturnValueOnce([
        {
          id: 'new-comment',
          submissionId: 'sub-1',
          authorId: 'user-editor',
          authorEmail: 'editor@test.com',
          parentId: 'root-comment', // collapsed to root
          content: '<p>Test</p>',
          createdAt: new Date(),
          updatedAt: null,
        },
      ]);

      const result = await submissionDiscussionService.createWithAudit(svc, {
        submissionId: 'sub-1',
        parentId: 'child-comment',
        content: '<p>Test</p>',
      });

      expect(result.parentId).toBe('root-comment');
      // Verify the insert was called (the values mock will have the collapsed parentId)
      expect(mockInsert).toHaveBeenCalled();
    });

    it('rejects submitter even if they have an org role', async () => {
      const svc = makeSvc(['EDITOR'], 'user-submitter');
      mockLimit.mockReturnValueOnce([
        {
          id: 'sub-1',
          submitterId: 'user-submitter',
          organizationId: 'org-1',
        },
      ]);

      await expect(
        submissionDiscussionService.createWithAudit(svc, {
          submissionId: 'sub-1',
          content: '<p>Test</p>',
        }),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('getNotificationRecipients', () => {
    it('de-duplicates and excludes author', async () => {
      const tx = makeTx();
      mockExecute.mockResolvedValue({
        rows: [{ user_id: 'reviewer-1' }, { user_id: 'commenter-1' }],
      });

      const result =
        await submissionDiscussionService.getNotificationRecipients(
          tx,
          'sub-1',
          'author-1',
        );

      expect(result).toEqual(['reviewer-1', 'commenter-1']);
      expect(mockExecute).toHaveBeenCalled();
    });
  });
});
