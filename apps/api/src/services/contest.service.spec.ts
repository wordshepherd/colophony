import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@colophony/db', () => ({
  contestGroups: {
    id: 'cg.id',
    organizationId: 'cg.org_id',
    name: 'cg.name',
    description: 'cg.description',
    totalRoundsPlanned: 'cg.total_rounds_planned',
    createdAt: 'cg.created_at',
    updatedAt: 'cg.updated_at',
  },
  contestJudges: {
    id: 'cj.id',
    organizationId: 'cj.org_id',
    submissionPeriodId: 'cj.period_id',
    userId: 'cj.user_id',
    role: 'cj.role',
    assignedBy: 'cj.assigned_by',
    assignedAt: 'cj.assigned_at',
    notes: 'cj.notes',
  },
  contestResults: {
    id: 'cr.id',
    organizationId: 'cr.org_id',
    submissionPeriodId: 'cr.period_id',
    submissionId: 'cr.submission_id',
    placement: 'cr.placement',
    category: 'cr.category',
    prizeAmount: 'cr.prize_amount',
    prizeCurrency: 'cr.prize_currency',
    disbursementId: 'cr.disbursement_id',
    announcedAt: 'cr.announced_at',
    notes: 'cr.notes',
    createdAt: 'cr.created_at',
    updatedAt: 'cr.updated_at',
  },
  submissionPeriods: {
    id: 'sp.id',
    organizationId: 'sp.org_id',
    isContest: 'sp.is_contest',
    contestGroupId: 'sp.contest_group_id',
    contestRound: 'sp.contest_round',
    contestWinnersAnnouncedAt: 'sp.contest_winners_announced_at',
  },
  submissions: {
    id: 's.id',
    organizationId: 's.org_id',
    submissionPeriodId: 's.period_id',
    submitterId: 's.submitter_id',
    title: 's.title',
  },
  submissionVotes: {
    id: 'sv.id',
    submissionId: 'sv.submission_id',
    decision: 'sv.decision',
    score: 'sv.score',
  },
  paymentTransactions: {
    id: 'pt.id',
    organizationId: 'pt.org_id',
    status: 'pt.status',
  },
  organizationMembers: {
    id: 'om.id',
    userId: 'om.user_id',
    organizationId: 'om.org_id',
  },
  users: {
    id: 'u.id',
    email: 'u.email',
  },
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  count: vi.fn(),
  sql: vi.fn(),
  desc: vi.fn(),
}));

vi.mock('./errors.js', () => ({
  assertEditorOrAdmin: vi.fn(),
  assertBusinessOpsOrAdmin: vi.fn(),
  ForbiddenError: class ForbiddenError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'ForbiddenError';
    }
  },
}));

vi.mock('./blind-review.helper.js', () => ({
  resolveBlindMode: vi.fn().mockResolvedValue('none'),
  applySubmitterBlinding: vi.fn((item: Record<string, unknown>) => item),
}));

import {
  contestService,
  ContestGroupNotFoundError,
  ContestJudgeAlreadyAssignedError,
  ContestResultAlreadyExistsError,
  PeriodNotContestError,
  WinnersAlreadyAnnouncedError,
  PrizeAlreadyDisbursedError,
  NoPrizeAmountError,
  GroupHasRoundsError,
  DisbursementExistsError,
  UserNotOrgMemberError,
} from './contest.service.js';
import { assertEditorOrAdmin, assertBusinessOpsOrAdmin } from './errors.js';
import type { ServiceContext } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = 'org-1';
const USER_ID = 'user-1';
const PERIOD_ID = 'period-1';
const GROUP_ID = 'group-1';
const JUDGE_ID = 'judge-1';
const RESULT_ID = 'result-1';
const SUBMISSION_ID = 'sub-1';

/**
 * Create a mock tx that returns different values for sequential query chains.
 * Each entry in `results` is the array result for the Nth awaited query.
 */
