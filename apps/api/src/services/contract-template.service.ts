import {
  contractTemplates,
  eq,
  and,
  desc,
  type DrizzleDb,
} from '@colophony/db';
import { ilike, count } from 'drizzle-orm';
import type {
  CreateContractTemplateInput,
  UpdateContractTemplateInput,
  ListContractTemplatesInput,
} from '@colophony/types';
import { AuditActions, AuditResources } from '@colophony/types';
import type { ServiceContext } from './types.js';
import { assertEditorOrAdmin } from './errors.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class ContractTemplateNotFoundError extends Error {
  constructor(id: string) {
    super(`Contract template "${id}" not found`);
    this.name = 'ContractTemplateNotFoundError';
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const contractTemplateService = {
  // -------------------------------------------------------------------------
  // List / Get
  // -------------------------------------------------------------------------

  async list(tx: DrizzleDb, input: ListContractTemplatesInput) {
    const { search, page, limit } = input;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (search) conditions.push(ilike(contractTemplates.name, `%${search}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, countResult] = await Promise.all([
      tx
        .select()
        .from(contractTemplates)
        .where(where)
        .orderBy(desc(contractTemplates.createdAt))
        .limit(limit)
        .offset(offset),
      tx.select({ count: count() }).from(contractTemplates).where(where),
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
      .from(contractTemplates)
      .where(eq(contractTemplates.id, id))
      .limit(1);

    return row ?? null;
  },

  // -------------------------------------------------------------------------
  // Create / Update / Delete
  // -------------------------------------------------------------------------

  async create(
    tx: DrizzleDb,
    input: CreateContractTemplateInput,
    orgId: string,
  ) {
    const [row] = await tx
      .insert(contractTemplates)
      .values({
        organizationId: orgId,
        name: input.name,
        description: input.description ?? null,
        body: input.body,
        mergeFields: input.mergeFields ?? null,
        isDefault: input.isDefault ?? false,
      })
      .returning();

    return row;
  },

  async createWithAudit(
    ctx: ServiceContext,
    input: CreateContractTemplateInput,
  ) {
    assertEditorOrAdmin(ctx.actor.role);
    const template = await contractTemplateService.create(
      ctx.tx,
      input,
      ctx.actor.orgId,
    );
    await ctx.audit({
      action: AuditActions.CONTRACT_TEMPLATE_CREATED,
      resource: AuditResources.CONTRACT_TEMPLATE,
      resourceId: template.id,
      newValue: { name: input.name },
    });
    return template;
  },

  async update(tx: DrizzleDb, id: string, input: UpdateContractTemplateInput) {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) values.name = input.name;
    if (input.description !== undefined)
      values.description = input.description ?? null;
    if (input.body !== undefined) values.body = input.body;
    if (input.mergeFields !== undefined)
      values.mergeFields = input.mergeFields ?? null;
    if (input.isDefault !== undefined) values.isDefault = input.isDefault;

    const [row] = await tx
      .update(contractTemplates)
      .set(values)
      .where(eq(contractTemplates.id, id))
      .returning();

    return row ?? null;
  },

  async updateWithAudit(
    ctx: ServiceContext,
    id: string,
    input: UpdateContractTemplateInput,
  ) {
    assertEditorOrAdmin(ctx.actor.role);
    const updated = await contractTemplateService.update(ctx.tx, id, input);
    if (!updated) throw new ContractTemplateNotFoundError(id);
    await ctx.audit({
      action: AuditActions.CONTRACT_TEMPLATE_UPDATED,
      resource: AuditResources.CONTRACT_TEMPLATE,
      resourceId: id,
      newValue: input,
    });
    return updated;
  },

  async delete(tx: DrizzleDb, id: string) {
    const [row] = await tx
      .delete(contractTemplates)
      .where(eq(contractTemplates.id, id))
      .returning();

    return row ?? null;
  },

  async deleteWithAudit(ctx: ServiceContext, id: string) {
    assertEditorOrAdmin(ctx.actor.role);
    const deleted = await contractTemplateService.delete(ctx.tx, id);
    if (!deleted) throw new ContractTemplateNotFoundError(id);
    await ctx.audit({
      action: AuditActions.CONTRACT_TEMPLATE_DELETED,
      resource: AuditResources.CONTRACT_TEMPLATE,
      resourceId: id,
      oldValue: { name: deleted.name },
    });
    return deleted;
  },

  // -------------------------------------------------------------------------
  // Template rendering (pure function)
  // -------------------------------------------------------------------------

  renderTemplate(body: string, mergeData: Record<string, string>): string {
    return body.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      return mergeData[key] ?? `{{${key}}}`;
    });
  },
};
