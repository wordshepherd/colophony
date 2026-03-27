import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const collectionVisibilitySchema = z
  .enum(["private", "team", "collaborators"])
  .describe("Visibility scope of the collection");

export type CollectionVisibility = z.infer<typeof collectionVisibilitySchema>;

export const collectionTypeHintSchema = z
  .enum(["holds", "reading_list", "comparison", "issue_planning", "custom"])
  .describe("Purpose hint for the collection");

export type CollectionTypeHint = z.infer<typeof collectionTypeHintSchema>;

// ---------------------------------------------------------------------------
// Output schemas
// ---------------------------------------------------------------------------

export const workspaceCollectionSchema = z.object({
  id: z.string().uuid().describe("Collection ID"),
  organizationId: z.string().uuid().describe("Organization ID"),
  ownerId: z.string().uuid().describe("Owner user ID"),
  name: z.string().describe("Collection name"),
  description: z.string().nullable().describe("Collection description"),
  visibility: collectionVisibilitySchema,
  typeHint: collectionTypeHintSchema,
  createdAt: z.date().describe("When the collection was created"),
  updatedAt: z.date().describe("When the collection was last updated"),
});

export type WorkspaceCollection = z.infer<typeof workspaceCollectionSchema>;

export const workspaceItemSchema = z.object({
  id: z.string().uuid().describe("Item ID"),
  collectionId: z.string().uuid().describe("Collection ID"),
  submissionId: z.string().uuid().describe("Submission ID"),
  position: z.number().int().describe("Sort position within collection"),
  notes: z.string().nullable().describe("Private editor notes"),
  color: z.string().nullable().describe("Label color"),
  icon: z.string().nullable().describe("Item icon"),
  readingAnchor: z
    .unknown()
    .nullable()
    .describe("Reading position anchor (deferred)"),
  addedAt: z.date().describe("When the item was added"),
  touchedAt: z.date().describe("When the item was last touched"),
  // Joined field (optional — populated by getItems query)
  submissionTitle: z.string().nullable().optional(),
});

export type WorkspaceItem = z.infer<typeof workspaceItemSchema>;

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

export const createCollectionSchema = z.object({
  name: z.string().trim().min(1).max(255).describe("Collection name"),
  description: z
    .string()
    .max(5000)
    .optional()
    .describe("Collection description"),
  visibility: collectionVisibilitySchema
    .optional()
    .describe("Visibility scope"),
  typeHint: collectionTypeHintSchema.optional().describe("Collection purpose"),
});

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;

export const updateCollectionSchema = createCollectionSchema.partial();

export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;

export const listCollectionsSchema = z.object({
  typeHint: collectionTypeHintSchema.optional().describe("Filter by type"),
  visibility: collectionVisibilitySchema
    .optional()
    .describe("Filter by visibility"),
  search: z.string().max(255).optional().describe("Search by name"),
  page: z.number().int().min(1).default(1).describe("Page number"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Items per page"),
});

export type ListCollectionsInput = z.infer<typeof listCollectionsSchema>;

export const addCollectionItemSchema = z.object({
  submissionId: z.string().uuid().describe("Submission to add"),
  position: z.number().int().min(0).optional().describe("Sort position"),
  notes: z.string().max(5000).optional().describe("Private notes"),
  color: z.string().max(50).optional().describe("Label color"),
  icon: z.string().max(50).optional().describe("Item icon"),
});

export type AddCollectionItemInput = z.infer<typeof addCollectionItemSchema>;

export const updateCollectionItemSchema = z.object({
  notes: z.string().max(5000).nullable().optional().describe("Private notes"),
  color: z.string().max(50).nullable().optional().describe("Label color"),
  icon: z.string().max(50).nullable().optional().describe("Item icon"),
});

export type UpdateCollectionItemInput = z.infer<
  typeof updateCollectionItemSchema
>;

export const reorderCollectionItemsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid().describe("Item ID"),
        position: z.number().int().min(0).describe("New position"),
      }),
    )
    .min(1)
    .max(1000)
    .describe("Items with new positions"),
});

export type ReorderCollectionItemsInput = z.infer<
  typeof reorderCollectionItemsSchema
>;
