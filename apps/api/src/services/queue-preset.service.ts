import { savedQueuePresets, eq, and, type DrizzleDb } from '@colophony/db';
import { asc, count, ne } from 'drizzle-orm';
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
    // Check limit
    const [{ value: existing }] = await tx
      .select({ value: count() })
      .from(savedQueuePresets)
      .where(eq(savedQueuePresets.userId, userId));

    if (existing >= MAX_PRESETS) {
      throw new PresetLimitExceededError();
    }

    // If isDefault, unset other defaults
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

    const [row] = await tx
      .insert(savedQueuePresets)
      .values({
        organizationId,
        userId,
        name: input.name,
        filters: input.filters,
        isDefault: input.isDefault ?? false,
      })
      .returning();

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

    const [row] = await tx
      .update(savedQueuePresets)
      .set(updates)
      .where(eq(savedQueuePresets.id, input.id))
      .returning();

    return row;
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
