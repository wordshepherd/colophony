import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditActions, AuditResources } from '@colophony/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockDeleteFn = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
const mockSet = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockOrderBy = vi.fn();
const mockLeftJoin = vi.fn();

vi.mock('@colophony/db', () => ({
  submissionVotes: {
    id: 'id',
    organizationId: 'organization_id',
    submissionId: 'submission_id',
    voterUserId: 'voter_user_id',
    decision: 'decision',
    score: 'score',
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
    status: 'status',
  },
  organizations: { id: 'id', settings: 'settings' },
  users: { id: 'id', email: 'email' },
  eq: vi.fn((_col: unknown, val: unknown) => val),
  and: vi.fn((...args: unknown[]) => args),
}));

vi.mock('drizzle-orm', () => {
  const mockSql = vi.fn();
  return { sql: mockSql };
});

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

import { submissionVoteService } from './submission-vote.service.js';
import {
  VoteNotFoundError,
  VotingDisabledError,
  VoteOnTerminalSubmissionError,
  ScoreOutOfRangeError,
} from './submission-vote.service.js';
import { ForbiddenError } from './errors.js';
import { enqueueOutboxEvent } from './outbox.js';
import type { ServiceContext } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock DrizzleDb tx that returns sequential results on each
 * `select().from().where().limit()` chain call.
 */
function makeTx(selectResults: unknown[][]) {
  let callIndex = 0;

  const resetChain = () => {
    mockReturning.mockReturnValue([{ id: 'vote-1' }]);
    mockValues.mockReturnValue({ returning: mockReturning });
    mockInsert.mockReturnValue({ values: mockValues });

    mockSet.mockReturnValue({ where: mockWhere });
    mockUpdate.mockReturnValue({ set: mockSet });

    mockDeleteFn.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockImplementation(() => {
          // Use last selectResults entry for delete result
          const results = selectResults;
          // If there's a result that looks like a vote, return it
          return results.length > 0 ? results[results.length - 1] : [];
        }),
      }),
    });
  };

  mockLimit.mockImplementation(() => {
    const result = selectResults[callIndex] ?? [];
    callIndex++;
    return result;
  });

  mockWhere.mockReturnValue({
    limit: mockLimit,
    orderBy: mockOrderBy,
  });
  mockOrderBy.mockReturnValue([]);
  mockLeftJoin.mockReturnValue({ where: mockWhere });
  mockFrom.mockReturnValue({
    leftJoin: mockLeftJoin,
    where: mockWhere,
  });
  mockSelect.mockReturnValue({ from: mockFrom });

  resetChain();

  return {
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
    delete: mockDeleteFn,
  } as unknown as import('@colophony/db').DrizzleDb;
}

