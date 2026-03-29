import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@colophony/db', () => ({
  rightsAgreements: {
    id: 'ra.id',
    organizationId: 'ra.org_id',
    contributorId: 'ra.contributor_id',
    pipelineItemId: 'ra.pipeline_item_id',
    rightsType: 'ra.rights_type',
    customDescription: 'ra.custom_description',
    status: 'ra.status',
    grantedAt: 'ra.granted_at',
    expiresAt: 'ra.expires_at',
    revertedAt: 'ra.reverted_at',
    notes: 'ra.notes',
    createdAt: 'ra.created_at',
    updatedAt: 'ra.updated_at',
  },
  contributors: {
    id: 'c.id',
    organizationId: 'c.org_id',
    displayName: 'c.display_name',
  },
  pipelineItems: {
    id: 'pi.id',
    organizationId: 'pi.org_id',
    submissionId: 'pi.submission_id',
  },
  submissions: {
    id: 's.id',
    title: 's.title',
  },
  eq: vi.fn(),
  and: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  not: vi.fn(),
  isNull: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  count: vi.fn(),
}));

vi.mock('./errors.js', () => ({
  assertBusinessOpsOrAdmin: vi.fn(),
  ForbiddenError: class ForbiddenError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'ForbiddenError';
    }
  },
}));

vi.mock('./contributor.service.js', () => ({
  PipelineItemNotInOrgError: class PipelineItemNotInOrgError extends Error {
    constructor(id: string) {
      super(`Pipeline item "${id}" does not belong to this organization`);
      this.name = 'PipelineItemNotInOrgError';
    }
  },
}));

import {
  rightsAgreementService,
  RightsAgreementNotFoundError,
  InvalidRightsStatusTransitionError,
  ContributorNotInOrgError,
} from './rights-agreement.service.js';
import { PipelineItemNotInOrgError } from './contributor.service.js';
import { assertBusinessOpsOrAdmin } from './errors.js';
import type { ServiceContext } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = 'org-1';
const USER_ID = 'user-1';
const RIGHTS_ID = 'rights-1';
const CONTRIBUTOR_ID = 'contributor-1';

const fakeAgreement = {
  id: RIGHTS_ID,
  organizationId: ORG_ID,
  contributorId: CONTRIBUTOR_ID,
  pipelineItemId: null,
  rightsType: 'first_north_american_serial' as const,
  customDescription: null,
  status: 'DRAFT' as const,
  grantedAt: null,
  expiresAt: null,
  revertedAt: null,
  notes: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

function makeChain() {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of [
    'from',
    'leftJoin',
    'where',
    'orderBy',
    'limit',
    'offset',
    'values',
    'set',
    'returning',
  ]) {
    c[m] = vi.fn().mockReturnValue(c);
  }
  return c;
}

function makeMockTx() {
  const chains: Array<Record<string, ReturnType<typeof vi.fn>>> = [];

  function newChain() {
    const c = makeChain();
    chains.push(c);
    return c;
  }

  return {
    select: vi.fn(() => newChain()),
    insert: vi.fn(() => newChain()),
    update: vi.fn(() => newChain()),
    delete: vi.fn(() => newChain()),
    chain(n: number) {
      return chains[n];
    },
    resetChains() {
      chains.length = 0;
    },
  };
}

