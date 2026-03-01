import { savedQueuePresets, eq, and, sql, type DrizzleDb } from '@colophony/db';
import { asc, ne } from 'drizzle-orm';
import type {
  CreateQueuePresetInput,
  UpdateQueuePresetInput,
} from '@colophony/types';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class PresetLimitExceededError extends Error {
  constructor() {
    super('Maximum of 20 saved presets reached');
    this.name = 'PresetLimitExceededError';
  }
}

export class PresetNotFoundError extends Error {
  constructor(id: string) {
    super(`Preset "${id}" not found`);
    this.name = 'PresetNotFoundError';
  }
}

export class PresetDefaultConflictError extends Error {
  constructor() {
    super('Another preset was set as default concurrently. Please retry.');
    this.name = 'PresetDefaultConflictError';
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === '23505'
  );
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const MAX_PRESETS = 20;

export const queuePresetService = {
  async list(tx: DrizzleDb, userId: string) {
    return tx
      .select()
      .from(savedQueuePresets)
      .where(eq(savedQueuePresets.userId, userId))
      .orderBy(asc(savedQueuePresets.name));
  },

  async create(
    tx: DrizzleDb,
    userId: string,
    organizationId: string,
    input: CreateQueuePresetInput,
  ) {
    // If isDefault, unset other defaults first
    if (input.isDefault) {
      await tx
        .update(savedQueuePresets)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(savedQueuePresets.userId, userId),
            eq(savedQueuePresets.isDefault, true),
          ),
        );
    }

    // Atomic insert-with-count-guard: INSERT ... SELECT ... WHERE count < MAX
    const isDefault = input.isDefault ?? false;
    const result = await tx.execute<{
      id: string;
      organization_id: string;
      user_id: string;
      name: string;
      filters: unknown;
      is_default: boolean;
      created_at: Date;
      updated_at: Date;
    }>(sql`
      INSERT INTO saved_queue_presets (organization_id, user_id, name, filters, is_default)
      SELECT ${organizationId}, ${userId}, ${input.name}, ${JSON.stringify(input.filters)}::jsonb, ${isDefault}
      WHERE (
        SELECT count(*) FROM saved_queue_presets WHERE user_id = ${userId}
      ) < ${MAX_PRESETS}
      RETURNING *
    `);

    const row = result.rows[0];
    if (!row) {
      throw new PresetLimitExceededError();
    }

    return row;
  },

  async update(tx: DrizzleDb, userId: string, input: UpdateQueuePresetInput) {
    // Check ownership
    const [existing] = await tx
      .select({ id: savedQueuePresets.id })
      .from(savedQueuePresets)
      .where(
        and(
          eq(savedQueuePresets.id, input.id),
          eq(savedQueuePresets.userId, userId),
        ),
      );

    if (!existing) {
      throw new PresetNotFoundError(input.id);
    }

    // If setting as default, unset others
    if (input.isDefault) {
      await tx
        .update(savedQueuePresets)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(savedQueuePresets.userId, userId),
            eq(savedQueuePresets.isDefault, true),
            ne(savedQueuePresets.id, input.id),
          ),
        );
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.filters !== undefined) updates.filters = input.filters;
    if (input.isDefault !== undefined) updates.isDefault = input.isDefault;

    try {
      const [row] = await tx
        .update(savedQueuePresets)
        .set(updates)
        .where(eq(savedQueuePresets.id, input.id))
        .returning();

      return row;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new PresetDefaultConflictError();
      }
      throw err;
    }
  },

  async delete(tx: DrizzleDb, userId: string, id: string) {
    const [existing] = await tx
      .select({ id: savedQueuePresets.id })
      .from(savedQueuePresets)
      .where(
        and(eq(savedQueuePresets.id, id), eq(savedQueuePresets.userId, userId)),
      );

    if (!existing) {
      throw new PresetNotFoundError(id);
    }

    await tx.delete(savedQueuePresets).where(eq(savedQueuePresets.id, id));

    return { deleted: true };
  },
};
