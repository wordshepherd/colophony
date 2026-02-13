import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { organizationMembers, organizations } from '@colophony/db';
import { globalSetup, getAdminPool, getAppPool } from './helpers/db-setup';
import { truncateAllTables } from './helpers/cleanup';
import {
  createOrganization,
  createUser,
  createOrgMember,
} from './helpers/factories';
import { withTestRls } from './helpers/rls-context';

describe('Organization Service RLS Integration', () => {
  beforeAll(async () => {
    await globalSetup();
    await truncateAllTables();
  });

  afterAll(async () => {
    await truncateAllTables();
  });

  describe('list_user_organizations() SECURITY DEFINER function', () => {
    it('returns all orgs for a user when called as app_user', async () => {
      const orgA = await createOrganization({ name: 'Org Alpha' });
      const orgB = await createOrganization({ name: 'Org Beta' });
      const user = await createUser();
      await createOrgMember(orgA.id, user.id, { role: 'ADMIN' });
      await createOrgMember(orgB.id, user.id, { role: 'READER' });

      // Call as app_user (subject to RLS) — SECURITY DEFINER should bypass
      const appPool = getAppPool();
      const result = await appPool.query<{
        organization_id: string;
        role: string;
        organization_name: string;
        slug: string;
      }>('SELECT * FROM list_user_organizations($1)', [user.id]);

      expect(result.rows).toHaveLength(2);
      const names = result.rows.map((r) => r.organization_name).sort();
      expect(names).toEqual(['Org Alpha', 'Org Beta']);

      // Verify roles are correct
      const alphaRow = result.rows.find(
        (r) => r.organization_name === 'Org Alpha',
      );
      expect(alphaRow?.role).toBe('ADMIN');
      const betaRow = result.rows.find(
        (r) => r.organization_name === 'Org Beta',
      );
      expect(betaRow?.role).toBe('READER');
    });

    it('returns empty array for user with no memberships', async () => {
      const user = await createUser();
      const appPool = getAppPool();
      const result = await appPool.query(
        'SELECT * FROM list_user_organizations($1)',
        [user.id],
      );
      expect(result.rows).toHaveLength(0);
    });
  });

  describe('create() atomicity', () => {
    it('creates org and ADMIN member atomically via pool', async () => {
      const user = await createUser();
      const appPool = getAppPool();
      const client = await appPool.connect();

      try {
        await client.query('BEGIN');
        const tx = drizzle(client);

        // Insert org (no RLS on organizations table)
        const [org] = await tx
          .insert(organizations)
          .values({ name: 'Atomic Org', slug: `atomic-${Date.now()}` })
          .returning();

        // Set RLS context for member insert
        await client.query('SELECT set_config($1, $2, true)', [
          'app.current_org',
          org.id,
        ]);
        await client.query('SELECT set_config($1, $2, true)', [
          'app.user_id',
          user.id,
        ]);

        // Insert creator as ADMIN
        const [member] = await tx
          .insert(organizationMembers)
          .values({
            organizationId: org.id,
            userId: user.id,
            role: 'ADMIN',
          })
          .returning();

        await client.query('COMMIT');

        expect(org.id).toBeDefined();
        expect(member.organizationId).toBe(org.id);
        expect(member.role).toBe('ADMIN');

        // Verify via admin pool
        const adminDb = drizzle(getAdminPool());
        const [verifiedMember] = await adminDb
          .select()
          .from(organizationMembers)
          .where(eq(organizationMembers.organizationId, org.id));
        expect(verifiedMember.userId).toBe(user.id);
      } finally {
        client.release();
      }
    });

    it('duplicate slug triggers unique constraint error', async () => {
      const slug = `dup-slug-${Date.now()}`;
      await createOrganization({ slug });

      const appPool = getAppPool();
      await expect(
        appPool.query(
          'INSERT INTO organizations (name, slug) VALUES ($1, $2)',
          ['Dup Org', slug],
        ),
      ).rejects.toThrow();
    });
  });

  describe('org-context hook RLS-native bootstrap', () => {
    it('temporary read-only tx correctly resolves membership', async () => {
      const org = await createOrganization();
      const user = await createUser();
      await createOrgMember(org.id, user.id, { role: 'EDITOR' });

      // Simulate the org-context hook's bootstrap pattern
      const appPool = getAppPool();
      const client = await appPool.connect();
      try {
        await client.query('BEGIN READ ONLY');
        await client.query('SELECT set_config($1, $2, true)', [
          'app.current_org',
          org.id,
        ]);
        await client.query('SELECT set_config($1, $2, true)', [
          'app.user_id',
          user.id,
        ]);
        const result = await client.query<{ role: string }>(
          'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
          [org.id, user.id],
        );
        await client.query('COMMIT');

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].role).toBe('EDITOR');
      } finally {
        client.release();
      }
    });

    it('returns no rows for non-member in bootstrap tx', async () => {
      const org = await createOrganization();
      const user = await createUser(); // Not a member

      const appPool = getAppPool();
      const client = await appPool.connect();
      try {
        await client.query('BEGIN READ ONLY');
        await client.query('SELECT set_config($1, $2, true)', [
          'app.current_org',
          org.id,
        ]);
        await client.query('SELECT set_config($1, $2, true)', [
          'app.user_id',
          user.id,
        ]);
        const result = await client.query(
          'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
          [org.id, user.id],
        );
        await client.query('COMMIT');

        expect(result.rows).toHaveLength(0);
      } finally {
        client.release();
      }
    });
  });

  describe('listMembers RLS isolation', () => {
    it('org A context sees only org A members', async () => {
      const orgA = await createOrganization();
      const orgB = await createOrganization();
      const userA = await createUser();
      const userB = await createUser();
      await createOrgMember(orgA.id, userA.id);
      await createOrgMember(orgB.id, userB.id);

      // Query members with org A context
      const membersA = await withTestRls(
        { orgId: orgA.id, userId: userA.id },
        (tx) => tx.select().from(organizationMembers),
      );
      expect(membersA).toHaveLength(1);
      expect(membersA[0].userId).toBe(userA.id);

      // Query members with org B context
      const membersB = await withTestRls(
        { orgId: orgB.id, userId: userB.id },
        (tx) => tx.select().from(organizationMembers),
      );
      expect(membersB).toHaveLength(1);
      expect(membersB[0].userId).toBe(userB.id);
    });
  });

  describe('addMember + removeMember cross-org isolation', () => {
    it('added member visible within same org, invisible to other org', async () => {
      const orgA = await createOrganization();
      const orgB = await createOrganization();
      const userA = await createUser();
      const userB = await createUser();
      const userNew = await createUser();
      await createOrgMember(orgA.id, userA.id, { role: 'ADMIN' });
      await createOrgMember(orgB.id, userB.id, { role: 'ADMIN' });

      // Add new user to org A via admin pool (bypasses RLS for setup)
      await createOrgMember(orgA.id, userNew.id, { role: 'READER' });

      // Visible from org A
      const membersA = await withTestRls(
        { orgId: orgA.id, userId: userA.id },
        (tx) => tx.select().from(organizationMembers),
      );
      expect(membersA).toHaveLength(2);
      const userIds = membersA.map((m) => m.userId);
      expect(userIds).toContain(userNew.id);

      // Invisible from org B
      const membersB = await withTestRls(
        { orgId: orgB.id, userId: userB.id },
        (tx) => tx.select().from(organizationMembers),
      );
      expect(membersB).toHaveLength(1);
      expect(membersB[0].userId).toBe(userB.id);
    });
  });

  describe('updateMemberRole within org context', () => {
    it('can update member role within same org context', async () => {
      const org = await createOrganization();
      const admin = await createUser();
      const member = await createOrgMember(org.id, admin.id, {
        role: 'READER',
      });

      const updated = await withTestRls(
        { orgId: org.id, userId: admin.id },
        async (tx) => {
          const [result] = await tx
            .update(organizationMembers)
            .set({ role: 'EDITOR' })
            .where(eq(organizationMembers.id, member.id))
            .returning();
          return result;
        },
      );

      expect(updated.role).toBe('EDITOR');
    });
  });

  describe('cross-org isolation', () => {
    it('cannot see or modify other org members', async () => {
      const orgA = await createOrganization();
      const orgB = await createOrganization();
      const userA = await createUser();
      const userB = await createUser();
      const memberA = await createOrgMember(orgA.id, userA.id);
      await createOrgMember(orgB.id, userB.id);

      // Org B context cannot see org A's member by ID
      const result = await withTestRls(
        { orgId: orgB.id, userId: userB.id },
        (tx) =>
          tx
            .select()
            .from(organizationMembers)
            .where(eq(organizationMembers.id, memberA.id)),
      );
      expect(result).toHaveLength(0);

      // Org B context cannot update org A's member (update affects 0 rows)
      const updateResult = await withTestRls(
        { orgId: orgB.id, userId: userB.id },
        async (tx) => {
          const rows = await tx
            .update(organizationMembers)
            .set({ role: 'ADMIN' })
            .where(eq(organizationMembers.id, memberA.id))
            .returning();
          return rows;
        },
      );
      expect(updateResult).toHaveLength(0);

      // Verify org A's member is unchanged (via admin pool)
      const adminDb = drizzle(getAdminPool());
      const [verified] = await adminDb
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.id, memberA.id));
      expect(verified.role).toBe('ADMIN'); // unchanged from factory default
    });
  });
});