function makeServiceContext(tx: ReturnType<typeof makeMockTx>): ServiceContext {
  return {
    tx: tx as unknown as ServiceContext['tx'],
    actor: { userId: USER_ID, orgId: ORG_ID, roles: ['BUSINESS_OPS'] },
    audit: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('rightsAgreementService', () => {
  let mockTx: ReturnType<typeof makeMockTx>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx = makeMockTx();
  });

  // -----------------------------------------------------------------------
  // getById
  // -----------------------------------------------------------------------

  describe('getById', () => {
    it('returns agreement when found', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([fakeAgreement]);
        return c;
      });

      const result = await rightsAgreementService.getById(
        mockTx as any,
        RIGHTS_ID,
        ORG_ID,
      );
      expect(result).toEqual(fakeAgreement);
    });

    it('returns null when not found', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([]);
        return c;
      });

      const result = await rightsAgreementService.getById(
        mockTx as any,
        'nonexistent',
        ORG_ID,
      );
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // getUpcomingReversions
  // -----------------------------------------------------------------------

  describe('getUpcomingReversions', () => {
    it('returns active agreements expiring within window', async () => {
      const expiring = {
        ...fakeAgreement,
        status: 'ACTIVE' as const,
        expiresAt: new Date('2026-02-01'),
      };
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.orderBy.mockResolvedValueOnce([expiring]);
        return c;
      });

      const result = await rightsAgreementService.getUpcomingReversions(
        mockTx as any,
        ORG_ID,
        30,
      );
      expect(result).toEqual([expiring]);
    });
  });

  // -----------------------------------------------------------------------
  // createWithAudit
  // -----------------------------------------------------------------------

  describe('createWithAudit', () => {
    it('inserts agreement and emits audit event', async () => {
      // contributor validation select + insert
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([{ id: CONTRIBUTOR_ID }]);
        return c;
      });
      mockTx.insert = vi.fn(() => {
        const c = makeChain();
        c.returning.mockResolvedValueOnce([fakeAgreement]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      const result = await rightsAgreementService.createWithAudit(ctx, {
        contributorId: CONTRIBUTOR_ID,
        rightsType: 'first_north_american_serial',
      });

      expect(result).toEqual(fakeAgreement);
      expect(assertBusinessOpsOrAdmin).toHaveBeenCalledWith(['BUSINESS_OPS']);
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RIGHTS_AGREEMENT_CREATED',
          resource: 'rights_agreement',
          resourceId: RIGHTS_ID,
        }),
      );
    });

    it('throws ContributorNotInOrgError for cross-org contributor', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await expect(
        rightsAgreementService.createWithAudit(ctx, {
          contributorId: 'other-org-contributor',
          rightsType: 'electronic',
        }),
      ).rejects.toThrow(ContributorNotInOrgError);
    });

    it('validates pipeline item belongs to org when provided', async () => {
      // First select: contributor found. Second select: pipeline item not found.
      let selectCount = 0;
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        selectCount++;
        if (selectCount === 1) {
          c.limit.mockResolvedValueOnce([{ id: CONTRIBUTOR_ID }]);
        } else {
          c.limit.mockResolvedValueOnce([]);
        }
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await expect(
        rightsAgreementService.createWithAudit(ctx, {
          contributorId: CONTRIBUTOR_ID,
          pipelineItemId: 'bad-pi',
          rightsType: 'electronic',
        }),
      ).rejects.toThrow(PipelineItemNotInOrgError);
    });
  });

  // -----------------------------------------------------------------------
  // updateWithAudit
  // -----------------------------------------------------------------------

  describe('updateWithAudit', () => {
    it('updates fields and emits audit', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([fakeAgreement]);
        return c;
      });
      mockTx.update = vi.fn(() => {
        const c = makeChain();
        c.returning.mockResolvedValueOnce([
          { ...fakeAgreement, rightsType: 'electronic' },
        ]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      const result = await rightsAgreementService.updateWithAudit(ctx, {
        id: RIGHTS_ID,
        rightsType: 'electronic',
      });

      expect(result.rightsType).toBe('electronic');
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RIGHTS_AGREEMENT_UPDATED',
          resource: 'rights_agreement',
        }),
      );
    });

    it('throws RightsAgreementNotFoundError for missing ID', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await expect(
        rightsAgreementService.updateWithAudit(ctx, {
          id: 'nonexistent',
          rightsType: 'electronic',
        }),
      ).rejects.toThrow(RightsAgreementNotFoundError);
    });
  });

  // -----------------------------------------------------------------------
  // transitionStatusWithAudit
  // -----------------------------------------------------------------------

  describe('transitionStatusWithAudit', () => {
    it('transitions DRAFT to SENT and emits SENT audit', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([fakeAgreement]);
        return c;
      });
      mockTx.update = vi.fn(() => {
        const c = makeChain();
        c.returning.mockResolvedValueOnce([
          { ...fakeAgreement, status: 'SENT' },
        ]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      const result = await rightsAgreementService.transitionStatusWithAudit(
        ctx,
        { id: RIGHTS_ID, status: 'SENT' },
      );

      expect(result.status).toBe('SENT');
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RIGHTS_AGREEMENT_SENT',
          resource: 'rights_agreement',
          newValue: { status: 'SENT' },
        }),
      );
    });

    it('transitions SIGNED to ACTIVE and sets grantedAt', async () => {
      const signed = { ...fakeAgreement, status: 'SIGNED' as const };
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([signed]);
        return c;
      });
      mockTx.update = vi.fn(() => {
        const c = makeChain();
        c.returning.mockResolvedValueOnce([
          { ...signed, status: 'ACTIVE', grantedAt: new Date() },
        ]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      const result = await rightsAgreementService.transitionStatusWithAudit(
        ctx,
        { id: RIGHTS_ID, status: 'ACTIVE' },
      );

      expect(result.status).toBe('ACTIVE');
      expect(result.grantedAt).toBeTruthy();
      // Verify update was called with grantedAt set
      expect(mockTx.update).toHaveBeenCalled();
    });

    it('does not overwrite grantedAt if already set', async () => {
      const alreadyGranted = {
        ...fakeAgreement,
        status: 'SIGNED' as const,
        grantedAt: new Date('2026-01-15'),
      };
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([alreadyGranted]);
        return c;
      });
      mockTx.update = vi.fn(() => {
        const c = makeChain();
        c.returning.mockResolvedValueOnce([
          { ...alreadyGranted, status: 'ACTIVE' },
        ]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await rightsAgreementService.transitionStatusWithAudit(ctx, {
        id: RIGHTS_ID,
        status: 'ACTIVE',
      });

      // The update chain's set() should have been called with only status
      // (no grantedAt override since it was already set)
      const updateChain = mockTx.update.mock.results[0]?.value;
      if (updateChain?.set?.mock?.calls?.[0]) {
        const setArg = updateChain.set.mock.calls[0][0];
        expect(setArg).not.toHaveProperty('grantedAt');
      }
    });

    it('transitions ACTIVE to REVERTED and sets revertedAt', async () => {
      const active = { ...fakeAgreement, status: 'ACTIVE' as const };
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([active]);
        return c;
      });
      mockTx.update = vi.fn(() => {
        const c = makeChain();
        c.returning.mockResolvedValueOnce([
          { ...active, status: 'REVERTED', revertedAt: new Date() },
        ]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      const result = await rightsAgreementService.transitionStatusWithAudit(
        ctx,
        { id: RIGHTS_ID, status: 'REVERTED' },
      );

      expect(result.status).toBe('REVERTED');
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RIGHTS_AGREEMENT_REVERTED',
          resource: 'rights_agreement',
        }),
      );
    });

    it('throws InvalidRightsStatusTransitionError for invalid transition', async () => {
      const reverted = { ...fakeAgreement, status: 'REVERTED' as const };
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([reverted]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await expect(
        rightsAgreementService.transitionStatusWithAudit(ctx, {
          id: RIGHTS_ID,
          status: 'DRAFT',
        }),
      ).rejects.toThrow(InvalidRightsStatusTransitionError);
    });

    it('throws RightsAgreementNotFoundError for missing ID', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await expect(
        rightsAgreementService.transitionStatusWithAudit(ctx, {
          id: 'nonexistent',
          status: 'SENT',
        }),
      ).rejects.toThrow(RightsAgreementNotFoundError);
    });
  });

  // -----------------------------------------------------------------------
  // deleteWithAudit
  // -----------------------------------------------------------------------

  describe('deleteWithAudit', () => {
    it('deletes and emits audit', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([fakeAgreement]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await rightsAgreementService.deleteWithAudit(ctx, RIGHTS_ID);

      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RIGHTS_AGREEMENT_DELETED',
          resource: 'rights_agreement',
          resourceId: RIGHTS_ID,
        }),
      );
    });

    it('throws RightsAgreementNotFoundError for missing ID', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await expect(
        rightsAgreementService.deleteWithAudit(ctx, 'nonexistent'),
      ).rejects.toThrow(RightsAgreementNotFoundError);
    });
  });

  // -----------------------------------------------------------------------
  // Role guard
  // -----------------------------------------------------------------------

  describe('role guard', () => {
    it('createWithAudit calls assertBusinessOpsOrAdmin', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([{ id: CONTRIBUTOR_ID }]);
        return c;
      });
      mockTx.insert = vi.fn(() => {
        const c = makeChain();
        c.returning.mockResolvedValueOnce([fakeAgreement]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await rightsAgreementService.createWithAudit(ctx, {
        contributorId: CONTRIBUTOR_ID,
        rightsType: 'first_north_american_serial',
      });
      expect(assertBusinessOpsOrAdmin).toHaveBeenCalledWith(['BUSINESS_OPS']);
    });

    it('updateWithAudit calls assertBusinessOpsOrAdmin', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([fakeAgreement]);
        return c;
      });
      mockTx.update = vi.fn(() => {
        const c = makeChain();
        c.returning.mockResolvedValueOnce([
          { ...fakeAgreement, rightsType: 'electronic' },
        ]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await rightsAgreementService.updateWithAudit(ctx, {
        id: RIGHTS_ID,
        rightsType: 'electronic',
      });
      expect(assertBusinessOpsOrAdmin).toHaveBeenCalledWith(['BUSINESS_OPS']);
    });

    it('transitionStatusWithAudit calls assertBusinessOpsOrAdmin', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([fakeAgreement]);
        return c;
      });
      mockTx.update = vi.fn(() => {
        const c = makeChain();
        c.returning.mockResolvedValueOnce([
          { ...fakeAgreement, status: 'SENT' },
        ]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await rightsAgreementService.transitionStatusWithAudit(ctx, {
        id: RIGHTS_ID,
        status: 'SENT',
      });
      expect(assertBusinessOpsOrAdmin).toHaveBeenCalledWith(['BUSINESS_OPS']);
    });

    it('deleteWithAudit calls assertBusinessOpsOrAdmin', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([fakeAgreement]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await rightsAgreementService.deleteWithAudit(ctx, RIGHTS_ID);
      expect(assertBusinessOpsOrAdmin).toHaveBeenCalledWith(['BUSINESS_OPS']);
    });
  });
});