const VOTE_ROW = {
  id: 'vote-1',
  submissionId: 'sub-1',
  voterUserId: 'user-editor',
  voterEmail: 'editor@test.com',
  decision: 'ACCEPT',
  score: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const SUB_ROW = {
  id: 'sub-1',
  submitterId: 'user-submitter',
  organizationId: 'org-1',
  status: 'UNDER_REVIEW',
};

const ORG_ROW_VOTING_ON = {
  settings: {
    votingEnabled: true,
    scoringEnabled: false,
    scoreMin: 1,
    scoreMax: 10,
  },
};

const ORG_ROW_SCORING_ON = {
  settings: {
    votingEnabled: true,
    scoringEnabled: true,
    scoreMin: 1,
    scoreMax: 10,
  },
};

const ORG_ROW_VOTING_OFF = {
  settings: {
    votingEnabled: false,
    scoringEnabled: false,
    scoreMin: 1,
    scoreMax: 10,
  },
};

function makeSvc(
  role: string,
  userId: string,
  selectResults: unknown[][],
): ServiceContext {
  return {
    tx: makeTx(selectResults),
    actor: {
      userId,
      orgId: 'org-1',
      role: role as 'ADMIN' | 'EDITOR' | 'READER',
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

describe('submissionVoteService', () => {
  describe('castVoteWithAudit', () => {
    it('cast vote succeeds for EDITOR', async () => {
      // Call sequence: getSubmission, resolveVotingConfig, existingVote(select), returnVote
      const svc = makeSvc('EDITOR', 'user-editor', [
        [SUB_ROW], // getSubmissionOrThrow
        [ORG_ROW_VOTING_ON], // resolveVotingConfig
        [], // upsert: check existing vote
        [VOTE_ROW], // return full vote
      ]);

      const result = await submissionVoteService.castVoteWithAudit(svc, {
        submissionId: 'sub-1',
        decision: 'ACCEPT',
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('vote-1');
      expect(svc.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: AuditResources.SUBMISSION,
          action: AuditActions.SUBMISSION_VOTE_CAST,
          resourceId: 'sub-1',
        }),
      );
      expect(enqueueOutboxEvent).toHaveBeenCalledWith(
        expect.anything(),
        'hopper/vote.cast',
        expect.objectContaining({ submissionId: 'sub-1' }),
      );
    });

    it('cast vote succeeds for assigned READER', async () => {
      const svc = makeSvc('READER', 'user-reader', [
        [SUB_ROW], // getSubmissionOrThrow
        [{ id: 'reviewer-1' }], // assertEditorAdminOrReviewer: reviewer lookup
        [ORG_ROW_VOTING_ON], // resolveVotingConfig
        [], // upsert: check existing vote
        [VOTE_ROW], // return full vote
      ]);

      const result = await submissionVoteService.castVoteWithAudit(svc, {
        submissionId: 'sub-1',
        decision: 'MAYBE',
      });

      expect(result).toBeDefined();
    });

    it('cast vote rejected for non-assigned READER', async () => {
      const svc = makeSvc('READER', 'user-reader', [
        [SUB_ROW], // getSubmissionOrThrow
        [], // assertEditorAdminOrReviewer: reviewer lookup (empty)
      ]);

      await expect(
        submissionVoteService.castVoteWithAudit(svc, {
          submissionId: 'sub-1',
          decision: 'ACCEPT',
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('cast vote rejected for submitter', async () => {
      const svc = makeSvc('EDITOR', 'user-submitter', [
        [SUB_ROW], // getSubmissionOrThrow
      ]);

      await expect(
        submissionVoteService.castVoteWithAudit(svc, {
          submissionId: 'sub-1',
          decision: 'ACCEPT',
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('cast vote rejected when voting disabled', async () => {
      const svc = makeSvc('EDITOR', 'user-editor', [
        [SUB_ROW], // getSubmissionOrThrow
        [ORG_ROW_VOTING_OFF], // resolveVotingConfig
      ]);

      await expect(
        submissionVoteService.castVoteWithAudit(svc, {
          submissionId: 'sub-1',
          decision: 'ACCEPT',
        }),
      ).rejects.toThrow(VotingDisabledError);
    });

    it('cast vote rejected on ACCEPTED submission', async () => {
      const svc = makeSvc('EDITOR', 'user-editor', [
        [{ ...SUB_ROW, status: 'ACCEPTED' }],
      ]);

      await expect(
        submissionVoteService.castVoteWithAudit(svc, {
          submissionId: 'sub-1',
          decision: 'ACCEPT',
        }),
      ).rejects.toThrow(VoteOnTerminalSubmissionError);
    });

    it('cast vote rejected on REJECTED submission', async () => {
      const svc = makeSvc('EDITOR', 'user-editor', [
        [{ ...SUB_ROW, status: 'REJECTED' }],
      ]);

      await expect(
        submissionVoteService.castVoteWithAudit(svc, {
          submissionId: 'sub-1',
          decision: 'REJECT',
        }),
      ).rejects.toThrow(VoteOnTerminalSubmissionError);
    });

    it('cast vote rejected on WITHDRAWN submission', async () => {
      const svc = makeSvc('EDITOR', 'user-editor', [
        [{ ...SUB_ROW, status: 'WITHDRAWN' }],
      ]);

      await expect(
        submissionVoteService.castVoteWithAudit(svc, {
          submissionId: 'sub-1',
          decision: 'ACCEPT',
        }),
      ).rejects.toThrow(VoteOnTerminalSubmissionError);
    });

    it('upsert updates existing vote, audits UPDATED', async () => {
      const svc = makeSvc('EDITOR', 'user-editor', [
        [SUB_ROW], // getSubmissionOrThrow
        [ORG_ROW_VOTING_ON], // resolveVotingConfig
        [{ id: 'existing-vote-1' }], // upsert: check existing vote (found)
        [VOTE_ROW], // return full vote
      ]);

      const result = await submissionVoteService.castVoteWithAudit(svc, {
        submissionId: 'sub-1',
        decision: 'REJECT',
      });

      expect(result).toBeDefined();
      expect(svc.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditActions.SUBMISSION_VOTE_UPDATED,
        }),
      );
    });

    it('score rejected when out of range', async () => {
      const svc = makeSvc('EDITOR', 'user-editor', [
        [SUB_ROW], // getSubmissionOrThrow
        [ORG_ROW_SCORING_ON], // resolveVotingConfig
      ]);

      await expect(
        submissionVoteService.castVoteWithAudit(svc, {
          submissionId: 'sub-1',
          decision: 'ACCEPT',
          score: 11,
        }),
      ).rejects.toThrow(ScoreOutOfRangeError);
    });

    it('score ignored when scoring disabled', async () => {
      const svc = makeSvc('EDITOR', 'user-editor', [
        [SUB_ROW], // getSubmissionOrThrow
        [ORG_ROW_VOTING_ON], // resolveVotingConfig (scoringEnabled: false)
        [], // upsert: no existing vote
        [VOTE_ROW], // return full vote
      ]);

      const result = await submissionVoteService.castVoteWithAudit(svc, {
        submissionId: 'sub-1',
        decision: 'ACCEPT',
        score: 5,
      });

      expect(result).toBeDefined();
    });

    it('score accepted within range', async () => {
      const svc = makeSvc('EDITOR', 'user-editor', [
        [SUB_ROW], // getSubmissionOrThrow
        [ORG_ROW_SCORING_ON], // resolveVotingConfig
        [], // upsert: no existing vote
        [VOTE_ROW], // return full vote
      ]);

      const result = await submissionVoteService.castVoteWithAudit(svc, {
        submissionId: 'sub-1',
        decision: 'ACCEPT',
        score: 7,
      });

      expect(result).toBeDefined();
    });
  });

  describe('deleteVoteWithAudit', () => {
    it('delete vote succeeds for own vote', async () => {
      const svc = makeSvc('EDITOR', 'user-editor', [
        [SUB_ROW], // getSubmissionOrThrow
      ]);

      // Mock delete to return a result (vote was found and deleted)
      mockDeleteFn.mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue([{ id: 'vote-1' }]),
        }),
      });

      const result = await submissionVoteService.deleteVoteWithAudit(
        svc,
        'sub-1',
      );

      expect(result).toEqual({ success: true });
      expect(svc.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditActions.SUBMISSION_VOTE_DELETED,
          resourceId: 'sub-1',
        }),
      );
    });

    it('delete vote fails when no vote exists', async () => {
      const svc = makeSvc('EDITOR', 'user-editor', [
        [SUB_ROW], // getSubmissionOrThrow
      ]);

      // Mock delete to return empty (no vote found)
      mockDeleteFn.mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue([]),
        }),
      });

      await expect(
        submissionVoteService.deleteVoteWithAudit(svc, 'sub-1'),
      ).rejects.toThrow(VoteNotFoundError);
    });
  });

  describe('getVoteSummaryWithAccess', () => {
    it('vote summary rejected for READER', async () => {
      const svc = makeSvc('READER', 'user-reader', []);

      await expect(
        submissionVoteService.getVoteSummaryWithAccess(svc, 'sub-1'),
      ).rejects.toThrow(ForbiddenError);
    });
  });
});
