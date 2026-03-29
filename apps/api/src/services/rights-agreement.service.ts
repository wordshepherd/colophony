import {
  rightsAgreements,
  contributors,
  pipelineItems,
  submissions,
  eq,
  and,
  gte,
  lte,
  not,
  isNull,
  type DrizzleDb,
} from '@colophony/db';
import { count } from 'drizzle-orm';
import type {
  CreateRightsAgreementInput,
  UpdateRightsAgreementInput,
  ListRightsAgreementsInput,
  TransitionRightsAgreementStatusInput,
  RightsAgreementStatus,
} from '@colophony/types';
import {
  AuditActions,
  AuditResources,
  VALID_RIGHTS_STATUS_TRANSITIONS,
  type AuditAction,
} from '@colophony/types';
import type { ServiceContext } from './types.js';
import { assertBusinessOpsOrAdmin } from './errors.js';
import { PipelineItemNotInOrgError } from './contributor.service.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class RightsAgreementNotFoundError extends Error {
  constructor(id: string) {
    super(`Rights agreement "${id}" not found`);
    this.name = 'RightsAgreementNotFoundError';
  }
}

export class InvalidRightsStatusTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot transition rights agreement from "${from}" to "${to}"`);
    this.name = 'InvalidRightsStatusTransitionError';
  }
}

export class ContributorNotInOrgError extends Error {
  constructor(contributorId: string) {
    super(
      `Contributor "${contributorId}" does not belong to this organization`,
    );
    this.name = 'ContributorNotInOrgError';
  }
}

// ---------------------------------------------------------------------------
// Audit action map for status transitions
// ---------------------------------------------------------------------------

const STATUS_AUDIT_ACTION: Record<
  Exclude<RightsAgreementStatus, 'DRAFT'>,
  AuditAction
> = {
  SENT: AuditActions.RIGHTS_AGREEMENT_SENT,
  SIGNED: AuditActions.RIGHTS_AGREEMENT_SIGNED,
  ACTIVE: AuditActions.RIGHTS_AGREEMENT_ACTIVATED,
  REVERTED: AuditActions.RIGHTS_AGREEMENT_REVERTED,
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const rightsAgreementService = {
  // -------------------------------------------------------------------------
  // Pure data methods
  // -------------------------------------------------------------------------

  async list(tx: DrizzleDb, input: ListRightsAgreementsInput, orgId: string) {
    const { page, limit } = input;
    const offset = (page - 1) * limit;

    const conditions = [eq(rightsAgreements.organizationId, orgId)];

    if (input.contributorId) {
      conditions.push(eq(rightsAgreements.contributorId, input.contributorId));
    }
    if (input.pipelineItemId) {
      conditions.push(
        eq(rightsAgreements.pipelineItemId, input.pipelineItemId),
      );
    }
    if (input.status) {
      conditions.push(eq(rightsAgreements.status, input.status));
    }
    if (input.rightsType) {
      conditions.push(eq(rightsAgreements.rightsType, input.rightsType));
    }

    const where = and(...conditions);

    const [items, [{ total }]] = await Promise.all([
      tx
        .select({
          id: rightsAgreements.id,
          organizationId: rightsAgreements.organizationId,
          contributorId: rightsAgreements.contributorId,
          pipelineItemId: rightsAgreements.pipelineItemId,
          rightsType: rightsAgreements.rightsType,
          customDescription: rightsAgreements.customDescription,
          status: rightsAgreements.status,
          grantedAt: rightsAgreements.grantedAt,
          expiresAt: rightsAgreements.expiresAt,
          revertedAt: rightsAgreements.revertedAt,
          notes: rightsAgreements.notes,
          createdAt: rightsAgreements.createdAt,
          updatedAt: rightsAgreements.updatedAt,
          contributorName: contributors.displayName,
          pipelineItemTitle: submissions.title,
        })
        .from(rightsAgreements)
        .innerJoin(
          contributors,
          eq(rightsAgreements.contributorId, contributors.id),
        )
        .leftJoin(
          pipelineItems,
          eq(rightsAgreements.pipelineItemId, pipelineItems.id),
        )
        .leftJoin(submissions, eq(pipelineItems.submissionId, submissions.id))
        .where(where)
        .orderBy(rightsAgreements.createdAt)
        .limit(limit)
        .offset(offset),
      tx.select({ total: count() }).from(rightsAgreements).where(where),
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
      .from(rightsAgreements)
      .where(
        and(
          eq(rightsAgreements.id, id),
          eq(rightsAgreements.organizationId, orgId),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  async getUpcomingReversions(
    tx: DrizzleDb,
    orgId: string,
    withinDays: number,
  ) {
    const now = new Date();
    const deadline = new Date(now.getTime() + withinDays * 86_400_000);

    return tx
      .select()
      .from(rightsAgreements)
      .where(
        and(
          eq(rightsAgreements.organizationId, orgId),
          eq(rightsAgreements.status, 'ACTIVE'),
          not(isNull(rightsAgreements.expiresAt)),
          gte(rightsAgreements.expiresAt, now),
          lte(rightsAgreements.expiresAt, deadline),
        ),
      )
      .orderBy(rightsAgreements.expiresAt)
      .limit(100);
  },

  // -------------------------------------------------------------------------
  // Audit-wrapped methods
  // -------------------------------------------------------------------------

  async createWithAudit(
    ctx: ServiceContext,
    input: CreateRightsAgreementInput,
  ) {
    assertBusinessOpsOrAdmin(ctx.actor.roles);

    // Validate contributor belongs to org
    const [contributor] = await ctx.tx
      .select({ id: contributors.id })
      .from(contributors)
      .where(
        and(
          eq(contributors.id, input.contributorId),
          eq(contributors.organizationId, ctx.actor.orgId),
        ),
      )
      .limit(1);
    if (!contributor) throw new ContributorNotInOrgError(input.contributorId);

    // Validate pipeline item belongs to org (if provided)
    if (input.pipelineItemId) {
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
    }

    const [agreement] = await ctx.tx
      .insert(rightsAgreements)
      .values({
        organizationId: ctx.actor.orgId,
        contributorId: input.contributorId,
        pipelineItemId: input.pipelineItemId ?? null,
        rightsType: input.rightsType,
        customDescription: input.customDescription ?? null,
        expiresAt: input.expiresAt ?? null,
        notes: input.notes ?? null,
      })
      .returning();

    await ctx.audit({
      action: AuditActions.RIGHTS_AGREEMENT_CREATED,
      resource: AuditResources.RIGHTS_AGREEMENT,
      resourceId: agreement.id,
      newValue: {
        contributorId: agreement.contributorId,
        rightsType: agreement.rightsType,
        status: agreement.status,
      },
    });

    return agreement;
  },

  async updateWithAudit(
    ctx: ServiceContext,
    input: UpdateRightsAgreementInput,
  ) {
    assertBusinessOpsOrAdmin(ctx.actor.roles);

    const existing = await rightsAgreementService.getById(
      ctx.tx,
      input.id,
      ctx.actor.orgId,
    );
    if (!existing) throw new RightsAgreementNotFoundError(input.id);

    // Build update payload excluding id and undefined values
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (key !== 'id' && value !== undefined) {
        updateData[key] = value;
      }
    }

    const [updated] = await ctx.tx
      .update(rightsAgreements)
      .set(updateData)
      .where(
        and(
          eq(rightsAgreements.id, input.id),
          eq(rightsAgreements.organizationId, ctx.actor.orgId),
        ),
      )
      .returning();

    await ctx.audit({
      action: AuditActions.RIGHTS_AGREEMENT_UPDATED,
      resource: AuditResources.RIGHTS_AGREEMENT,
      resourceId: input.id,
      oldValue: {
        rightsType: existing.rightsType,
        expiresAt: existing.expiresAt,
        notes: existing.notes,
      },
      newValue: {
        rightsType: updated.rightsType,
        expiresAt: updated.expiresAt,
        notes: updated.notes,
      },
    });

    return updated;
  },

  async transitionStatusWithAudit(
    ctx: ServiceContext,
    input: TransitionRightsAgreementStatusInput,
  ) {
    assertBusinessOpsOrAdmin(ctx.actor.roles);

    const existing = await rightsAgreementService.getById(
      ctx.tx,
      input.id,
      ctx.actor.orgId,
    );
    if (!existing) throw new RightsAgreementNotFoundError(input.id);

    const allowed = VALID_RIGHTS_STATUS_TRANSITIONS[existing.status];
    if (!allowed.includes(input.status)) {
      throw new InvalidRightsStatusTransitionError(
        existing.status,
        input.status,
      );
    }

    // Build update payload with timestamp side effects
    const updateData: Record<string, unknown> = { status: input.status };

    if (input.status === 'ACTIVE' && !existing.grantedAt) {
      updateData.grantedAt = new Date();
    }
    if (input.status === 'REVERTED') {
      updateData.revertedAt = new Date();
    }

    const [updated] = await ctx.tx
      .update(rightsAgreements)
      .set(updateData)
      .where(
        and(
          eq(rightsAgreements.id, input.id),
          eq(rightsAgreements.organizationId, ctx.actor.orgId),
        ),
      )
      .returning();

    await ctx.audit({
      action:
        STATUS_AUDIT_ACTION[
          input.status as Exclude<RightsAgreementStatus, 'DRAFT'>
        ],
      resource: AuditResources.RIGHTS_AGREEMENT,
      resourceId: input.id,
      oldValue: { status: existing.status },
      newValue: { status: input.status },
    });

    return updated;
  },

  async deleteWithAudit(ctx: ServiceContext, id: string) {
    assertBusinessOpsOrAdmin(ctx.actor.roles);

    const existing = await rightsAgreementService.getById(
      ctx.tx,
      id,
      ctx.actor.orgId,
    );
    if (!existing) throw new RightsAgreementNotFoundError(id);

    await ctx.tx
      .delete(rightsAgreements)
      .where(
        and(
          eq(rightsAgreements.id, id),
          eq(rightsAgreements.organizationId, ctx.actor.orgId),
        ),
      );

    await ctx.audit({
      action: AuditActions.RIGHTS_AGREEMENT_DELETED,
      resource: AuditResources.RIGHTS_AGREEMENT,
      resourceId: id,
      oldValue: {
        contributorId: existing.contributorId,
        rightsType: existing.rightsType,
        status: existing.status,
      },
    });
  },
};