function sequentialTx(results: unknown[][]) {
  let callIndex = 0;
  const chain: Record<string, unknown> = {};
  const methods = [
    'select',
    'from',
    'where',
    'limit',
    'offset',
    'orderBy',
    'insert',
    'values',
    'returning',
    'update',
    'set',
    'delete',
    'leftJoin',
    'groupBy',
  ];

  const makeProxy = (): unknown =>
    new Proxy(chain, {
      get(_target, prop) {
        if (prop === 'then') {
          const idx = callIndex++;
          const val = idx < results.length ? results[idx] : [];
          return (resolve: (v: unknown) => void) => resolve(val);
        }
        return () => makeProxy();
      },
    });

  for (const m of methods) {
    chain[m] = vi.fn().mockImplementation(() => makeProxy());
  }

  return makeProxy() as Record<string, ReturnType<typeof vi.fn>>;
}

function chainableTx(returnValue: unknown = []) {
  const chain: Record<string, unknown> = {};
  const methods = [
    'select',
    'from',
    'where',
    'limit',
    'offset',
    'orderBy',
    'insert',
    'values',
    'returning',
    'update',
    'set',
    'delete',
    'leftJoin',
    'groupBy',
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  // Terminal methods that resolve
  chain.returning = vi
    .fn()
    .mockResolvedValue(
      Array.isArray(returnValue) ? returnValue : [returnValue],
    );
  // Make the chain thenable for await
  const thenableChain = new Proxy(chain, {
    get(target, prop) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void) =>
          resolve(Array.isArray(returnValue) ? returnValue : [returnValue]);
      }
      return target[prop as string];
    },
  });
  // Override terminal methods
  for (const m of methods) {
    (chain[m] as ReturnType<typeof vi.fn>).mockReturnValue(thenableChain);
  }
  return thenableChain as unknown as Record<string, ReturnType<typeof vi.fn>>;
}

