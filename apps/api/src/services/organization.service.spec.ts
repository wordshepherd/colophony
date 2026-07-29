import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPoolQuery, mockClientQuery, mockClientRelease, mockPoolConnect } =
  vi.hoisted(() => {
    const mockPoolQuery = vi.fn();
    const mockClientQuery = vi.fn();
    const mockClientRelease = vi.fn();
    const mockPoolConnect = vi.fn();
    return {
      mockPoolQuery,
      mockClientQuery,
      mockClientRelease,
      mockPoolConnect,
    };
  });

// Mock Drizzle insert/select/update/delete chains
const mockReturning = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();
const mockWhere = vi.fn();
const mockSet = vi.fn();
const mockValues = vi.fn();
const mockFrom = vi.fn();
const mockInnerJoin = vi.fn();
const mockOrderBy = vi.fn();

// Reset chain mocks to build fluent API
function resetChainMocks() {
  // select chain: select().from().where().limit().offset()
  mockReturning.mockReturnValue([]);
  mockLimit.mockReturnValue({ offset: mockOffset });
  mockOffset.mockResolvedValue([]);
  mockWhere.mockReturnValue({ returning: mockReturning, limit: mockLimit });
  mockFrom.mockReturnValue({
    where: mockWhere,
    innerJoin: mockInnerJoin,
    limit: mockLimit,
    orderBy: mockOrderBy,
  });
  mockInnerJoin.mockReturnValue({
    orderBy: mockOrderBy,
    where: mockWhere,
  });
  mockOrderBy.mockReturnValue({
    limit: mockLimit,
  });
  mockLimit.mockReturnValue({
    offset: mockOffset,
  });
  mockOffset.mockResolvedValue([]);
  mockValues.mockReturnValue({ returning: mockReturning });
  mockSet.mockReturnValue({ where: mockWhere });
}

