import { contracts, eq, and, desc, type DrizzleDb } from '@colophony/db';
import { count } from 'drizzle-orm';
import type {
  GenerateContractInput,
  ListContractsInput,
  ContractStatus,
} from '@colophony/types';
import { AuditActions, AuditResources } from '@colophony/types';
import type { ServiceContext } from './types.js';
import { assertEditorOrAdmin } from './errors.js';
import {
  contractTemplateService,
  ContractTemplateNotFoundError,
} from './contract-template.service.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class ContractNotFoundError extends Error {
  constructor(id: string) {
    super(`Contract "${id}" not found`);
    this.name = 'ContractNotFoundError';
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const contractService = {
  // -------------------------------------------------------------------------
  // List / Get
  // -------------------------------------------------------------------------

  async list(tx: DrizzleDb, input: ListContractsInput) {
    const { status, pipelineItemId, page, limit } = input;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (status) conditions.push(eq(contracts.status, status));
    if (pipelineItemId)
      conditions.push(eq(contracts.pipelineItemId, pipelineItemId));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, countResult] = await Promise.all([
      tx
        .select()
        .from(contracts)
        .where(where)
        .orderBy(desc(contracts.createdAt))
        .limit(limit)
        .offset(offset),
      tx.select({ count: count() }).from(contracts).where(where),
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
      .from(contracts)
      .where(eq(contracts.id, id))
      .limit(1);

    return row ?? null;
  },

  async getByPipelineItemId(tx: DrizzleDb, pipelineItemId: string) {
    return tx
      .select()
      .from(contracts)
      .where(eq(contracts.pipelineItemId, pipelineItemId))
      .orderBy(desc(contracts.createdAt));
  },

  // -------------------------------------------------------------------------
  // Generate / Status / Void
  // -------------------------------------------------------------------------

  async generate(
    tx: DrizzleDb,
    input: GenerateContractInput,
    orgId: string,
    mergeDataOverrides?: Record<string, string>,
  ) {
    const template = await contractTemplateService.getById(
      tx,
      input.contractTemplateId,
    );
    if (!template)
      throw new ContractTemplateNotFoundError(input.contractTemplateId);

    const mergeData = { ...input.mergeData, ...mergeDataOverrides };
    const renderedBody = contractTemplateService.renderTemplate(
      template.body,
      mergeData,
    );

    const [row] = await tx
      .insert(contracts)
      .values({
        organizationId: orgId,
        pipelineItemId: input.pipelineItemId,
        contractTemplateId: input.contractTemplateId,
        renderedBody,
        mergeData,
      })
      .returning();

    return row;
  },

  async generateWithAudit(
    ctx: ServiceContext,
    input: GenerateContractInput,
    mergeDataOverrides?: Record<string, string>,
  ) {
    assertEditorOrAdmin(ctx.actor.role);
    const contract = await contractService.generate(
      ctx.tx,
      input,
      ctx.actor.orgId,
      mergeDataOverrides,
    );
    await ctx.audit({
      action: AuditActions.CONTRACT_GENERATED,
      resource: AuditResources.CONTRACT,
      resourceId: contract.id,
      newValue: {
        pipelineItemId: input.pipelineItemId,
        contractTemplateId: input.contractTemplateId,
      },
    });
    return contract;
  },

  async updateStatus(
    tx: DrizzleDb,
    id: string,
    status: ContractStatus,
    timestamps?: {
      signedAt?: Date;
      countersignedAt?: Date;
      completedAt?: Date;
    },
  ) {
    const values: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };
    if (timestamps?.signedAt) values.signedAt = timestamps.signedAt;
    if (timestamps?.countersignedAt)
      values.countersignedAt = timestamps.countersignedAt;
    if (timestamps?.completedAt) values.completedAt = timestamps.completedAt;

    const [row] = await tx
      .update(contracts)
      .set(values)
      .where(eq(contracts.id, id))
      .returning();

    return row ?? null;
  },

  async updateDocumensoId(
    tx: DrizzleDb,
    id: string,
    documensoDocumentId: string,
  ) {
    const [row] = await tx
      .update(contracts)
      .set({ documensoDocumentId, updatedAt: new Date() })
      .where(eq(contracts.id, id))
      .returning();

    return row ?? null;
  },

  async sendWithAudit(ctx: ServiceContext, id: string) {
    assertEditorOrAdmin(ctx.actor.role);
    const contract = await contractService.getById(ctx.tx, id);
    if (!contract) throw new ContractNotFoundError(id);
    if (contract.status !== 'DRAFT') {
      throw new Error(
        `Contract "${id}" has status "${contract.status}" — only DRAFT contracts can be sent`,
      );
    }
    const updated = await contractService.updateStatus(ctx.tx, id, 'SENT');
    if (!updated) throw new ContractNotFoundError(id);
    await ctx.audit({
      action: AuditActions.CONTRACT_SENT,
      resource: AuditResources.CONTRACT,
      resourceId: id,
      oldValue: { status: contract.status },
      newValue: { status: 'SENT' },
    });
    return updated;
  },

  async voidWithAudit(ctx: ServiceContext, id: string) {
    assertEditorOrAdmin(ctx.actor.role);
    const contract = await contractService.getById(ctx.tx, id);
    if (!contract) throw new ContractNotFoundError(id);
    const updated = await contractService.updateStatus(ctx.tx, id, 'VOIDED');
    if (!updated) throw new ContractNotFoundError(id);
    await ctx.audit({
      action: AuditActions.CONTRACT_VOIDED,
      resource: AuditResources.CONTRACT,
      resourceId: id,
      oldValue: { status: contract.status },
      newValue: { status: 'VOIDED' },
    });
    return updated;
  },
};
