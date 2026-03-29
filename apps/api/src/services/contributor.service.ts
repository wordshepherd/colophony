import {
  contributors,
  contributorPublications,
  pipelineItems,
  eq,
  and,
  type DrizzleDb,
} from '@colophony/db';
import { ilike, count } from 'drizzle-orm';
import type {
  CreateContributorInput,
  UpdateContributorInput,
  ListContributorsInput,
  AddContributorPublicationInput,
  RemoveContributorPublicationInput,
} from '@colophony/types';
import { AuditActions, AuditResources } from '@colophony/types';
import type { ServiceContext } from './types.js';
import { assertBusinessOpsOrAdmin } from './errors.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class ContributorNotFoundError extends Error {
  constructor(id: string) {
    super(`Contributor "${id}" not found`);
    this.name = 'ContributorNotFoundError';
  }
}

export class ContributorAlreadyLinkedError extends Error {
  constructor(userId: string) {
    super(`A contributor is already linked to user "${userId}" in this org`);
    this.name = 'ContributorAlreadyLinkedError';
  }
}

export class ContributorPublicationDuplicateError extends Error {
  constructor() {
    super('This contributor already has this role on this publication');
    this.name = 'ContributorPublicationDuplicateError';
  }
}

export class PipelineItemNotInOrgError extends Error {
  constructor(pipelineItemId: string) {
    super(
      `Pipeline item "${pipelineItemId}" does not belong to this organization`,
    );
    this.name = 'PipelineItemNotInOrgError';
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const contributorService = {
  // -------------------------------------------------------------------------
  // Pure data methods
  // -------------------------------------------------------------------------

  async list(tx: DrizzleDb, input: ListContributorsInput, orgId: string) {
    const { search, page, limit } = input;
    const offset = (page - 1) * limit;

    const conditions = [eq(contributors.organizationId, orgId)];

    if (search) {
      conditions.push(ilike(contributors.displayName, `%${search}%`));
    }

    const where = and(...conditions);

    const [items, [{ total }]] = await Promise.all([
      tx
        .select()
        .from(contributors)
        .where(where)
        .orderBy(contributors.displayName)
        .limit(limit)
        .offset(offset),
      tx.select({ total: count() }).from(contributors).where(where),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  async getById(tx: DrizzleDb, id: string, orgId: string) {
    const [row] = await tx
      .select()
      .from(contributors)
      .where(
        and(eq(contributors.id, id), eq(contributors.organizationId, orgId)),
      )
      .limit(1);
    return row ?? null;
  },

  async getByUserId(tx: DrizzleDb, userId: string, orgId: string) {
    const [row] = await tx
      .select()
      .from(contributors)
      .where(
        and(
          eq(contributors.userId, userId),
          eq(contributors.organizationId, orgId),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  async listPublications(tx: DrizzleDb, contributorId: string) {
    return tx
      .select()
      .from(contributorPublications)
      .where(eq(contributorPublications.contributorId, contributorId))
      .orderBy(contributorPublications.displayOrder);
  },

  // -------------------------------------------------------------------------
  // Audit-wrapped methods
  // -------------------------------------------------------------------------

  async createWithAudit(ctx: ServiceContext, input: CreateContributorInput) {
    assertBusinessOpsOrAdmin(ctx.actor.roles);

    // If linking to a user, check for existing link
    if (input.userId) {
      const existing = await contributorService.getByUserId(
        ctx.tx,
        input.userId,
        ctx.actor.orgId,
      );
      if (existing) {
        throw new ContributorAlreadyLinkedError(input.userId);
      }
    }

    const [contributor] = await ctx.tx
      .insert(contributors)
      .values({
        organizationId: ctx.actor.orgId,
        displayName: input.displayName,
        bio: input.bio ?? null,
        pronouns: input.pronouns ?? null,
        email: input.email ?? null,
        website: input.website ?? null,
        mailingAddress: input.mailingAddress ?? null,
        notes: input.notes ?? null,
        userId: input.userId ?? null,
      })
      .returning();

    await ctx.audit({
      action: AuditActions.CONTRIBUTOR_CREATED,
      resource: AuditResources.CONTRIBUTOR,
      resourceId: contributor.id,
      newValue: {
        displayName: contributor.displayName,
        userId: contributor.userId,
      },
    });

    return contributor;
  },

  async updateWithAudit(ctx: ServiceContext, input: UpdateContributorInput) {
    assertBusinessOpsOrAdmin(ctx.actor.roles);

    const existing = await contributorService.getById(
      ctx.tx,
      input.id,
      ctx.actor.orgId,
    );
    if (!existing) throw new ContributorNotFoundError(input.id);

    // Check userId link changes
    const userIdChanging =
      input.userId !== undefined && input.userId !== existing.userId;

    if (userIdChanging && input.userId) {
      const linkedToOther = await contributorService.getByUserId(
        ctx.tx,
        input.userId,
        ctx.actor.orgId,
      );
      if (linkedToOther && linkedToOther.id !== existing.id) {
        throw new ContributorAlreadyLinkedError(input.userId);
      }
    }

    // Build update payload excluding id and undefined values
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (key !== 'id' && value !== undefined) {
        updateData[key] = value;
      }
    }

    const [updated] = await ctx.tx
      .update(contributors)
      .set(updateData)
      .where(
        and(
          eq(contributors.id, input.id),
          eq(contributors.organizationId, ctx.actor.orgId),
        ),
      )
      .returning();

    await ctx.audit({
      action: AuditActions.CONTRIBUTOR_UPDATED,
      resource: AuditResources.CONTRIBUTOR,
      resourceId: input.id,
      oldValue: { displayName: existing.displayName, userId: existing.userId },
      newValue: { displayName: updated.displayName, userId: updated.userId },
    });

    // Audit link/unlink separately
    if (userIdChanging) {
      if (existing.userId && !input.userId) {
        await ctx.audit({
          action: AuditActions.CONTRIBUTOR_UNLINKED,
          resource: AuditResources.CONTRIBUTOR,
          resourceId: input.id,
          oldValue: { userId: existing.userId },
        });
      } else if (input.userId) {
        await ctx.audit({
          action: AuditActions.CONTRIBUTOR_LINKED,
          resource: AuditResources.CONTRIBUTOR,
          resourceId: input.id,
          newValue: { userId: input.userId },
        });
      }
    }

    return updated;
  },

  async deleteWithAudit(ctx: ServiceContext, id: string) {
    assertBusinessOpsOrAdmin(ctx.actor.roles);

    const existing = await contributorService.getById(
      ctx.tx,
      id,
      ctx.actor.orgId,
    );
    if (!existing) throw new ContributorNotFoundError(id);

    await ctx.tx
      .delete(contributors)
      .where(
        and(
          eq(contributors.id, id),
          eq(contributors.organizationId, ctx.actor.orgId),
        ),
      );

    await ctx.audit({
      action: AuditActions.CONTRIBUTOR_DELETED,
      resource: AuditResources.CONTRIBUTOR,
      resourceId: id,
      oldValue: { displayName: existing.displayName },
    });
  },

  async addPublicationWithAudit(
    ctx: ServiceContext,
    input: AddContributorPublicationInput,
  ) {
    assertBusinessOpsOrAdmin(ctx.actor.roles);

    // Defense-in-depth: verify pipeline item belongs to current org
    const [item] = await ctx.tx
      .select({ id: pipelineItems.id })
      .from(pipelineItems)
      .where(
        and(
          eq(pipelineItems.id, input.pipelineItemId),
          eq(pipelineItems.organizationId, ctx.actor.orgId),
        ),
      )
      .limit(1);
    if (!item) throw new PipelineItemNotInOrgError(input.pipelineItemId);

    try {
      const [pub] = await ctx.tx
        .insert(contributorPublications)
        .values({
          contributorId: input.contributorId,
          pipelineItemId: input.pipelineItemId,
          role: input.role,
          displayOrder: input.displayOrder,
        })
        .returning();

      await ctx.audit({
        action: AuditActions.CONTRIBUTOR_PUBLICATION_ADDED,
        resource: AuditResources.CONTRIBUTOR,
        resourceId: input.contributorId,
        newValue: {
          pipelineItemId: input.pipelineItemId,
          role: input.role,
        },
      });

      return pub;
    } catch (e: unknown) {
      if (
        e instanceof Error &&
        e.message.includes('contributor_publications_contributor_item_role_idx')
      ) {
        throw new ContributorPublicationDuplicateError();
      }
      throw e;
    }
  },

  async removePublicationWithAudit(
    ctx: ServiceContext,
    input: RemoveContributorPublicationInput,
  ) {
    assertBusinessOpsOrAdmin(ctx.actor.roles);

    await ctx.tx
      .delete(contributorPublications)
      .where(
        and(
          eq(contributorPublications.contributorId, input.contributorId),
          eq(contributorPublications.pipelineItemId, input.pipelineItemId),
          eq(contributorPublications.role, input.role),
        ),
      );

    await ctx.audit({
      action: AuditActions.CONTRIBUTOR_PUBLICATION_REMOVED,
      resource: AuditResources.CONTRIBUTOR,
      resourceId: input.contributorId,
      oldValue: {
        pipelineItemId: input.pipelineItemId,
        role: input.role,
      },
    });
  },
};
