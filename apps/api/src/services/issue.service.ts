import {
  issues,
  issueSections,
  issueItems,
  pipelineItems,
  submissions,
  eq,
  and,
  asc,
  desc,
  gte,
  lte,
  type DrizzleDb,
} from '@colophony/db';
import { ilike, count, getTableColumns } from 'drizzle-orm';
import type {
  CreateIssueInput,
  UpdateIssueInput,
  ListIssuesInput,
  AddIssueItemInput,
  AddIssueSectionInput,
  ReorderItemsInput,
  IssueStatus,
} from '@colophony/types';
import { AuditActions, AuditResources } from '@colophony/types';
import type { ServiceContext } from './types.js';
import { assertEditorOrAdmin } from './errors.js';
import { enqueueOutboxEvent } from './outbox.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class IssueNotFoundError extends Error {
  constructor(id: string) {
    super(`Issue "${id}" not found`);
    this.name = 'IssueNotFoundError';
  }
}

export class IssueSectionNotFoundError extends Error {
  constructor(id: string) {
    super(`Issue section "${id}" not found`);
    this.name = 'IssueSectionNotFoundError';
  }
}

export class IssueItemAlreadyExistsError extends Error {
  constructor(pipelineItemId: string) {
    super(`Pipeline item "${pipelineItemId}" is already in this issue`);
    this.name = 'IssueItemAlreadyExistsError';
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const issueService = {
  // -------------------------------------------------------------------------
  // List / Get
  // -------------------------------------------------------------------------

  async list(tx: DrizzleDb, input: ListIssuesInput) {
    const { publicationId, status, search, from, to, page, limit } = input;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (publicationId) conditions.push(eq(issues.publicationId, publicationId));
    if (status) conditions.push(eq(issues.status, status));
    if (search) conditions.push(ilike(issues.title, `%${search}%`));
    if (from) conditions.push(gte(issues.publicationDate, from));
    if (to) conditions.push(lte(issues.publicationDate, to));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const hasDateRange = from || to;

    const [items, countResult] = await Promise.all([
      tx
        .select()
        .from(issues)
        .where(where)
        .orderBy(
          hasDateRange ? asc(issues.publicationDate) : desc(issues.createdAt),
        )
        .limit(limit)
        .offset(offset),
      tx.select({ count: count() }).from(issues).where(where),
    ]);

    const total = countResult[0]?.count ?? 0;
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  async getById(tx: DrizzleDb, id: string) {
    const [row] = await tx
      .select()
      .from(issues)
      .where(eq(issues.id, id))
      .limit(1);

    return row ?? null;
  },

  async getItems(tx: DrizzleDb, issueId: string) {
    return tx
      .select({
        ...getTableColumns(issueItems),
        submissionTitle: submissions.title,
      })
      .from(issueItems)
      .leftJoin(pipelineItems, eq(issueItems.pipelineItemId, pipelineItems.id))
      .leftJoin(submissions, eq(pipelineItems.submissionId, submissions.id))
      .where(eq(issueItems.issueId, issueId))
      .orderBy(issueItems.sortOrder);
  },

  async getSections(tx: DrizzleDb, issueId: string) {
    return tx
      .select()
      .from(issueSections)
      .where(eq(issueSections.issueId, issueId))
      .orderBy(issueSections.sortOrder);
  },

  // -------------------------------------------------------------------------
  // Create / Update / Status
  // -------------------------------------------------------------------------

  async create(tx: DrizzleDb, input: CreateIssueInput, orgId: string) {
    const [row] = await tx
      .insert(issues)
      .values({
        organizationId: orgId,
        publicationId: input.publicationId,
        title: input.title,
        volume: input.volume ?? null,
        issueNumber: input.issueNumber ?? null,
        description: input.description ?? null,
        coverImageUrl: input.coverImageUrl ?? null,
        publicationDate: input.publicationDate ?? null,
      })
      .returning();

    return row;
  },

  async createWithAudit(ctx: ServiceContext, input: CreateIssueInput) {
    assertEditorOrAdmin(ctx.actor.role);
    const issue = await issueService.create(ctx.tx, input, ctx.actor.orgId);
    await ctx.audit({
      action: AuditActions.ISSUE_CREATED,
      resource: AuditResources.ISSUE,
      resourceId: issue.id,
      newValue: { title: input.title },
    });
    return issue;
  },

  async update(tx: DrizzleDb, id: string, input: UpdateIssueInput) {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (input.title !== undefined) values.title = input.title;
    if (input.volume !== undefined) values.volume = input.volume;
    if (input.issueNumber !== undefined) values.issueNumber = input.issueNumber;
    if (input.description !== undefined) values.description = input.description;
    if (input.coverImageUrl !== undefined)
      values.coverImageUrl = input.coverImageUrl;
    if (input.publicationDate !== undefined)
      values.publicationDate = input.publicationDate;

    const [row] = await tx
      .update(issues)
      .set(values)
      .where(eq(issues.id, id))
      .returning();

    return row ?? null;
  },

  async updateWithAudit(
    ctx: ServiceContext,
    id: string,
    input: UpdateIssueInput,
  ) {
    assertEditorOrAdmin(ctx.actor.role);
    const updated = await issueService.update(ctx.tx, id, input);
    if (!updated) throw new IssueNotFoundError(id);
    await ctx.audit({
      action: AuditActions.ISSUE_UPDATED,
      resource: AuditResources.ISSUE,
      resourceId: id,
      newValue: input,
    });
    return updated;
  },

  async updateStatus(tx: DrizzleDb, id: string, status: IssueStatus) {
    const values: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };
    if (status === 'PUBLISHED') values.publishedAt = new Date();

    const [row] = await tx
      .update(issues)
      .set(values)
      .where(eq(issues.id, id))
      .returning();

    return row ?? null;
  },

  async publishWithAudit(ctx: ServiceContext, id: string) {
    assertEditorOrAdmin(ctx.actor.role);
    const issue = await issueService.getById(ctx.tx, id);
    if (!issue) throw new IssueNotFoundError(id);
    const updated = await issueService.updateStatus(ctx.tx, id, 'PUBLISHED');
    if (!updated) throw new IssueNotFoundError(id);
    await ctx.audit({
      action: AuditActions.ISSUE_PUBLISHED,
      resource: AuditResources.ISSUE,
      resourceId: id,
      oldValue: { status: issue.status },
      newValue: { status: 'PUBLISHED' },
    });

    // Enqueue outbox event to trigger CMS publishing
    await enqueueOutboxEvent(ctx.tx, 'slate/issue.published', {
      orgId: ctx.actor.orgId,
      issueId: id,
      publicationId: updated.publicationId,
    });

    return updated;
  },

  async archiveWithAudit(ctx: ServiceContext, id: string) {
    assertEditorOrAdmin(ctx.actor.role);
    const issue = await issueService.getById(ctx.tx, id);
    if (!issue) throw new IssueNotFoundError(id);
    const updated = await issueService.updateStatus(ctx.tx, id, 'ARCHIVED');
    if (!updated) throw new IssueNotFoundError(id);
    await ctx.audit({
      action: AuditActions.ISSUE_ARCHIVED,
      resource: AuditResources.ISSUE,
      resourceId: id,
      oldValue: { status: issue.status },
      newValue: { status: 'ARCHIVED' },
    });
    return updated;
  },

  // -------------------------------------------------------------------------
  // Items
  // -------------------------------------------------------------------------

  async addItem(tx: DrizzleDb, issueId: string, input: AddIssueItemInput) {
    // Validate section belongs to this issue (if provided)
    if (input.issueSectionId) {
      const [section] = await tx
        .select({ id: issueSections.id })
        .from(issueSections)
        .where(
          and(
            eq(issueSections.id, input.issueSectionId),
            eq(issueSections.issueId, issueId),
          ),
        )
        .limit(1);

      if (!section) {
        throw new IssueNotFoundError(
          `Section "${input.issueSectionId}" does not belong to issue "${issueId}"`,
        );
      }
    }

    const [row] = await tx
      .insert(issueItems)
      .values({
        issueId,
        pipelineItemId: input.pipelineItemId,
        issueSectionId: input.issueSectionId ?? null,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning();

    return row;
  },

  async addItemWithAudit(
    ctx: ServiceContext,
    issueId: string,
    input: AddIssueItemInput,
  ) {
    assertEditorOrAdmin(ctx.actor.role);
    try {
      const item = await issueService.addItem(ctx.tx, issueId, input);
      await ctx.audit({
        action: AuditActions.ISSUE_ITEM_ADDED,
        resource: AuditResources.ISSUE,
        resourceId: issueId,
        newValue: { pipelineItemId: input.pipelineItemId },
      });
      return item;
    } catch (e) {
      // Unique constraint violation → already exists
      if (
        typeof e === 'object' &&
        e !== null &&
        'code' in e &&
        (e as { code: string }).code === '23505'
      ) {
        throw new IssueItemAlreadyExistsError(input.pipelineItemId);
      }
      throw e;
    }
  },

  async removeItem(tx: DrizzleDb, issueId: string, itemId: string) {
    const [row] = await tx
      .delete(issueItems)
      .where(and(eq(issueItems.id, itemId), eq(issueItems.issueId, issueId)))
      .returning();

    return row ?? null;
  },

  async removeItemWithAudit(
    ctx: ServiceContext,
    issueId: string,
    itemId: string,
  ) {
    assertEditorOrAdmin(ctx.actor.role);
    const removed = await issueService.removeItem(ctx.tx, issueId, itemId);
    if (removed) {
      await ctx.audit({
        action: AuditActions.ISSUE_ITEM_REMOVED,
        resource: AuditResources.ISSUE,
        resourceId: issueId,
        oldValue: { pipelineItemId: removed.pipelineItemId },
      });
    }
    return removed;
  },

  async reorderItems(tx: DrizzleDb, issueId: string, input: ReorderItemsInput) {
    for (const { id, sortOrder } of input.items) {
      await tx
        .update(issueItems)
        .set({ sortOrder })
        .where(and(eq(issueItems.id, id), eq(issueItems.issueId, issueId)));
    }
    return issueService.getItems(tx, issueId);
  },

  // -------------------------------------------------------------------------
  // Sections
  // -------------------------------------------------------------------------

  async addSection(
    tx: DrizzleDb,
    issueId: string,
    input: AddIssueSectionInput,
  ) {
    const [row] = await tx
      .insert(issueSections)
      .values({
        issueId,
        title: input.title,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning();

    return row;
  },

  async removeSection(tx: DrizzleDb, issueId: string, sectionId: string) {
    const [row] = await tx
      .delete(issueSections)
      .where(
        and(
          eq(issueSections.id, sectionId),
          eq(issueSections.issueId, issueId),
        ),
      )
      .returning();

    return row ?? null;
  },
};
