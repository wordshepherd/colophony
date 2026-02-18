import { drizzle } from 'drizzle-orm/node-postgres';
import {
  pool,
  organizations,
  organizationMembers,
  users,
  eq,
  sql,
  type DrizzleDb,
} from '@colophony/db';
import type {
  CreateOrganizationInput,
  UpdateOrganizationInput,
  PaginationInput,
  Role,
} from '@colophony/types';
import { AuditActions, AuditResources } from '@colophony/types';
import type { ServiceContext, AuditFn } from './types.js';
import { NotFoundError } from './errors.js';

export class UserNotFoundError extends Error {
  constructor(email: string) {
    super(`User with email "${email}" not found`);
    this.name = 'UserNotFoundError';
  }
}

export class SlugTakenError extends Error {
  constructor(slug: string) {
    super(`Slug "${slug}" is already taken`);
    this.name = 'SlugTakenError';
  }
}

export class LastAdminError extends Error {
  constructor() {
    super('Cannot remove the last admin of an organization');
    this.name = 'LastAdminError';
  }
}

export const organizationService = {
  /**
   * List all organizations a user belongs to.
   * Uses SECURITY DEFINER function to bypass RLS (cross-tenant query).
   */
  async listUserOrganizations(userId: string) {
    const result = await pool.query<{
      organization_id: string;
      role: string;
      organization_name: string;
      slug: string;
    }>('SELECT * FROM list_user_organizations($1)', [userId]);
    return result.rows.map((row) => ({
      organizationId: row.organization_id,
      role: row.role as Role,
      name: row.organization_name,
      slug: row.slug,
    }));
  },

  /**
   * Create a new organization and add the creator as ADMIN.
   * Manages its own transaction because the org doesn't exist yet.
   */
  async create(input: CreateOrganizationInput, creatorUserId: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tx = drizzle(client);

      // Insert organization (no RLS on organizations table)
      const [org] = await tx
        .insert(organizations)
        .values({ name: input.name, slug: input.slug })
        .returning();

      // Set RLS context so the member INSERT passes the org_members policy
      await client.query('SELECT set_config($1, $2, true)', [
        'app.current_org',
        org.id,
      ]);
      await client.query('SELECT set_config($1, $2, true)', [
        'app.user_id',
        creatorUserId,
      ]);

      // Insert creator as ADMIN member
      const [member] = await tx
        .insert(organizationMembers)
        .values({
          organizationId: org.id,
          userId: creatorUserId,
          role: 'ADMIN',
        })
        .returning();

      await client.query('COMMIT');
      return { organization: org, membership: member };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  /**
   * Check if a slug is available (case-insensitive).
   * organizations table has no RLS — pool query is safe.
   */
  async isSlugAvailable(slug: string): Promise<boolean> {
    const result = await pool.query(
      'SELECT 1 FROM organizations WHERE lower(slug) = lower($1) LIMIT 1',
      [slug],
    );
    return result.rows.length === 0;
  },

  /**
   * Get organization by ID. Uses the request's RLS transaction.
   * organizations has no RLS so this works regardless of context.
   */
  async getById(tx: DrizzleDb, orgId: string) {
    const [org] = await tx
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    return org ?? null;
  },

  /**
   * Update an organization. Requires ADMIN role (enforced by tRPC middleware).
   */
  async update(tx: DrizzleDb, orgId: string, input: UpdateOrganizationInput) {
    const [updated] = await tx
      .update(organizations)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.settings !== undefined ? { settings: input.settings } : {}),
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, orgId))
      .returning();
    return updated ?? null;
  },

  /**
   * List members of the current organization (RLS filters by org context).
   */
  async listMembers(tx: DrizzleDb, pagination: PaginationInput) {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    const [members, countResult] = await Promise.all([
      tx
        .select({
          id: organizationMembers.id,
          userId: organizationMembers.userId,
          role: organizationMembers.role,
          email: users.email,
          createdAt: organizationMembers.createdAt,
        })
        .from(organizationMembers)
        .innerJoin(users, eq(organizationMembers.userId, users.id))
        .orderBy(organizationMembers.createdAt)
        .limit(limit)
        .offset(offset),
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(organizationMembers),
    ]);

    const total = countResult[0]?.count ?? 0;

    return {
      items: members,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Add a member to the organization. User must already exist (Zitadel sync).
   */
  async addMember(tx: DrizzleDb, orgId: string, email: string, role: Role) {
    // users table has no RLS — lookup by email works in any context
    const [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      throw new UserNotFoundError(email);
    }

    const [member] = await tx
      .insert(organizationMembers)
      .values({ organizationId: orgId, userId: user.id, role })
      .returning();

    return member;
  },

  /**
   * Remove a member from the organization.
   * Atomically prevents removing the last admin using FOR UPDATE row locks.
   *
   * When the target member is an ADMIN, locks all ADMIN rows in the same org
   * with FOR UPDATE before checking the count. This serializes concurrent
   * last-admin removal attempts within the same org, preventing both from
   * seeing count=2 and proceeding.
   */
  async removeMember(tx: DrizzleDb, memberId: string) {
    // First, fetch the member to check if they're an admin
    const [member] = await tx
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.id, memberId))
      .limit(1);

    if (!member) return null;

    if (member.role === 'ADMIN') {
      // Lock all admin rows in this org with FOR UPDATE and count them.
      // FOR UPDATE cannot be used with aggregates, so we select individual
      // rows and count in application code.
      const adminRows = await tx.execute<{ id: string }>(
        sql`SELECT id FROM organization_members WHERE organization_id = ${member.organizationId} AND role = 'ADMIN' FOR UPDATE`,
      );
      if (adminRows.rows.length <= 1) {
        throw new LastAdminError();
      }
    }

    const [deleted] = await tx
      .delete(organizationMembers)
      .where(eq(organizationMembers.id, memberId))
      .returning();
    return deleted ?? null;
  },

  /**
   * Update a member's role.
   */
  async updateMemberRole(tx: DrizzleDb, memberId: string, role: Role) {
    // If demoting an admin, check they aren't the last one
    if (role !== 'ADMIN') {
      const [member] = await tx
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.id, memberId))
        .limit(1);

      if (member?.role === 'ADMIN') {
        const adminRows = await tx.execute<{ id: string }>(
          sql`SELECT id FROM organization_members WHERE organization_id = ${member.organizationId} AND role = 'ADMIN' FOR UPDATE`,
        );
        if (adminRows.rows.length <= 1) {
          throw new LastAdminError();
        }
      }
    }

    const [updated] = await tx
      .update(organizationMembers)
      .set({ role, updatedAt: new Date() })
      .where(eq(organizationMembers.id, memberId))
      .returning();
    return updated ?? null;
  },

  // ---------------------------------------------------------------------------
  // Access-aware methods (PR 2) — bundle access control + audit
  // ---------------------------------------------------------------------------

  /**
   * Add a member with audit logging. Admin role enforced by tRPC middleware.
   */
  async addMemberWithAudit(svc: ServiceContext, email: string, role: Role) {
    const member = await organizationService.addMember(
      svc.tx,
      svc.actor.orgId,
      email,
      role,
    );
    await svc.audit({
      action: AuditActions.ORG_MEMBER_ADDED,
      resource: AuditResources.ORGANIZATION,
      resourceId: member.id,
      newValue: { email, role },
    });
    return member;
  },

  /**
   * Remove a member with audit logging. Admin role enforced by tRPC middleware.
   */
  async removeMemberWithAudit(svc: ServiceContext, memberId: string) {
    const deleted = await organizationService.removeMember(svc.tx, memberId);
    if (!deleted) throw new NotFoundError('Member not found');
    await svc.audit({
      action: AuditActions.ORG_MEMBER_REMOVED,
      resource: AuditResources.ORGANIZATION,
      resourceId: deleted.id,
      oldValue: { userId: deleted.userId, role: deleted.role },
    });
    return { success: true as const };
  },

  /**
   * Update a member's role with audit logging. Admin role enforced by tRPC middleware.
   */
  async updateMemberRoleWithAudit(
    svc: ServiceContext,
    memberId: string,
    role: Role,
  ) {
    const updated = await organizationService.updateMemberRole(
      svc.tx,
      memberId,
      role,
    );
    if (!updated) throw new NotFoundError('Member not found');
    await svc.audit({
      action: AuditActions.ORG_MEMBER_ROLE_CHANGED,
      resource: AuditResources.ORGANIZATION,
      resourceId: updated.id,
      newValue: { role },
    });
    return updated;
  },

  /**
   * Update an organization with audit logging. Admin role enforced by tRPC middleware.
   */
  async updateWithAudit(svc: ServiceContext, input: UpdateOrganizationInput) {
    const old = await organizationService.getById(svc.tx, svc.actor.orgId);
    const updated = await organizationService.update(
      svc.tx,
      svc.actor.orgId,
      input,
    );
    if (!updated) throw new NotFoundError('Organization not found');
    await svc.audit({
      action: AuditActions.ORG_UPDATED,
      resource: AuditResources.ORGANIZATION,
      resourceId: updated.id,
      oldValue: old ? { name: old.name, settings: old.settings } : undefined,
      newValue: input,
    });
    return updated;
  },

  /**
   * Create an organization with audit logging.
   * Special case: no org context exists yet, so takes AuditFn directly.
   */
  async createWithAudit(
    audit: AuditFn,
    input: CreateOrganizationInput,
    userId: string,
  ) {
    const result = await organizationService.create(input, userId);
    await audit({
      action: AuditActions.ORG_CREATED,
      resource: AuditResources.ORGANIZATION,
      resourceId: result.organization.id,
      newValue: { name: input.name, slug: input.slug },
    });
    return result;
  },
};
