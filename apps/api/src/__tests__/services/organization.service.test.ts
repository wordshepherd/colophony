/**
 * Organization service integration tests.
 *
 * Tests org CRUD, member management, and multi-org user access
 * with a real PostgreSQL instance and RLS enforcement.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { organizations, organizationMembers, users } from '@colophony/db';
import { eq, and } from 'drizzle-orm';
import { globalSetup } from '../rls/helpers/db-setup.js';
import { truncateAllTables } from '../rls/helpers/cleanup.js';
import { withTestRls } from '../rls/helpers/rls-context.js';
import {
  createOrganization,
  createUser,
  createOrgMember,
} from '../rls/helpers/factories.js';

beforeAll(async () => {
  await globalSetup();
});

afterEach(async () => {
  await truncateAllTables();
});

describe('organization service — integration', () => {
  describe('org CRUD', () => {
    it('creates an organization visible via admin pool', async () => {
      const org = await createOrganization({
        name: 'Test Literary Magazine',
        slug: 'test-lit-mag',
      });

      expect(org.name).toBe('Test Literary Magazine');
      expect(org.slug).toBe('test-lit-mag');
      expect(org.id).toBeDefined();
    });

    it('can read org details within org RLS context', async () => {
      const org = await createOrganization({ name: 'RLS Visible Org' });
      const user = await createUser();
      await createOrgMember(org.id, user.id);

      const fetched = await withTestRls({ orgId: org.id }, async (tx) => {
        const [row] = await tx
          .select()
          .from(organizations)
          .where(eq(organizations.id, org.id))
          .limit(1);
        return row;
      });

      expect(fetched).toBeDefined();
      expect(fetched.name).toBe('RLS Visible Org');
    });

    it('can update org name within org context', async () => {
      const org = await createOrganization({ name: 'Original Name' });
      const user = await createUser();
      await createOrgMember(org.id, user.id);

      const updated = await withTestRls({ orgId: org.id }, async (tx) => {
        const [row] = await tx
          .update(organizations)
          .set({ name: 'Updated Name' })
          .where(eq(organizations.id, org.id))
          .returning();
        return row;
      });

      expect(updated.name).toBe('Updated Name');
    });
  });

  describe('member management', () => {
    it('lists members within org context', async () => {
      const org = await createOrganization();
      const user1 = await createUser();
      const user2 = await createUser();
      await createOrgMember(org.id, user1.id, { role: 'ADMIN' });
      await createOrgMember(org.id, user2.id, { role: 'EDITOR' });

      const members = await withTestRls({ orgId: org.id }, async (tx) => {
        return tx
          .select()
          .from(organizationMembers)
          .where(eq(organizationMembers.organizationId, org.id));
      });

      expect(members).toHaveLength(2);
    });

    it('member role defaults are set correctly', async () => {
      const org = await createOrganization();
      const user = await createUser();
      const member = await createOrgMember(org.id, user.id, {
        role: 'EDITOR',
      });

      expect(member.role).toBe('EDITOR');
      expect(member.organizationId).toBe(org.id);
      expect(member.userId).toBe(user.id);
    });

    it('org B cannot see org A members', async () => {
      const orgA = await createOrganization();
      const orgB = await createOrganization();
      const userA = await createUser();
      const userB = await createUser();
      await createOrgMember(orgA.id, userA.id);
      await createOrgMember(orgB.id, userB.id);

      const membersFromB = await withTestRls({ orgId: orgB.id }, async (tx) => {
        return tx
          .select()
          .from(organizationMembers)
          .where(eq(organizationMembers.organizationId, orgA.id));
      });

      expect(membersFromB).toHaveLength(0);
    });
  });

  describe('multi-org user access', () => {
    it('user can be member of multiple orgs', async () => {
      const org1 = await createOrganization({ name: 'Org One' });
      const org2 = await createOrganization({ name: 'Org Two' });
      const user = await createUser();

      await createOrgMember(org1.id, user.id, { role: 'ADMIN' });
      await createOrgMember(org2.id, user.id, { role: 'EDITOR' });

      // User can see org1 members in org1 context
      const org1Members = await withTestRls({ orgId: org1.id }, async (tx) => {
        return tx.select().from(organizationMembers);
      });
      expect(org1Members).toHaveLength(1);
      expect(org1Members[0].userId).toBe(user.id);

      // User can see org2 members in org2 context
      const org2Members = await withTestRls({ orgId: org2.id }, async (tx) => {
        return tx.select().from(organizationMembers);
      });
      expect(org2Members).toHaveLength(1);
      expect(org2Members[0].userId).toBe(user.id);
    });

    it('user has different roles in different orgs', async () => {
      const org1 = await createOrganization();
      const org2 = await createOrganization();
      const user = await createUser();

      await createOrgMember(org1.id, user.id, { role: 'ADMIN' });
      await createOrgMember(org2.id, user.id, { role: 'READER' });

      const org1Member = await withTestRls({ orgId: org1.id }, async (tx) => {
        const [m] = await tx
          .select()
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.userId, user.id),
              eq(organizationMembers.organizationId, org1.id),
            ),
          )
          .limit(1);
        return m;
      });

      const org2Member = await withTestRls({ orgId: org2.id }, async (tx) => {
        const [m] = await tx
          .select()
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.userId, user.id),
              eq(organizationMembers.organizationId, org2.id),
            ),
          )
          .limit(1);
        return m;
      });

      expect(org1Member.role).toBe('ADMIN');
      expect(org2Member.role).toBe('READER');
    });
  });
});