vi.mock('@colophony/db', () => ({
  pool: {
    query: mockPoolQuery,
    connect: mockPoolConnect,
  },
  organizations: {
    id: 'id',
    name: 'name',
    slug: 'slug',
    settings: 'settings',
    updatedAt: 'updated_at',
    createdAt: 'created_at',
  },
  organizationMembers: {
    id: 'id',
    organizationId: 'organization_id',
    userId: 'user_id',
    roles: 'roles',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  users: { id: 'id', email: 'email' },
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn(() => ({
    select: vi.fn(() => ({ from: mockFrom })),
    insert: vi.fn(() => ({ values: mockValues })),
    update: vi.fn(() => ({ set: mockSet })),
    delete: vi.fn(() => ({ where: mockWhere })),
  })),
}));

import { eq, organizationMembers } from '@colophony/db';
import {
  organizationService,
  UserNotFoundError,
} from './organization.service.js';

describe('organizationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPoolConnect.mockResolvedValue({
      query: mockClientQuery,
      release: mockClientRelease,
    });
    mockClientQuery.mockResolvedValue({ rows: [] });
    resetChainMocks();
  });

  describe('listUserOrganizations', () => {
    it('calls SECURITY DEFINER function and maps results', async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          {
            organization_id: 'org-1',
            roles: ['ADMIN'],
            organization_name: 'Org One',
            slug: 'org-one',
          },
          {
            organization_id: 'org-2',
            roles: ['READER'],
            organization_name: 'Org Two',
            slug: 'org-two',
          },
        ],
      });

      const result = await organizationService.listUserOrganizations('user-1');
      expect(mockPoolQuery).toHaveBeenCalledWith(
        'SELECT * FROM list_user_organizations($1)',
        ['user-1'],
      );
      expect(result).toEqual([
        {
          organizationId: 'org-1',
          roles: ['ADMIN'],
          name: 'Org One',
          slug: 'org-one',
        },
        {
          organizationId: 'org-2',
          roles: ['READER'],
          name: 'Org Two',
          slug: 'org-two',
        },
      ]);
    });

    it('returns empty array when user has no memberships', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });
      const result =
        await organizationService.listUserOrganizations('user-none');
      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('creates org and ADMIN member in a transaction', async () => {
      const fakeOrg = { id: 'org-new', name: 'New Org', slug: 'new-org' };
      const fakeMember = {
        id: 'member-1',
        organizationId: 'org-new',
        userId: 'user-1',
        roles: ['ADMIN'],
      };

      // First insert returns org, second returns member
      mockReturning
        .mockResolvedValueOnce([fakeOrg])
        .mockResolvedValueOnce([fakeMember]);
      mockClientQuery.mockResolvedValue({});

      const result = await organizationService.create(
        { name: 'New Org', slug: 'new-org' },
        'user-1',
      );

      expect(result.organization).toEqual(fakeOrg);
      expect(result.membership).toEqual(fakeMember);
      // BEGIN + 2 set_config + COMMIT = 4 client.query calls
      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
      expect(mockClientRelease).toHaveBeenCalled();
    });

    it('rolls back on error', async () => {
      mockReturning.mockRejectedValueOnce(new Error('unique constraint'));
      mockClientQuery.mockResolvedValue({});

      await expect(
        organizationService.create({ name: 'Dup', slug: 'dup' }, 'user-1'),
      ).rejects.toThrow('unique constraint');

      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClientRelease).toHaveBeenCalled();
    });
  });

  describe('isSlugAvailable', () => {
    it('returns true when slug is not taken', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });
      const available = await organizationService.isSlugAvailable('new-slug');
      expect(available).toBe(true);
    });

    it('returns false when slug is taken', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
      const available = await organizationService.isSlugAvailable('taken-slug');
      expect(available).toBe(false);
    });
  });

  describe('getById', () => {
    it('returns org when found', async () => {
      const fakeOrg = { id: 'org-1', name: 'Org', slug: 'org' };
      mockLimit.mockResolvedValueOnce([fakeOrg]);

      const mockTx = {
        select: vi.fn(() => ({ from: mockFrom })),
      } as never;

      const result = await organizationService.getById(mockTx, 'org-1');
      expect(result).toEqual(fakeOrg);
    });

    it('returns null when not found', async () => {
      mockLimit.mockResolvedValueOnce([]);
      const mockTx = {
        select: vi.fn(() => ({ from: mockFrom })),
      } as never;

      const result = await organizationService.getById(mockTx, 'org-missing');
      expect(result).toBeNull();
    });
  });

  describe('addMember', () => {
    it('throws UserNotFoundError when email not found', async () => {
      mockLimit.mockResolvedValueOnce([]); // user lookup returns empty

      const mockTx = {
        select: vi.fn(() => ({ from: mockFrom })),
        insert: vi.fn(() => ({ values: mockValues })),
      } as never;

      await expect(
        organizationService.addMember(mockTx, 'org-1', 'nobody@example.com', [
          'READER',
        ]),
      ).rejects.toThrow(UserNotFoundError);
    });
  });

  /**
   * These assert the *predicate*, not the results. The mock `tx` returns whatever
   * it is told regardless of the WHERE clause, so a "wrong org returns nothing"
   * test here would pass with the filter removed. Asserting on the mocked `eq()`
   * and on what reaches `.where()` is what actually fails when it goes missing.
   *
   * The real proof lives in `src/__tests__/rls/organization-service.test.ts`,
   * which runs this query against Postgres over an RLS-bypassing connection.
   */
  describe('defense-in-depth: listMembers organization predicate', () => {
    const PREDICATE = Symbol('org-predicate');

    /**
     * `listMembers` calls `tx.select()` twice under Promise.all — once for the page
     * (from → innerJoin → where → orderBy → limit → offset) and once for the count
     * (from → where). Returning a different chain per call is what lets both
     * resolve to their own shape; `wheres` collects what each was filtered on.
     */
    function makeListMembersTx(wheres: unknown[]) {
      let callCount = 0;
      return {
        select: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return {
              from: vi.fn().mockReturnValue({
                innerJoin: vi.fn().mockReturnValue({
                  where: vi.fn().mockImplementation((w: unknown) => {
                    wheres.push(w);
                    return {
                      orderBy: vi.fn().mockReturnValue({
                        limit: vi.fn().mockReturnValue({
                          offset: vi.fn().mockResolvedValue([]),
                        }),
                      }),
                    };
                  }),
                }),
              }),
            };
          }
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockImplementation((w: unknown) => {
                wheres.push(w);
                return Promise.resolve([{ count: 0 }]);
              }),
            }),
          };
        }),
      } as unknown as Parameters<typeof organizationService.listMembers>[0];
    }

    it('filters both the page and the count query on the same org predicate', async () => {
      vi.mocked(eq).mockReturnValue(PREDICATE as never);
      const wheres: unknown[] = [];

      await organizationService.listMembers(
        makeListMembersTx(wheres),
        { page: 1, limit: 20 },
        'org-1',
      );

      expect(eq).toHaveBeenCalledWith(
        organizationMembers.organizationId,
        'org-1',
      );

      // Both halves, and both the *same* predicate. The service hoists one `eq`
      // and reuses it, so page and count cannot drift apart — a count query
      // without it would report every org's member total.
      expect(wheres).toEqual([PREDICATE, PREDICATE]);
    });
  });
});
