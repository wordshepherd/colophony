import {
  readerFeedback,
  eq,
  and,
  or,
  desc,
  isNull,
  not,
  inArray,
  type DrizzleDb,
} from '@colophony/db';
import { count } from 'drizzle-orm';
import {
  AuditActions,
  AuditResources,
  readerFeedbackSettingsSchema,
} from '@colophony/types';
import type {
  ListReaderFeedbackInput,
  CreateReaderFeedbackInput,
} from '@colophony/types';
import type { ServiceContext } from './types.js';
import { ForbiddenError, assertEditorOrAdmin } from './errors.js';
import { organizationService } from './organization.service.js';
import { submissionService } from './submission.service.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class ReaderFeedbackNotFoundError extends Error {
  constructor(id: string) {
    super(`Reader feedback "${id}" not found`);
    this.name = 'ReaderFeedbackNotFoundError';
  }
}

export class ReaderFeedbackNotEnabledError extends Error {
  constructor() {
    super('Reader feedback is not enabled for this organization');
    this.name = 'ReaderFeedbackNotEnabledError';
  }
}

export class ReaderFeedbackAlreadyForwardedError extends Error {
  constructor() {
    super('This feedback has already been forwarded');
    this.name = 'ReaderFeedbackAlreadyForwardedError';
  }
}

export class ReaderFeedbackNotForwardableError extends Error {
  constructor() {
    super('This feedback is not marked as forwardable');
    this.name = 'ReaderFeedbackNotForwardableError';
  }
}

export class InvalidFeedbackTagError extends Error {
  readonly invalidTags: string[];

  constructor(tags: string[]) {
    super(
      `Invalid feedback tags: ${tags.join(', ')}. Tags must be from the organization's configured list.`,
    );
    this.name = 'InvalidFeedbackTagError';
    this.invalidTags = tags;
  }
}

