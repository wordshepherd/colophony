import { writerProfiles, eq, type DrizzleDb } from '@colophony/db';
import { AuditActions, AuditResources } from '@colophony/types';
import type { UserServiceContext } from './types.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class WriterProfileNotFoundError extends Error {
  constructor(id: string) {
    super(`Writer profile "${id}" not found`);
    this.name = 'WriterProfileNotFoundError';
  }
}

export class WriterProfileDuplicateError extends Error {
  constructor(platform: string) {
    super(`A writer profile for platform "${platform}" already exists`);
    this.name = 'WriterProfileDuplicateError';
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const writerProfileService = {
  async list(tx: DrizzleDb, userId: string) {
    return tx
      .select()
      .from(writerProfiles)
      .where(eq(writerProfiles.userId, userId));
  },

  async getById(tx: DrizzleDb, id: string) {
    const [row] = await tx
      .select()
      .from(writerProfiles)
      .where(eq(writerProfiles.id, id))
      .limit(1);
    return row ?? null;
  },

  async create(
    tx: DrizzleDb,
    userId: string,
    input: {
      platform: string;
      externalId?: string;
      profileUrl?: string;
    },
  ) {
    try {
      const [row] = await tx
        .insert(writerProfiles)
        .values({
          userId,
          platform: input.platform,
          externalId: input.externalId ?? null,
          profileUrl: input.profileUrl ?? null,
        })
        .returning();
      return row;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === '23505'
      ) {
        throw new WriterProfileDuplicateError(input.platform);
      }
      throw error;
    }
  },

  async update(
    tx: DrizzleDb,
    id: string,
    input: {
      platform?: string;
      externalId?: string;
      profileUrl?: string;
    },
  ) {
    const setData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.platform !== undefined) setData.platform = input.platform;
    if (input.externalId !== undefined) setData.externalId = input.externalId;
    if (input.profileUrl !== undefined) setData.profileUrl = input.profileUrl;

    const [updated] = await tx
      .update(writerProfiles)
      .set(setData)
      .where(eq(writerProfiles.id, id))
      .returning();
    return updated ?? null;
  },

  async delete(tx: DrizzleDb, id: string) {
    const [deleted] = await tx
      .delete(writerProfiles)
      .where(eq(writerProfiles.id, id))
      .returning();
    return deleted ?? null;
  },

  // -------------------------------------------------------------------------
  // Audited wrappers
  // -------------------------------------------------------------------------

  async createWithAudit(
    ctx: UserServiceContext,
    input: {
      platform: string;
      externalId?: string;
      profileUrl?: string;
    },
  ) {
    const row = await writerProfileService.create(ctx.tx, ctx.userId, input);
    await ctx.audit({
      action: AuditActions.WRITER_PROFILE_CREATED,
      resource: AuditResources.WRITER_PROFILE,
      resourceId: row.id,
      newValue: { platform: input.platform },
    });
    return row;
  },

  async updateWithAudit(
    ctx: UserServiceContext,
    id: string,
    input: {
      platform?: string;
      externalId?: string;
      profileUrl?: string;
    },
  ) {
    const existing = await writerProfileService.getById(ctx.tx, id);
    if (!existing) throw new WriterProfileNotFoundError(id);

    const updated = await writerProfileService.update(ctx.tx, id, input);
    if (!updated) throw new WriterProfileNotFoundError(id);

    await ctx.audit({
      action: AuditActions.WRITER_PROFILE_UPDATED,
      resource: AuditResources.WRITER_PROFILE,
      resourceId: id,
      newValue: input,
    });
    return updated;
  },

  async deleteWithAudit(ctx: UserServiceContext, id: string) {
    const existing = await writerProfileService.getById(ctx.tx, id);
    if (!existing) throw new WriterProfileNotFoundError(id);

    const deleted = await writerProfileService.delete(ctx.tx, id);
    if (!deleted) throw new WriterProfileNotFoundError(id);

    await ctx.audit({
      action: AuditActions.WRITER_PROFILE_DELETED,
      resource: AuditResources.WRITER_PROFILE,
      resourceId: id,
      newValue: { platform: existing.platform },
    });
  },
};
