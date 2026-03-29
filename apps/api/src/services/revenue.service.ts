import {
  paymentTransactions,
  contributors,
  eq,
  and,
  type DrizzleDb,
} from '@colophony/db';
import { count, sql } from 'drizzle-orm';
import type {
  CreatePaymentTransactionInput,
  UpdatePaymentTransactionInput,
  ListPaymentTransactionsInput,
  TransitionPaymentTransactionStatusInput,
} from '@colophony/types';
import {
  AuditActions,
  AuditResources,
  VALID_PAYMENT_STATUS_TRANSITIONS,
} from '@colophony/types';
import type { ServiceContext } from './types.js';
import { assertBusinessOpsOrAdmin } from './errors.js';
import { ContributorNotInOrgError } from './rights-agreement.service.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class PaymentTransactionNotFoundError extends Error {
  constructor(id: string) {
    super(`Payment transaction "${id}" not found`);
    this.name = 'PaymentTransactionNotFoundError';
  }
}

export class InvalidPaymentStatusTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot transition payment from "${from}" to "${to}"`);
    this.name = 'InvalidPaymentStatusTransitionError';
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const revenueService = {
  // -------------------------------------------------------------------------
  // Pure data methods
  // -------------------------------------------------------------------------

  async list(
    tx: DrizzleDb,
    input: ListPaymentTransactionsInput,
    orgId: string,
  ) {
    const { page, limit } = input;
    const offset = (page - 1) * limit;

    const conditions = [eq(paymentTransactions.organizationId, orgId)];

    if (input.type) {
      conditions.push(eq(paymentTransactions.type, input.type));
    }
    if (input.direction) {
      conditions.push(eq(paymentTransactions.direction, input.direction));
    }
    if (input.contributorId) {
      conditions.push(
        eq(paymentTransactions.contributorId, input.contributorId),
      );
    }
    if (input.status) {
      conditions.push(eq(paymentTransactions.status, input.status));
    }

    const where = and(...conditions);

    const [items, [{ total }]] = await Promise.all([
      tx
        .select({
          id: paymentTransactions.id,
          organizationId: paymentTransactions.organizationId,
          contributorId: paymentTransactions.contributorId,
          submissionId: paymentTransactions.submissionId,
          paymentId: paymentTransactions.paymentId,
          type: paymentTransactions.type,
          direction: paymentTransactions.direction,
          amount: paymentTransactions.amount,
          currency: paymentTransactions.currency,
          status: paymentTransactions.status,
          description: paymentTransactions.description,
          metadata: paymentTransactions.metadata,
          processedAt: paymentTransactions.processedAt,
          createdAt: paymentTransactions.createdAt,
          updatedAt: paymentTransactions.updatedAt,
          contributorName: contributors.displayName,
        })
        .from(paymentTransactions)
        .leftJoin(
          contributors,
          eq(paymentTransactions.contributorId, contributors.id),
        )
        .where(where)
        .orderBy(paymentTransactions.createdAt)
        .limit(limit)
        .offset(offset),
      tx.select({ total: count() }).from(paymentTransactions).where(where),
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
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.id, id),
          eq(paymentTransactions.organizationId, orgId),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  async getSummary(tx: DrizzleDb, orgId: string) {
    const orgCondition = eq(paymentTransactions.organizationId, orgId);

    const [[totals], typeCounts, statusCounts] = await Promise.all([
      tx
        .select({
          totalInbound: sql<string>`COALESCE(SUM(CASE WHEN ${paymentTransactions.direction} = 'inbound' AND ${paymentTransactions.status} = 'SUCCEEDED' THEN ${paymentTransactions.amount} ELSE 0 END), 0)`,
          totalOutbound: sql<string>`COALESCE(SUM(CASE WHEN ${paymentTransactions.direction} = 'outbound' AND ${paymentTransactions.status} = 'SUCCEEDED' THEN ${paymentTransactions.amount} ELSE 0 END), 0)`,
        })
        .from(paymentTransactions)
        .where(orgCondition),
      tx
        .select({
          type: paymentTransactions.type,
          count: count(),
        })
        .from(paymentTransactions)
        .where(orgCondition)
        .groupBy(paymentTransactions.type),
      tx
        .select({
          status: paymentTransactions.status,
          count: count(),
        })
        .from(paymentTransactions)
        .where(orgCondition)
        .groupBy(paymentTransactions.status),
    ]);

    // SUM(integer) returns bigint in PostgreSQL; parse safely to avoid ::int overflow
    const totalInbound = Number(totals.totalInbound);
    const totalOutbound = Number(totals.totalOutbound);

    return {
      totalInbound,
      totalOutbound,
      net: totalInbound - totalOutbound,
      countByType: Object.fromEntries(typeCounts.map((r) => [r.type, r.count])),
      countByStatus: Object.fromEntries(
        statusCounts.map((r) => [r.status, r.count]),
      ),
    };
  },

  // -------------------------------------------------------------------------
  // Audit-wrapped methods
  // -------------------------------------------------------------------------

  async createWithAudit(
    ctx: ServiceContext,
    input: CreatePaymentTransactionInput,
  ) {
    assertBusinessOpsOrAdmin(ctx.actor.roles);

    // Validate contributor belongs to org (if provided)
    if (input.contributorId) {
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
    }

    const [transaction] = await ctx.tx
      .insert(paymentTransactions)
      .values({
        organizationId: ctx.actor.orgId,
        contributorId: input.contributorId ?? null,
        submissionId: input.submissionId ?? null,
        paymentId: input.paymentId ?? null,
        type: input.type,
        direction: input.direction,
        amount: input.amount,
        currency: input.currency ?? 'usd',
        description: input.description ?? null,
        metadata: input.metadata ?? null,
      })
      .returning();

    await ctx.audit({
      action: AuditActions.PAYMENT_TRANSACTION_CREATED,
      resource: AuditResources.PAYMENT_TRANSACTION,
      resourceId: transaction.id,
      newValue: {
        type: transaction.type,
        direction: transaction.direction,
        amount: transaction.amount,
        status: transaction.status,
      },
    });

    return transaction;
  },

  async updateWithAudit(
    ctx: ServiceContext,
    input: UpdatePaymentTransactionInput,
  ) {
    assertBusinessOpsOrAdmin(ctx.actor.roles);

    const existing = await revenueService.getById(
      ctx.tx,
      input.id,
      ctx.actor.orgId,
    );
    if (!existing) throw new PaymentTransactionNotFoundError(input.id);

    // Build update payload excluding id and undefined values
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (key !== 'id' && value !== undefined) {
        updateData[key] = value;
      }
    }

    const [updated] = await ctx.tx
      .update(paymentTransactions)
      .set(updateData)
      .where(
        and(
          eq(paymentTransactions.id, input.id),
          eq(paymentTransactions.organizationId, ctx.actor.orgId),
        ),
      )
      .returning();

    await ctx.audit({
      action: AuditActions.PAYMENT_TRANSACTION_UPDATED,
      resource: AuditResources.PAYMENT_TRANSACTION,
      resourceId: input.id,
      oldValue: {
        description: existing.description,
        metadata: existing.metadata,
      },
      newValue: {
        description: updated.description,
        metadata: updated.metadata,
      },
    });

    return updated;
  },

  async transitionStatusWithAudit(
    ctx: ServiceContext,
    input: TransitionPaymentTransactionStatusInput,
  ) {
    assertBusinessOpsOrAdmin(ctx.actor.roles);

    const existing = await revenueService.getById(
      ctx.tx,
      input.id,
      ctx.actor.orgId,
    );
    if (!existing) throw new PaymentTransactionNotFoundError(input.id);

    const allowed = VALID_PAYMENT_STATUS_TRANSITIONS[existing.status];
    if (!allowed.includes(input.status)) {
      throw new InvalidPaymentStatusTransitionError(
        existing.status,
        input.status,
      );
    }

    // Build update with timestamp side effects
    const updateData: Record<string, unknown> = { status: input.status };

    if (['SUCCEEDED', 'FAILED', 'REFUNDED'].includes(input.status)) {
      updateData.processedAt = new Date();
    }
    // Reset processedAt on retry (FAILED → PENDING)
    if (input.status === 'PENDING') {
      updateData.processedAt = null;
    }

    const [updated] = await ctx.tx
      .update(paymentTransactions)
      .set(updateData)
      .where(
        and(
          eq(paymentTransactions.id, input.id),
          eq(paymentTransactions.organizationId, ctx.actor.orgId),
        ),
      )
      .returning();

    await ctx.audit({
      action: AuditActions.PAYMENT_TRANSACTION_STATUS_CHANGED,
      resource: AuditResources.PAYMENT_TRANSACTION,
      resourceId: input.id,
      oldValue: { status: existing.status },
      newValue: { status: input.status },
    });

    return updated;
  },

  async deleteWithAudit(ctx: ServiceContext, id: string) {
    assertBusinessOpsOrAdmin(ctx.actor.roles);

    const existing = await revenueService.getById(ctx.tx, id, ctx.actor.orgId);
    if (!existing) throw new PaymentTransactionNotFoundError(id);

    await ctx.tx
      .delete(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.id, id),
          eq(paymentTransactions.organizationId, ctx.actor.orgId),
        ),
      );

    await ctx.audit({
      action: AuditActions.PAYMENT_TRANSACTION_DELETED,
      resource: AuditResources.PAYMENT_TRANSACTION,
      resourceId: id,
      oldValue: {
        type: existing.type,
        direction: existing.direction,
        amount: existing.amount,
        status: existing.status,
      },
    });
  },
};