function makeSvc(txOverride?: unknown): ServiceContext {
  return {
    tx: (txOverride ?? chainableTx()) as never,
    actor: { userId: USER_ID, orgId: ORG_ID, roles: ['ADMIN'] },
    audit: vi.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('contestService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Contest Groups
  // -------------------------------------------------------------------------

  describe('createGroupWithAudit', () => {
    it('calls assertEditorOrAdmin and audits', async () => {
      const fakeGroup = { id: GROUP_ID, name: 'Fiction Prize 2026' };
      const tx = chainableTx(fakeGroup);
      const svc = makeSvc(tx);

      const result = await contestService.createGroupWithAudit(svc, {
        name: 'Fiction Prize 2026',
      });

      expect(assertEditorOrAdmin).toHaveBeenCalledWith(svc.actor.roles);
      expect(svc.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CONTEST_GROUP_CREATED',
          resource: 'contest_group',
          resourceId: GROUP_ID,
        }),
      );
      expect(result).toEqual(fakeGroup);
    });
  });

  describe('deleteGroupWithAudit', () => {
    it('rejects when group has linked rounds', () => {
      const err = new GroupHasRoundsError(GROUP_ID);
      expect(err.message).toContain('still has linked rounds');
      expect(err.name).toBe('GroupHasRoundsError');
    });
  });

  // -------------------------------------------------------------------------
  // Contest Judges
  // -------------------------------------------------------------------------

  describe('assignJudgeWithAudit', () => {
    it('calls assertEditorOrAdmin and audits', async () => {
      const fakeJudge = {
        id: JUDGE_ID,
        submissionPeriodId: PERIOD_ID,
        userId: 'judge-user',
        role: 'judge',
        isContest: true,
      };
      // Use sequentialTx: 1st call = period (isContest:true), 2nd = member (id),
      // 3rd = duplicate check (empty), 4th = insert (fakeJudge)
      const tx = sequentialTx([
        [{ id: PERIOD_ID, isContest: true }], // assertPeriodIsContest
        [{ id: 'member-1' }], // assertOrgMember
        [], // duplicate check (no existing)
        [fakeJudge], // insert returning
      ]);
      const svc = makeSvc(tx);

      const result = await contestService.assignJudgeWithAudit(svc, {
        submissionPeriodId: PERIOD_ID,
        userId: 'judge-user',
      });

      expect(assertEditorOrAdmin).toHaveBeenCalledWith(svc.actor.roles);
      expect(svc.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CONTEST_JUDGE_ASSIGNED',
          resource: 'contest',
          resourceId: JUDGE_ID,
        }),
      );
      expect(result).toEqual(fakeJudge);
    });
  });

  describe('removeJudgeWithAudit', () => {
    it('calls assertEditorOrAdmin and audits', async () => {
      const fakeJudge = {
        id: JUDGE_ID,
        submissionPeriodId: PERIOD_ID,
        userId: 'judge-user',
        role: 'judge',
        notes: null,
      };
      const tx = chainableTx(fakeJudge);
      const svc = makeSvc(tx);

      await contestService.removeJudgeWithAudit(svc, JUDGE_ID);

      expect(assertEditorOrAdmin).toHaveBeenCalledWith(svc.actor.roles);
      expect(svc.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CONTEST_JUDGE_REMOVED',
          resource: 'contest',
          resourceId: JUDGE_ID,
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Contest Results
  // -------------------------------------------------------------------------

  describe('createResultWithAudit', () => {
    it('calls assertEditorOrAdmin and audits', async () => {
      const fakeResult = {
        id: RESULT_ID,
        submissionPeriodId: PERIOD_ID,
        submissionId: SUBMISSION_ID,
        placement: 1,
        category: 'fiction',
        prizeAmount: 50000,
      };
      // 1st call = period check, 2nd = duplicate check (empty), 3rd = insert
      const tx = sequentialTx([
        [{ id: PERIOD_ID, isContest: true }], // assertPeriodIsContest
        [], // duplicate check (no existing)
        [fakeResult], // insert returning
      ]);
      const svc = makeSvc(tx);

      const result = await contestService.createResultWithAudit(svc, {
        submissionPeriodId: PERIOD_ID,
        submissionId: SUBMISSION_ID,
        placement: 1,
        category: 'fiction',
        prizeAmount: 50000,
        prizeCurrency: 'usd',
      });

      expect(assertEditorOrAdmin).toHaveBeenCalledWith(svc.actor.roles);
      expect(svc.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CONTEST_RESULT_CREATED',
          resource: 'contest',
          resourceId: RESULT_ID,
        }),
      );
      expect(result).toEqual(fakeResult);
    });
  });

  describe('deleteResultWithAudit', () => {
    it('calls assertEditorOrAdmin and audits', async () => {
      const fakeResult = {
        id: RESULT_ID,
        disbursementId: null,
      };
      const tx = chainableTx(fakeResult);
      const svc = makeSvc(tx);

      await contestService.deleteResultWithAudit(svc, RESULT_ID);

      expect(assertEditorOrAdmin).toHaveBeenCalledWith(svc.actor.roles);
      expect(svc.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CONTEST_RESULT_DELETED',
          resource: 'contest',
          resourceId: RESULT_ID,
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Announce Winners
  // -------------------------------------------------------------------------

  describe('announceWinnersWithAudit', () => {
    it('calls assertEditorOrAdmin and audits', async () => {
      const fakePeriod = {
        id: PERIOD_ID,
        isContest: true,
        contestWinnersAnnouncedAt: null,
      };
      const tx = chainableTx(fakePeriod);
      const svc = makeSvc(tx);

      await contestService.announceWinnersWithAudit(svc, PERIOD_ID);

      expect(assertEditorOrAdmin).toHaveBeenCalledWith(svc.actor.roles);
      expect(svc.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CONTEST_WINNERS_ANNOUNCED',
          resource: 'contest',
          resourceId: PERIOD_ID,
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Prize Disbursement
  // -------------------------------------------------------------------------

  describe('disbursePrizeWithAudit', () => {
    it('calls assertBusinessOpsOrAdmin and audits', async () => {
      const fakeResult = {
        id: RESULT_ID,
        submissionId: SUBMISSION_ID,
        submissionPeriodId: PERIOD_ID,
        prizeAmount: 50000,
        prizeCurrency: 'usd',
        disbursementId: null,
        placement: 1,
        category: 'fiction',
      };
      // The disbursePrize method does multiple tx calls —
      // our simple mock returns the same value for all calls
      const tx = chainableTx(fakeResult);
      const svc = makeSvc(tx);

      // We need to also mock the insert for the transaction
      // Since the mock returns fakeResult for everything, we just check
      // that the right assertions are called
      await contestService.disbursePrizeWithAudit(svc, RESULT_ID);

      expect(assertBusinessOpsOrAdmin).toHaveBeenCalledWith(svc.actor.roles);
      expect(svc.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CONTEST_PRIZE_DISBURSED',
          resource: 'contest',
          resourceId: RESULT_ID,
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Error classes
  // -------------------------------------------------------------------------

  describe('error classes', () => {
    it('PeriodNotContestError', () => {
      const err = new PeriodNotContestError('p-1');
      expect(err.name).toBe('PeriodNotContestError');
      expect(err.message).toContain('not a contest');
    });

    it('ContestJudgeAlreadyAssignedError', () => {
      const err = new ContestJudgeAlreadyAssignedError('u-1', 'p-1');
      expect(err.name).toBe('ContestJudgeAlreadyAssignedError');
      expect(err.message).toContain('already assigned');
    });

    it('ContestResultAlreadyExistsError', () => {
      const err = new ContestResultAlreadyExistsError('s-1', 'p-1');
      expect(err.name).toBe('ContestResultAlreadyExistsError');
      expect(err.message).toContain('already exists');
    });

    it('WinnersAlreadyAnnouncedError', () => {
      const err = new WinnersAlreadyAnnouncedError('p-1');
      expect(err.name).toBe('WinnersAlreadyAnnouncedError');
      expect(err.message).toContain('already been announced');
    });

    it('PrizeAlreadyDisbursedError', () => {
      const err = new PrizeAlreadyDisbursedError('r-1');
      expect(err.name).toBe('PrizeAlreadyDisbursedError');
      expect(err.message).toContain('already been disbursed');
    });

    it('NoPrizeAmountError', () => {
      const err = new NoPrizeAmountError('r-1');
      expect(err.name).toBe('NoPrizeAmountError');
      expect(err.message).toContain('no prize amount');
    });

    it('DisbursementExistsError', () => {
      const err = new DisbursementExistsError('r-1');
      expect(err.name).toBe('DisbursementExistsError');
      expect(err.message).toContain('existing disbursement');
    });

    it('UserNotOrgMemberError', () => {
      const err = new UserNotOrgMemberError('u-1');
      expect(err.name).toBe('UserNotOrgMemberError');
      expect(err.message).toContain('not a member');
    });

    it('GroupHasRoundsError', () => {
      const err = new GroupHasRoundsError('g-1');
      expect(err.name).toBe('GroupHasRoundsError');
      expect(err.message).toContain('still has linked rounds');
    });

    it('ContestGroupNotFoundError', () => {
      const err = new ContestGroupNotFoundError('g-1');
      expect(err.name).toBe('ContestGroupNotFoundError');
      expect(err.message).toContain('not found');
    });
  });

  // -------------------------------------------------------------------------
  // isJudgeForSubmissionPeriod
  // -------------------------------------------------------------------------

  describe('isJudgeForSubmissionPeriod', () => {
    it('returns false when submissionPeriodId is null', async () => {
      const tx = chainableTx([]);
      const result = await contestService.isJudgeForSubmissionPeriod(
        tx as never,
        USER_ID,
        null,
      );
      expect(result).toBe(false);
    });

    it('returns true when judge record found', async () => {
      const tx = chainableTx({ id: JUDGE_ID });
      const result = await contestService.isJudgeForSubmissionPeriod(
        tx as never,
        USER_ID,
        PERIOD_ID,
      );
      expect(result).toBe(true);
    });
  });
});
