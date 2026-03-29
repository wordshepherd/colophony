import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@colophony/db', () => ({
  contributors: {
    id: 'c.id',
    organizationId: 'c.org_id',
    userId: 'c.user_id',
    displayName: 'c.display_name',
    bio: 'c.bio',
    pronouns: 'c.pronouns',
    email: 'c.email',
    website: 'c.website',
    mailingAddress: 'c.mailing_address',
    notes: 'c.notes',
    createdAt: 'c.created_at',
    updatedAt: 'c.updated_at',
  },
  contributorPublications: {
    id: 'cp.id',
    contributorId: 'cp.contributor_id',
    pipelineItemId: 'cp.pipeline_item_id',
    role: 'cp.role',
    displayOrder: 'cp.display_order',
    createdAt: 'cp.created_at',
  },
  pipelineItems: {
    id: 'pi.id',
    organizationId: 'pi.org_id',
  },
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  ilike: vi.fn(),
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

import {
  contributorService,
  ContributorNotFoundError,
  ContributorAlreadyLinkedError,
  ContributorPublicationDuplicateError,
} from './contributor.service.js';
import { assertBusinessOpsOrAdmin } from './errors.js';
import type { ServiceContext } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = 'org-1';
const USER_ID = 'user-1';
const CONTRIBUTOR_ID = 'contributor-1';