export class CrossOrgSubmissionError extends Error {
  constructor() {
    super('Submission does not belong to this organization');
    this.name = 'CrossOrgSubmissionError';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseOrgFeedbackSettings(settings: unknown) {
  const parsed = readerFeedbackSettingsSchema.safeParse(
    typeof settings === 'object' && settings !== null
      ? {
          enabled: (settings as Record<string, unknown>).readerFeedbackEnabled,
          availableTags: (settings as Record<string, unknown>)
            .readerFeedbackTags,
        }
      : {},
  );
  return parsed.success
    ? parsed.data
    : { enabled: false, availableTags: [] as string[] };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const readerFeedbackService = {
  // -------------------------------------------------------------------------
  // Pure data methods
  // -------------------------------------------------------------------------

  async list(tx: DrizzleDb, orgId: string, input: ListReaderFeedbackInput) {
    const { submissionId, page, limit } = input;
    const offset = (page - 1) * limit;

    // Defense-in-depth: explicit organizationId filter alongside RLS
    const conditions = [
      eq(readerFeedback.organizationId, orgId),
      eq(readerFeedback.submissionId, submissionId),
    ];

    const where = and(...conditions);

    const [items, countResult] = await Promise.all([
      tx
        .select()
        .from(readerFeedback)
        .where(where)
        .orderBy(desc(readerFeedback.createdAt))
        .limit(limit)
        .offset(offset),
      tx.select({ count: count() }).from(readerFeedback).where(where),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async listForWriter(
    tx: DrizzleDb,
    userId: string,
    submissionId: string,
    page: number,
    limit: number,
  ) {
    // Defense-in-depth: verify submission belongs to this user
    const submission = await submissionService.getById(tx, submissionId);
    if (!submission || submission.submitterId !== userId) {
      throw new ForbiddenError('You do not own this submission');
    }

    const offset = (page - 1) * limit;

    // Defense-in-depth: only forwarded feedback (matches RLS submitter_forwarded_read)
    const where = and(
      eq(readerFeedback.submissionId, submissionId),
      not(isNull(readerFeedback.forwardedAt)),
    );

    const [items, countResult] = await Promise.all([
      tx
        .select({
          id: readerFeedback.id,
          submissionId: readerFeedback.submissionId,
          tags: readerFeedback.tags,
          comment: readerFeedback.comment,
          forwardedAt: readerFeedback.forwardedAt,
        })
        .from(readerFeedback)
        .where(where)
        .orderBy(desc(readerFeedback.forwardedAt))
        .limit(limit)
        .offset(offset),
      tx.select({ count: count() }).from(readerFeedback).where(where),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getById(tx: DrizzleDb, orgId: string, id: string) {
    // Defense-in-depth: explicit organizationId filter alongside RLS
    const [row] = await tx
      .select()
      .from(readerFeedback)
      .where(
        and(
          eq(readerFeedback.id, id),
          eq(readerFeedback.organizationId, orgId),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  async create(
    tx: DrizzleDb,
    orgId: string,
    input: {
      submissionId: string;
      reviewerUserId: string;
      tags: string[];
      comment?: string;
      isForwardable?: boolean;
    },
  ) {
    const [row] = await tx
      .insert(readerFeedback)
      .values({
        organizationId: orgId,
        submissionId: input.submissionId,
        reviewerUserId: input.reviewerUserId,
        tags: input.tags,
        comment: input.comment ?? null,
        isForwardable: input.isForwardable ?? false,
      })
      .returning();
    return row;
  },

  async forward(tx: DrizzleDb, orgId: string, id: string, forwardedBy: string) {
    // Defense-in-depth: explicit organizationId filter
    const [row] = await tx
      .update(readerFeedback)
      .set({
        forwardedAt: new Date(),
        forwardedBy,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(readerFeedback.id, id),
          eq(readerFeedback.organizationId, orgId),
          isNull(readerFeedback.forwardedAt),
        ),
      )
      .returning();
    return row ?? null;
  },

  async listForwardedForSubmission(
    tx: DrizzleDb,
    orgId: string,
    submissionId: string,
  ): Promise<Array<{ tags: string[]; comment: string | null }>> {
    // Defense-in-depth: explicit orgId filter + only forwarded feedback
    // Strips reviewer identity at query level
    return tx
      .select({
        tags: readerFeedback.tags,
        comment: readerFeedback.comment,
      })
      .from(readerFeedback)
      .where(
        and(
          eq(readerFeedback.organizationId, orgId),
          eq(readerFeedback.submissionId, submissionId),
          not(isNull(readerFeedback.forwardedAt)),
        ),
      )
      .orderBy(desc(readerFeedback.createdAt))
      .limit(50);
  },

  async listIncludableForSubmission(
    tx: DrizzleDb,
    orgId: string,
    submissionId: string,
  ) {
    // Defense-in-depth: explicit orgId filter
    // Returns forwardable (not yet forwarded) + already forwarded items
    return tx
      .select({
        id: readerFeedback.id,
        tags: readerFeedback.tags,
        comment: readerFeedback.comment,
        isForwardable: readerFeedback.isForwardable,
        forwardedAt: readerFeedback.forwardedAt,
      })
      .from(readerFeedback)
      .where(
        and(
          eq(readerFeedback.organizationId, orgId),
          eq(readerFeedback.submissionId, submissionId),
          // Only forwardable or already forwarded
          or(
            eq(readerFeedback.isForwardable, true),
            not(isNull(readerFeedback.forwardedAt)),
          ),
        ),
      )
      .orderBy(desc(readerFeedback.createdAt))
      .limit(50);
  },

  async bulkForwardForSubmission(
    tx: DrizzleDb,
    orgId: string,
    submissionId: string,
    forwardedBy: string,
  ) {
    // Forward forwardable, not-yet-forwarded feedback for this submission
    // Defense-in-depth: explicit orgId filter
    // Cap at 50 to stay consistent with listForwardedForSubmission/listIncludableForSubmission
    const eligible = await tx
      .select({ id: readerFeedback.id })
      .from(readerFeedback)
      .where(
        and(
          eq(readerFeedback.organizationId, orgId),
          eq(readerFeedback.submissionId, submissionId),
          eq(readerFeedback.isForwardable, true),
          isNull(readerFeedback.forwardedAt),
        ),
      )
      .limit(50);

    if (eligible.length === 0) return [];

    const now = new Date();
    const ids = eligible.map((r) => r.id);
    const rows = await tx
      .update(readerFeedback)
      .set({
        forwardedAt: now,
        forwardedBy,
        updatedAt: now,
      })
      .where(inArray(readerFeedback.id, ids))
      .returning();
    return rows;
  },

  async delete(tx: DrizzleDb, orgId: string, id: string) {
    // Defense-in-depth: explicit organizationId filter
    const [row] = await tx
      .delete(readerFeedback)
      .where(
        and(
          eq(readerFeedback.id, id),
          eq(readerFeedback.organizationId, orgId),
        ),
      )
      .returning();
    return row ?? null;
  },

  // -------------------------------------------------------------------------
  // Audit-wrapped methods
  // -------------------------------------------------------------------------

  async createWithAudit(ctx: ServiceContext, input: CreateReaderFeedbackInput) {
    const orgId = ctx.actor.orgId;

    // Gate: check org has reader feedback enabled
    const org = await organizationService.getById(ctx.tx, orgId);
    if (!org) throw new ForbiddenError('Organization not found');

    const feedbackSettings = parseOrgFeedbackSettings(org.settings);
    if (!feedbackSettings.enabled) {
      throw new ReaderFeedbackNotEnabledError();
    }

    // P1 defense-in-depth: verify submission belongs to this org
    const submission = await submissionService.getById(
      ctx.tx,
      input.submissionId,
    );
    if (!submission) {
      throw new ForbiddenError('Submission not found');
    }
    if (submission.organizationId !== orgId) {
      throw new CrossOrgSubmissionError();
    }

    // Tag validation: verify all tags are in org's configured list
    if (input.tags && input.tags.length > 0) {
      const availableTags = feedbackSettings.availableTags;
      const invalidTags = input.tags.filter(
        (tag) => !availableTags.includes(tag),
      );
      if (invalidTags.length > 0) {
        throw new InvalidFeedbackTagError(invalidTags);
      }
    }

    const feedback = await readerFeedbackService.create(ctx.tx, orgId, {
      submissionId: input.submissionId,
      reviewerUserId: ctx.actor.userId,
      tags: input.tags ?? [],
      comment: input.comment,
      isForwardable: input.isForwardable,
    });

    await ctx.audit({
      action: AuditActions.READER_FEEDBACK_CREATED,
      resource: AuditResources.READER_FEEDBACK,
      resourceId: feedback.id,
      newValue: {
        submissionId: input.submissionId,
        tags: input.tags,
        isForwardable: input.isForwardable,
      },
    });

    return feedback;
  },

  async forwardWithAudit(ctx: ServiceContext, feedbackId: string) {
    const orgId = ctx.actor.orgId;

    // Defense-in-depth: editor role check (tRPC procedure also enforces)
    assertEditorOrAdmin(ctx.actor.roles);

    const existing = await readerFeedbackService.getById(
      ctx.tx,
      orgId,
      feedbackId,
    );
    if (!existing) throw new ReaderFeedbackNotFoundError(feedbackId);

    if (!existing.isForwardable) {
      throw new ReaderFeedbackNotForwardableError();
    }

    if (existing.forwardedAt !== null) {
      throw new ReaderFeedbackAlreadyForwardedError();
    }

    const updated = await readerFeedbackService.forward(
      ctx.tx,
      orgId,
      feedbackId,
      ctx.actor.userId,
    );

    // Race-safe: if another editor forwarded between our read and update,
    // the WHERE clause (forwarded_at IS NULL) causes zero rows updated.
    if (!updated) {
      throw new ReaderFeedbackAlreadyForwardedError();
    }

    await ctx.audit({
      action: AuditActions.READER_FEEDBACK_FORWARDED,
      resource: AuditResources.READER_FEEDBACK,
      resourceId: feedbackId,
      newValue: { forwardedBy: ctx.actor.userId },
    });

    return updated;
  },

  async bulkForwardWithAudit(ctx: ServiceContext, submissionId: string) {
    const orgId = ctx.actor.orgId;

    assertEditorOrAdmin(ctx.actor.roles);

    const forwarded = await readerFeedbackService.bulkForwardForSubmission(
      ctx.tx,
      orgId,
      submissionId,
      ctx.actor.userId,
    );

    if (forwarded.length > 0) {
      await ctx.audit({
        action: AuditActions.READER_FEEDBACK_BULK_FORWARDED,
        resource: AuditResources.READER_FEEDBACK,
        resourceId: submissionId,
        newValue: {
          submissionId,
          count: forwarded.length,
          feedbackIds: forwarded.map((r) => r.id),
        },
      });
    }

    return forwarded.length;
  },

  async deleteWithAudit(ctx: ServiceContext, id: string) {
    const orgId = ctx.actor.orgId;

    assertEditorOrAdmin(ctx.actor.roles);

    const existing = await readerFeedbackService.getById(ctx.tx, orgId, id);
    if (!existing) throw new ReaderFeedbackNotFoundError(id);

    await readerFeedbackService.delete(ctx.tx, orgId, id);

    await ctx.audit({
      action: AuditActions.READER_FEEDBACK_DELETED,
      resource: AuditResources.READER_FEEDBACK,
      resourceId: id,
      oldValue: {
        submissionId: existing.submissionId,
        tags: existing.tags,
        comment: existing.comment,
      },
    });
  },
};
