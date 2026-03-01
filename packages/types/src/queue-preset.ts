import { z } from "zod";

export const presetFiltersSchema = z.object({
  status: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  periodFilter: z.string().optional(),
  search: z.string().optional(),
});
export type PresetFilters = z.infer<typeof presetFiltersSchema>;

export const queuePresetSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  filters: presetFiltersSchema,
  isDefault: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type QueuePreset = z.infer<typeof queuePresetSchema>;

export const createQueuePresetSchema = z.object({
  name: z.string().min(1).max(100),
  filters: presetFiltersSchema,
  isDefault: z.boolean().optional().default(false),
});
export type CreateQueuePresetInput = z.infer<typeof createQueuePresetSchema>;

export const updateQueuePresetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  filters: presetFiltersSchema.optional(),
  isDefault: z.boolean().optional(),
});
export type UpdateQueuePresetInput = z.infer<typeof updateQueuePresetSchema>;

export const deleteQueuePresetSchema = z.object({
  id: z.string().uuid(),
});
export type DeleteQueuePresetInput = z.infer<typeof deleteQueuePresetSchema>;
