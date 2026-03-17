import { cmsConnections, eq, and, type DrizzleDb } from '@colophony/db';
import { desc, count } from 'drizzle-orm';
import type {
  CreateCmsConnectionInput,
  UpdateCmsConnectionInput,
  ListCmsConnectionsInput,
} from '@colophony/types';
import { AuditActions, AuditResources } from '@colophony/types';
import type { ServiceContext } from './types.js';
import { assertEditorOrAdmin } from './errors.js';
import { getCmsAdapter } from '../adapters/cms/index.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class CmsConnectionNotFoundError extends Error {
  constructor(id: string) {
    super(`CMS connection "${id}" not found`);
    this.name = 'CmsConnectionNotFoundError';
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const cmsConnectionService = {
  // -------------------------------------------------------------------------
  // List / Get
  // -------------------------------------------------------------------------

  async list(tx: DrizzleDb, input: ListCmsConnectionsInput, orgId?: string) {
    const { publicationId, page, limit } = input;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (orgId) {
      conditions.push(eq(cmsConnections.organizationId, orgId));
    }
    if (publicationId) {
      conditions.push(eq(cmsConnections.publicationId, publicationId));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, countResult] = await Promise.all([
      tx
        .select()
        .from(cmsConnections)
        .where(where)
        .orderBy(desc(cmsConnections.createdAt))
        .limit(limit)
        .offset(offset),
      tx.select({ count: count() }).from(cmsConnections).where(where),
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

  async getById(tx: DrizzleDb, id: string, orgId?: string) {
    const [row] = await tx
      .select()
      .from(cmsConnections)
      .where(
        orgId
          ? and(
              eq(cmsConnections.id, id),
              eq(cmsConnections.organizationId, orgId),
            )
          : eq(cmsConnections.id, id),
      )
      .limit(1);

    return row ?? null;
  },

  // -------------------------------------------------------------------------
  // Create / Update / Delete
  // -------------------------------------------------------------------------

  async create(tx: DrizzleDb, input: CreateCmsConnectionInput, orgId: string) {
    const [row] = await tx
      .insert(cmsConnections)
      .values({
        organizationId: orgId,
        adapterType: input.adapterType,
        name: input.name,
        config: input.config,
        publicationId: input.publicationId ?? null,
      })
      .returning();

    return row;
  },

  async createWithAudit(ctx: ServiceContext, input: CreateCmsConnectionInput) {
    assertEditorOrAdmin(ctx.actor.role);
    const connection = await cmsConnectionService.create(
      ctx.tx,
      input,
      ctx.actor.orgId,
    );
    await ctx.audit({
      action: AuditActions.CMS_CONNECTION_CREATED,
      resource: AuditResources.CMS_CONNECTION,
      resourceId: connection.id,
      newValue: { name: input.name, adapterType: input.adapterType },
    });
    return connection;
  },

  async update(
    tx: DrizzleDb,
    id: string,
    input: UpdateCmsConnectionInput,
    orgId?: string,
  ) {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) values.name = input.name;
    if (input.config !== undefined) values.config = input.config;
    if (input.isActive !== undefined) values.isActive = input.isActive;

    const [row] = await tx
      .update(cmsConnections)
      .set(values)
      .where(
        orgId
          ? and(
              eq(cmsConnections.id, id),
              eq(cmsConnections.organizationId, orgId),
            )
          : eq(cmsConnections.id, id),
      )
      .returning();

    return row ?? null;
  },

  async updateWithAudit(
    ctx: ServiceContext,
    id: string,
    input: UpdateCmsConnectionInput,
  ) {
    assertEditorOrAdmin(ctx.actor.role);
    const updated = await cmsConnectionService.update(
      ctx.tx,
      id,
      input,
      ctx.actor.orgId,
    );
    if (!updated) throw new CmsConnectionNotFoundError(id);
    await ctx.audit({
      action: AuditActions.CMS_CONNECTION_UPDATED,
      resource: AuditResources.CMS_CONNECTION,
      resourceId: id,
      newValue: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.config !== undefined && { configUpdated: true }),
      },
    });
    return updated;
  },

  async delete(tx: DrizzleDb, id: string, orgId?: string) {
    const [row] = await tx
      .delete(cmsConnections)
      .where(
        orgId
          ? and(
              eq(cmsConnections.id, id),
              eq(cmsConnections.organizationId, orgId),
            )
          : eq(cmsConnections.id, id),
      )
      .returning();

    return row ?? null;
  },

  async deleteWithAudit(ctx: ServiceContext, id: string) {
    assertEditorOrAdmin(ctx.actor.role);
    const deleted = await cmsConnectionService.delete(
      ctx.tx,
      id,
      ctx.actor.orgId,
    );
    if (!deleted) throw new CmsConnectionNotFoundError(id);
    await ctx.audit({
      action: AuditActions.CMS_CONNECTION_DELETED,
      resource: AuditResources.CMS_CONNECTION,
      resourceId: id,
      oldValue: { name: deleted.name, adapterType: deleted.adapterType },
    });
    return deleted;
  },

  // -------------------------------------------------------------------------
  // Test connection
  // -------------------------------------------------------------------------

  async testConnection(tx: DrizzleDb, id: string, orgId?: string) {
    const connection = await cmsConnectionService.getById(tx, id, orgId);
    if (!connection) throw new CmsConnectionNotFoundError(id);

    const adapter = getCmsAdapter(connection.adapterType);
    return adapter.testConnection(connection.config);
  },

  async testConnectionWithAudit(ctx: ServiceContext, id: string) {
    let result: { success: boolean; error?: string };
    try {
      result = await cmsConnectionService.testConnection(
        ctx.tx,
        id,
        ctx.actor.orgId,
      );
    } catch (error) {
      await ctx.audit({
        action: AuditActions.CMS_CONNECTION_TESTED,
        resource: AuditResources.CMS_CONNECTION,
        resourceId: id,
        newValue: { success: false },
      });
      throw error;
    }
    await ctx.audit({
      action: AuditActions.CMS_CONNECTION_TESTED,
      resource: AuditResources.CMS_CONNECTION,
      resourceId: id,
      newValue: { success: result.success },
    });
    return result;
  },

  // -------------------------------------------------------------------------
  // Helpers for Inngest workers
  // -------------------------------------------------------------------------

  async listByPublication(
    tx: DrizzleDb,
    publicationId: string,
    orgId?: string,
  ) {
    const conditions = [
      eq(cmsConnections.publicationId, publicationId),
      eq(cmsConnections.isActive, true),
    ];
    if (orgId) {
      conditions.push(eq(cmsConnections.organizationId, orgId));
    }
    return tx
      .select()
      .from(cmsConnections)
      .where(and(...conditions))
      .limit(10000);
  },

  async updateLastSync(tx: DrizzleDb, id: string, orgId?: string) {
    await tx
      .update(cmsConnections)
      .set({ lastSyncAt: new Date(), updatedAt: new Date() })
      .where(
        orgId
          ? and(
              eq(cmsConnections.id, id),
              eq(cmsConnections.organizationId, orgId),
            )
          : eq(cmsConnections.id, id),
      );
  },
};