const fakeContributor = {
  id: CONTRIBUTOR_ID,
  organizationId: ORG_ID,
  userId: null,
  displayName: 'Jane Poet',
  bio: null,
  pronouns: 'she/her',
  email: 'jane@example.com',
  website: null,
  mailingAddress: null,
  notes: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const fakePub = {
  id: 'pub-1',
  contributorId: CONTRIBUTOR_ID,
  pipelineItemId: 'pi-1',
  role: 'author' as const,
  displayOrder: 0,
  createdAt: new Date('2026-01-01'),
};

/**
 * Build a mock tx. Each call to select/insert/update/delete returns a fresh
 * chain to avoid shared-state issues between sequential queries.
 */
function makeChain() {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of [
    'from',
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
  // Track all chains so tests can set return values on the Nth chain.
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
    /** Get the Nth chain (0-based) created during the test. */
    chain(n: number) {
      return chains[n];
    },
    /** Reset chains for next test. */
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

describe('contributorService', () => {
  let mockTx: ReturnType<typeof makeMockTx>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx = makeMockTx();
  });

  // -----------------------------------------------------------------------
  // getById
  // -----------------------------------------------------------------------

  describe('getById', () => {
    it('returns contributor when found', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([fakeContributor]);
        return c;
      });

      const result = await contributorService.getById(
        mockTx as any,
        CONTRIBUTOR_ID,
        ORG_ID,
      );
      expect(result).toEqual(fakeContributor);
    });

    it('returns null when not found', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([]);
        return c;
      });

      const result = await contributorService.getById(
        mockTx as any,
        'nonexistent',
        ORG_ID,
      );
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // createWithAudit
  // -----------------------------------------------------------------------

  describe('createWithAudit', () => {
    it('inserts contributor and emits audit event', async () => {
      // insert chain: insert→values→returning
      mockTx.insert = vi.fn(() => {
        const c = makeChain();
        c.returning.mockResolvedValueOnce([fakeContributor]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      const result = await contributorService.createWithAudit(ctx, {
        displayName: 'Jane Poet',
        pronouns: 'she/her',
        email: 'jane@example.com',
      });

      expect(result).toEqual(fakeContributor);
      expect(assertBusinessOpsOrAdmin).toHaveBeenCalledWith(['BUSINESS_OPS']);
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CONTRIBUTOR_CREATED',
          resource: 'contributor',
          resourceId: CONTRIBUTOR_ID,
        }),
      );
    });

    it('throws ContributorAlreadyLinkedError when userId already linked', async () => {
      // getByUserId: select→from→where→limit resolves with existing
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([fakeContributor]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await expect(
        contributorService.createWithAudit(ctx, {
          displayName: 'Another',
          userId: USER_ID,
        }),
      ).rejects.toThrow(ContributorAlreadyLinkedError);
    });
  });

  // -----------------------------------------------------------------------
  // updateWithAudit
  // -----------------------------------------------------------------------

  describe('updateWithAudit', () => {
    it('updates fields and emits audit', async () => {
      // getById returns existing, then update returns updated
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([fakeContributor]);
        return c;
      });
      mockTx.update = vi.fn(() => {
        const c = makeChain();
        c.returning.mockResolvedValueOnce([
          { ...fakeContributor, displayName: 'Jane Updated' },
        ]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      const result = await contributorService.updateWithAudit(ctx, {
        id: CONTRIBUTOR_ID,
        displayName: 'Jane Updated',
      });

      expect(result.displayName).toBe('Jane Updated');
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CONTRIBUTOR_UPDATED',
          resource: 'contributor',
        }),
      );
    });

    it('throws ContributorNotFoundError for missing ID', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await expect(
        contributorService.updateWithAudit(ctx, {
          id: 'nonexistent',
          displayName: 'X',
        }),
      ).rejects.toThrow(ContributorNotFoundError);
    });
  });

  // -----------------------------------------------------------------------
  // deleteWithAudit
  // -----------------------------------------------------------------------

  describe('deleteWithAudit', () => {
    it('deletes and emits audit', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([fakeContributor]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await contributorService.deleteWithAudit(ctx, CONTRIBUTOR_ID);

      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CONTRIBUTOR_DELETED',
          resource: 'contributor',
          resourceId: CONTRIBUTOR_ID,
        }),
      );
    });

    it('throws ContributorNotFoundError for missing ID', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await expect(
        contributorService.deleteWithAudit(ctx, 'nonexistent'),
      ).rejects.toThrow(ContributorNotFoundError);
    });
  });

  // -----------------------------------------------------------------------
  // addPublicationWithAudit
  // -----------------------------------------------------------------------

  describe('addPublicationWithAudit', () => {
    it('inserts publication link and emits audit', async () => {
      // Pipeline item org validation
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([{ id: 'pi-1' }]);
        return c;
      });
      mockTx.insert = vi.fn(() => {
        const c = makeChain();
        c.returning.mockResolvedValueOnce([fakePub]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      const result = await contributorService.addPublicationWithAudit(ctx, {
        contributorId: CONTRIBUTOR_ID,
        pipelineItemId: 'pi-1',
        role: 'author',
        displayOrder: 0,
      });

      expect(result).toEqual(fakePub);
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CONTRIBUTOR_PUBLICATION_ADDED',
          resource: 'contributor',
        }),
      );
    });

    it('throws ContributorPublicationDuplicateError on unique violation', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([{ id: 'pi-1' }]);
        return c;
      });
      mockTx.insert = vi.fn(() => {
        const c = makeChain();
        c.returning.mockRejectedValueOnce(
          new Error(
            'duplicate key value violates unique constraint "contributor_publications_contributor_item_role_idx"',
          ),
        );
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await expect(
        contributorService.addPublicationWithAudit(ctx, {
          contributorId: CONTRIBUTOR_ID,
          pipelineItemId: 'pi-1',
          role: 'author',
          displayOrder: 0,
        }),
      ).rejects.toThrow(ContributorPublicationDuplicateError);
    });
  });

  // -----------------------------------------------------------------------
  // removePublicationWithAudit
  // -----------------------------------------------------------------------

  describe('removePublicationWithAudit', () => {
    it('removes link and emits audit', async () => {
      const ctx = makeServiceContext(mockTx);

      await contributorService.removePublicationWithAudit(ctx, {
        contributorId: CONTRIBUTOR_ID,
        pipelineItemId: 'pi-1',
        role: 'author',
      });

      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CONTRIBUTOR_PUBLICATION_REMOVED',
          resource: 'contributor',
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Role guard
  // -----------------------------------------------------------------------

  describe('role guard', () => {
    it('createWithAudit calls assertBusinessOpsOrAdmin', async () => {
      mockTx.insert = vi.fn(() => {
        const c = makeChain();
        c.returning.mockResolvedValueOnce([fakeContributor]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await contributorService.createWithAudit(ctx, { displayName: 'Test' });
      expect(assertBusinessOpsOrAdmin).toHaveBeenCalledWith(['BUSINESS_OPS']);
    });

    it('deleteWithAudit calls assertBusinessOpsOrAdmin', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([fakeContributor]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await contributorService.deleteWithAudit(ctx, CONTRIBUTOR_ID);
      expect(assertBusinessOpsOrAdmin).toHaveBeenCalledWith(['BUSINESS_OPS']);
    });

    it('addPublicationWithAudit calls assertBusinessOpsOrAdmin', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([{ id: 'pi-1' }]);
        return c;
      });
      mockTx.insert = vi.fn(() => {
        const c = makeChain();
        c.returning.mockResolvedValueOnce([fakePub]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await contributorService.addPublicationWithAudit(ctx, {
        contributorId: CONTRIBUTOR_ID,
        pipelineItemId: 'pi-1',
        role: 'author',
        displayOrder: 0,
      });
      expect(assertBusinessOpsOrAdmin).toHaveBeenCalledWith(['BUSINESS_OPS']);
    });
  });
});
