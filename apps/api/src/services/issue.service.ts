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
  sql,
  type DrizzleDb,
} from '@colophony/db';
import { ilike, count, getTableColumns, not, inArray } from 'drizzle-orm';
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
import { assertEditorOrProductionOrAdmin } from './errors.js';
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

  async list(tx: DrizzleDb, input: ListIssuesInput, orgId?: string) {
    const { publicationId, status, search, from, to, page, limit } = input;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (orgId) conditions.push(eq(issues.organizationId, orgId));
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

  async listActive(tx: DrizzleDb, orgId: string) {
    return tx
      .select({
        id: issues.id,
        title: issues.title,
        status: issues.status,
        publicationDate: issues.publicationDate,
      })
      .from(issues)
      .where(
        and(
          eq(issues.organizationId, orgId),
          not(inArray(issues.status, ['PUBLISHED', 'ARCHIVED'])),
        ),
      )
      .orderBy(sql`${issues.publicationDate} ASC NULLS LAST`)
      .limit(50);
  },

  async getById(tx: DrizzleDb, id: string, orgId?: string) {
    const [row] = await tx
      .select()
      .from(issues)
      .where(
        orgId
          ? and(eq(issues.id, id), eq(issues.organizationId, orgId))
          : eq(issues.id, id),
      )
      .limit(1);

    return row ?? null;
  },

  async getItems(tx: DrizzleDb, issueId: string, orgId?: string) {
    if (orgId) {
      const issue = await issueService.getById(tx, issueId, orgId);
      if (!issue) return [];
    }
    return tx
      .select({
        ...getTableColumns(issueItems),
        submissionTitle: submissions.title,
      })
      .from(issueItems)
      .leftJoin(pipelineItems, eq(issueItems.pipelineItemId, pipelineItems.id))
      .leftJoin(submissions, eq(pipelineItems.submissionId, submissions.id))
      .where(eq(issueItems.issueId, issueId))
      .orderBy(issueItems.sortOrder)
      .limit(10000);
  },

  async getSections(tx: DrizzleDb, issueId: string, orgId?: string) {
    if (orgId) {
      const issue = await issueService.getById(tx, issueId, orgId);
      if (!issue) return [];
    }
    return tx
      .select()
      .from(issueSections)
      .where(eq(issueSections.issueId, issueId))
      .orderBy(issueSections.sortOrder)
      .limit(10000);
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
    assertEditorOrProductionOrAdmin(ctx.actor.roles);
    const issue = await issueService.create(ctx.tx, input, ctx.actor.orgId);
    await ctx.audit({
      action: AuditActions.ISSUE_CREATED,
      resource: AuditResources.ISSUE,
      resourceId: issue.id,
      newValue: { title: input.title },
    });
    return issue;
  },

  async update(
    tx: DrizzleDb,
    id: string,
    input: UpdateIssueInput,
    orgId?: string,
  ) {
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
      .where(
        orgId
          ? and(eq(issues.id, id), eq(issues.organizationId, orgId))
          : eq(issues.id, id),
      )
      .returning();

    return row ?? null;
  },

  async updateWithAudit(
    ctx: ServiceContext,
    id: string,
    input: UpdateIssueInput,
  ) {
    assertEditorOrProductionOrAdmin(ctx.actor.roles);
    const updated = await issueService.update(
      ctx.tx,
      id,
      input,
      ctx.actor.orgId,
    );
    if (!updated) throw new IssueNotFoundError(id);
    await ctx.audit({
      action: AuditActions.ISSUE_UPDATED,
      resource: AuditResources.ISSUE,
      resourceId: id,
      newValue: input,
    });
    return updated;
  },

  async updateStatus(
    tx: DrizzleDb,
    id: string,
    status: IssueStatus,
    orgId?: string,
  ) {
    const values: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };
    if (status === 'PUBLISHED') values.publishedAt = new Date();

    const [row] = await tx
      .update(issues)
      .set(values)
      .where(
        orgId
          ? and(eq(issues.id, id), eq(issues.organizationId, orgId))
          : eq(issues.id, id),
      )
      .returning();

    return row ?? null;
  },

  async publishWithAudit(ctx: ServiceContext, id: string) {
    assertEditorOrProductionOrAdmin(ctx.actor.roles);
    const issue = await issueService.getById(ctx.tx, id, ctx.actor.orgId);
    if (!issue) throw new IssueNotFoundError(id);
    const updated = await issueService.updateStatus(
      ctx.tx,
      id,
      'PUBLISHED',
      ctx.actor.orgId,
    );
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
    assertEditorOrProductionOrAdmin(ctx.actor.roles);
    const issue = await issueService.getById(ctx.tx, id, ctx.actor.orgId);
    if (!issue) throw new IssueNotFoundError(id);
    const updated = await issueService.updateStatus(
      ctx.tx,
      id,
      'ARCHIVED',
      ctx.actor.orgId,
    );
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
  // CMS Publish Result Storage
  // -------------------------------------------------------------------------

  async saveCmsPublishResult(
    tx: DrizzleDb,
    issueId: string,
    connectionId: string,
    result: {
      externalId: string;
      externalUrl?: string;
      adapterType: string;
    },
    orgId?: string,
  ) {
    const issue = await issueService.getById(tx, issueId, orgId);
    if (!issue) return null;

    const metadata = issue.metadata ?? {};
    const cmsPublish = (metadata.cmsPublish ?? {}) as Record<string, unknown>;
    cmsPublish[connectionId] = {
      externalId: result.externalId,
      externalUrl: result.externalUrl,
      publishedAt: new Date().toISOString(),
      adapterType: result.adapterType,
    };

    const [row] = await tx
      .update(issues)
      .set({ metadata: { ...metadata, cmsPublish }, updatedAt: new Date() })
      .where(
        orgId
          ? and(eq(issues.id, issueId), eq(issues.organizationId, orgId))
          : eq(issues.id, issueId),
      )
      .returning();

    return row ?? null;
  },

  // -------------------------------------------------------------------------
  // Items
  // -------------------------------------------------------------------------

  async addItem(
    tx: DrizzleDb,
    issueId: string,
    input: AddIssueItemInput,
    orgId?: string,
  ) {
    if (orgId) {
      const issue = await issueService.getById(tx, issueId, orgId);
      if (!issue) throw new IssueNotFoundError(issueId);
    }
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
    assertEditorOrProductionOrAdmin(ctx.actor.roles);
    try {
      const item = await issueService.addItem(
        ctx.tx,
        issueId,
        input,
        ctx.actor.orgId,
      );
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

  async removeItem(
    tx: DrizzleDb,
    issueId: string,
    itemId: string,
    orgId?: string,
  ) {
    if (orgId) {
      const issue = await issueService.getById(tx, issueId, orgId);
      if (!issue) return null;
    }
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
    assertEditorOrProductionOrAdmin(ctx.actor.roles);
    const removed = await issueService.removeItem(
      ctx.tx,
      issueId,
      itemId,
      ctx.actor.orgId,
    );
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

  async reorderItems(
    tx: DrizzleDb,
    issueId: string,
    input: ReorderItemsInput,
    orgId?: string,
  ) {
    if (orgId) {
      const issue = await issueService.getById(tx, issueId, orgId);
      if (!issue) return [];
    }
    for (const { id, sortOrder } of input.items) {
      await tx
        .update(issueItems)
        .set({ sortOrder })
        .where(and(eq(issueItems.id, id), eq(issueItems.issueId, issueId)));
    }
    return issueService.getItems(tx, issueId, orgId);
  },

  // -------------------------------------------------------------------------
  // Sections
  // -------------------------------------------------------------------------

  async addSection(
    tx: DrizzleDb,
    issueId: string,
    input: AddIssueSectionInput,
    orgId?: string,
  ) {
    if (orgId) {
      const issue = await issueService.getById(tx, issueId, orgId);
      if (!issue) throw new IssueNotFoundError(issueId);
    }
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

  async removeSection(
    tx: DrizzleDb,
    issueId: string,
    sectionId: string,
    orgId?: string,
  ) {
    if (orgId) {
      const issue = await issueService.getById(tx, issueId, orgId);
      if (!issue) return null;
    }
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
