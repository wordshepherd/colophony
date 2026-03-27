import {
  workspaceCollections,
  workspaceItems,
  submissions,
  eq,
  and,
  asc,
  desc,
  type DrizzleDb,
} from '@colophony/db';
import { ilike, count, getTableColumns, or } from 'drizzle-orm';
import type {
  CreateCollectionInput,
  UpdateCollectionInput,
  ListCollectionsInput,
  AddCollectionItemInput,
  UpdateCollectionItemInput,
  ReorderCollectionItemsInput,
} from '@colophony/types';
import { AuditActions, AuditResources } from '@colophony/types';
import type { ServiceContext } from './types.js';
import { assertEditorOrAdmin } from './errors.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class CollectionNotFoundError extends Error {
  constructor(id: string) {
    super(`Collection "${id}" not found`);
    this.name = 'CollectionNotFoundError';
  }
}

export class CollectionItemAlreadyExistsError extends Error {
  constructor(submissionId: string) {
    super(`Submission "${submissionId}" is already in this collection`);
    this.name = 'CollectionItemAlreadyExistsError';
  }
}

export class CollectionItemNotFoundError extends Error {
  constructor(itemId: string) {
    super(`Collection item "${itemId}" not found`);
    this.name = 'CollectionItemNotFoundError';
  }
}

export class SubmissionNotInOrgError extends Error {
  constructor(submissionId: string) {
    super(`Submission "${submissionId}" does not belong to this organization`);
    this.name = 'SubmissionNotInOrgError';
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const collectionService = {
  // -------------------------------------------------------------------------
  // List / Get
  // -------------------------------------------------------------------------

  async list(
    tx: DrizzleDb,
    input: ListCollectionsInput,
    orgId: string,
    userId?: string,
  ) {
    const { typeHint, visibility, search, page, limit } = input;
    const offset = (page - 1) * limit;

    const conditions = [eq(workspaceCollections.organizationId, orgId)];

    // Visibility filtering: private only for owner, team/collaborators for all
    if (userId) {
      conditions.push(
        or(
          eq(workspaceCollections.visibility, 'team'),
          eq(workspaceCollections.visibility, 'collaborators'),
          and(
            eq(workspaceCollections.visibility, 'private'),
            eq(workspaceCollections.ownerId, userId),
          ),
        )!,
      );
    }

    if (typeHint) conditions.push(eq(workspaceCollections.typeHint, typeHint));
    if (visibility)
      conditions.push(eq(workspaceCollections.visibility, visibility));
    if (search)
      conditions.push(ilike(workspaceCollections.name, `%${search}%`));

    const where = and(...conditions);

    const [items, countResult] = await Promise.all([
      tx
        .select()
        .from(workspaceCollections)
        .where(where)
        .orderBy(desc(workspaceCollections.updatedAt))
        .limit(limit)
        .offset(offset),
      tx.select({ count: count() }).from(workspaceCollections).where(where),
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

  async getById(tx: DrizzleDb, id: string, orgId: string, userId?: string) {
    const conditions = [
      eq(workspaceCollections.id, id),
      eq(workspaceCollections.organizationId, orgId),
    ];

    // Enforce visibility: private collections only visible to their owner
    if (userId) {
      conditions.push(
        or(
          eq(workspaceCollections.visibility, 'team'),
          eq(workspaceCollections.visibility, 'collaborators'),
          and(
            eq(workspaceCollections.visibility, 'private'),
            eq(workspaceCollections.ownerId, userId),
          ),
        )!,
      );
    }

    const [row] = await tx
      .select()
      .from(workspaceCollections)
      .where(and(...conditions))
      .limit(1);

    return row ?? null;
  },

  async getItems(
    tx: DrizzleDb,
    collectionId: string,
    orgId: string,
    userId?: string,
  ) {
    // Verify collection belongs to org + visibility check
    const collection = await collectionService.getById(
      tx,
      collectionId,
      orgId,
      userId,
    );
    if (!collection) return [];

    return tx
      .select({
        ...getTableColumns(workspaceItems),
        submissionTitle: submissions.title,
      })
      .from(workspaceItems)
      .leftJoin(submissions, eq(workspaceItems.submissionId, submissions.id))
      .where(eq(workspaceItems.collectionId, collectionId))
      .orderBy(asc(workspaceItems.position))
      .limit(1000);
  },

  // -------------------------------------------------------------------------
  // Create / Update / Delete
  // -------------------------------------------------------------------------

  async create(
    tx: DrizzleDb,
    input: CreateCollectionInput,
    orgId: string,
    ownerId: string,
  ) {
    const [row] = await tx
      .insert(workspaceCollections)
      .values({
        organizationId: orgId,
        ownerId,
        name: input.name,
        description: input.description ?? null,
        visibility: input.visibility ?? 'private',
        typeHint: input.typeHint ?? 'custom',
      })
      .returning();

    return row;
  },

  async createWithAudit(ctx: ServiceContext, input: CreateCollectionInput) {
    assertEditorOrAdmin(ctx.actor.role);
    const collection = await collectionService.create(
      ctx.tx,
      input,
      ctx.actor.orgId,
      ctx.actor.userId,
    );
    await ctx.audit({
      action: AuditActions.COLLECTION_CREATED,
      resource: AuditResources.COLLECTION,
      resourceId: collection.id,
      newValue: { name: input.name, typeHint: input.typeHint },
    });
    return collection;
  },

  async update(
    tx: DrizzleDb,
    id: string,
    input: UpdateCollectionInput,
    orgId: string,
  ) {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) values.name = input.name;
    if (input.description !== undefined) values.description = input.description;
    if (input.visibility !== undefined) values.visibility = input.visibility;
    if (input.typeHint !== undefined) values.typeHint = input.typeHint;

    const [row] = await tx
      .update(workspaceCollections)
      .set(values)
      .where(
        and(
          eq(workspaceCollections.id, id),
          eq(workspaceCollections.organizationId, orgId),
        ),
      )
      .returning();

    return row ?? null;
  },

  async updateWithAudit(
    ctx: ServiceContext,
    id: string,
    input: UpdateCollectionInput,
  ) {
    assertEditorOrAdmin(ctx.actor.role);
    // Visibility check: private collections only editable by owner
    const existing = await collectionService.getById(
      ctx.tx,
      id,
      ctx.actor.orgId,
      ctx.actor.userId,
    );
    if (!existing) throw new CollectionNotFoundError(id);
    const updated = await collectionService.update(
      ctx.tx,
      id,
      input,
      ctx.actor.orgId,
    );
    if (!updated) throw new CollectionNotFoundError(id);
    await ctx.audit({
      action: AuditActions.COLLECTION_UPDATED,
      resource: AuditResources.COLLECTION,
      resourceId: id,
      newValue: input,
    });
    return updated;
  },

  async delete(tx: DrizzleDb, id: string, orgId: string) {
    const [row] = await tx
      .delete(workspaceCollections)
      .where(
        and(
          eq(workspaceCollections.id, id),
          eq(workspaceCollections.organizationId, orgId),
        ),
      )
      .returning();

    return row ?? null;
  },

  async deleteWithAudit(ctx: ServiceContext, id: string) {
    assertEditorOrAdmin(ctx.actor.role);
    // Visibility check: private collections only deletable by owner
    const existing = await collectionService.getById(
      ctx.tx,
      id,
      ctx.actor.orgId,
      ctx.actor.userId,
    );
    if (!existing) throw new CollectionNotFoundError(id);
    const deleted = await collectionService.delete(ctx.tx, id, ctx.actor.orgId);
    if (!deleted) throw new CollectionNotFoundError(id);
    await ctx.audit({
      action: AuditActions.COLLECTION_DELETED,
      resource: AuditResources.COLLECTION,
      resourceId: id,
      newValue: { name: deleted.name },
    });
    return deleted;
  },

  // -------------------------------------------------------------------------
  // Item management
  // -------------------------------------------------------------------------

  async addItem(
    tx: DrizzleDb,
    collectionId: string,
    input: AddCollectionItemInput,
    orgId: string,
    userId?: string,
  ) {
    // Verify collection exists, belongs to org, and is visible to user
    const collection = await collectionService.getById(
      tx,
      collectionId,
      orgId,
      userId,
    );
    if (!collection) throw new CollectionNotFoundError(collectionId);

    // Cross-tenant validation: verify submission belongs to the same org
    const [sub] = await tx
      .select({ id: submissions.id })
      .from(submissions)
      .where(
        and(
          eq(submissions.id, input.submissionId),
          eq(submissions.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!sub) throw new SubmissionNotInOrgError(input.submissionId);

    // Determine position: use provided or append to end
    let position = input.position;
    if (position === undefined) {
      const [maxItem] = await tx
        .select({ position: workspaceItems.position })
        .from(workspaceItems)
        .where(eq(workspaceItems.collectionId, collectionId))
        .orderBy(desc(workspaceItems.position))
        .limit(1);
      position = maxItem ? maxItem.position + 1 : 0;
    }

    try {
      const [row] = await tx
        .insert(workspaceItems)
        .values({
          collectionId,
          submissionId: input.submissionId,
          position,
          notes: input.notes ?? null,
          color: input.color ?? null,
          icon: input.icon ?? null,
        })
        .returning();

      return row;
    } catch (err: unknown) {
      // Unique constraint violation: (collection_id, submission_id)
      if (
        err instanceof Error &&
        'code' in err &&
        (err as { code: string }).code === '23505'
      ) {
        throw new CollectionItemAlreadyExistsError(input.submissionId);
      }
      throw err;
    }
  },

  async addItemWithAudit(
    ctx: ServiceContext,
    collectionId: string,
    input: AddCollectionItemInput,
  ) {
    assertEditorOrAdmin(ctx.actor.role);
    const item = await collectionService.addItem(
      ctx.tx,
      collectionId,
      input,
      ctx.actor.orgId,
      ctx.actor.userId,
    );
    await ctx.audit({
      action: AuditActions.COLLECTION_ITEM_ADDED,
      resource: AuditResources.COLLECTION,
      resourceId: collectionId,
      newValue: { submissionId: input.submissionId },
    });
    return item;
  },

  async updateItem(
    tx: DrizzleDb,
    collectionId: string,
    itemId: string,
    input: UpdateCollectionItemInput,
    orgId: string,
    userId?: string,
  ) {
    // Verify collection belongs to org + visibility
    const collection = await collectionService.getById(
      tx,
      collectionId,
      orgId,
      userId,
    );
    if (!collection) return null;

    const values: Record<string, unknown> = { touchedAt: new Date() };
    if (input.notes !== undefined) values.notes = input.notes;
    if (input.color !== undefined) values.color = input.color;
    if (input.icon !== undefined) values.icon = input.icon;

    const [row] = await tx
      .update(workspaceItems)
      .set(values)
      .where(
        and(
          eq(workspaceItems.id, itemId),
          eq(workspaceItems.collectionId, collectionId),
        ),
      )
      .returning();

    return row ?? null;
  },

  async updateItemWithAudit(
    ctx: ServiceContext,
    collectionId: string,
    itemId: string,
    input: UpdateCollectionItemInput,
  ) {
    assertEditorOrAdmin(ctx.actor.role);
    const updated = await collectionService.updateItem(
      ctx.tx,
      collectionId,
      itemId,
      input,
      ctx.actor.orgId,
      ctx.actor.userId,
    );
    if (!updated) throw new CollectionItemNotFoundError(itemId);
    await ctx.audit({
      action: AuditActions.COLLECTION_ITEM_UPDATED,
      resource: AuditResources.COLLECTION,
      resourceId: collectionId,
      newValue: { itemId, ...input },
    });
    return updated;
  },

  async removeItem(
    tx: DrizzleDb,
    collectionId: string,
    itemId: string,
    orgId: string,
    userId?: string,
  ) {
    // Verify collection belongs to org + visibility
    const collection = await collectionService.getById(
      tx,
      collectionId,
      orgId,
      userId,
    );
    if (!collection) return null;

    const [row] = await tx
      .delete(workspaceItems)
      .where(
        and(
          eq(workspaceItems.id, itemId),
          eq(workspaceItems.collectionId, collectionId),
        ),
      )
      .returning();

    return row ?? null;
  },

  async removeItemWithAudit(
    ctx: ServiceContext,
    collectionId: string,
    itemId: string,
  ) {
    assertEditorOrAdmin(ctx.actor.role);
    const removed = await collectionService.removeItem(
      ctx.tx,
      collectionId,
      itemId,
      ctx.actor.orgId,
      ctx.actor.userId,
    );
    if (removed) {
      await ctx.audit({
        action: AuditActions.COLLECTION_ITEM_REMOVED,
        resource: AuditResources.COLLECTION,
        resourceId: collectionId,
        newValue: { itemId, submissionId: removed.submissionId },
      });
    }
    return removed;
  },

  async reorderItems(
    tx: DrizzleDb,
    collectionId: string,
    input: ReorderCollectionItemsInput,
    orgId: string,
    userId?: string,
  ) {
    // Verify collection belongs to org + visibility
    const collection = await collectionService.getById(
      tx,
      collectionId,
      orgId,
      userId,
    );
    if (!collection) throw new CollectionNotFoundError(collectionId);

    // Update all item positions
    await Promise.all(
      input.items.map((item) =>
        tx
          .update(workspaceItems)
          .set({ position: item.position, touchedAt: new Date() })
          .where(
            and(
              eq(workspaceItems.id, item.id),
              eq(workspaceItems.collectionId, collectionId),
            ),
          ),
      ),
    );

    // Return updated items in new order
    return collectionService.getItems(tx, collectionId, orgId);
  },
};
