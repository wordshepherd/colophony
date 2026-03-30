import { z } from "zod";

// ---------------------------------------------------------------------------
// Portfolio Entry — user-scoped publication portfolio
// ---------------------------------------------------------------------------

export const portfolioEntryTypeSchema = z
  .enum(["colophony_verified", "federation_verified", "external"])
  .describe("Source type of the portfolio entry");

export type PortfolioEntryType = z.infer<typeof portfolioEntryTypeSchema>;

// --- Response schema ---

export const portfolioEntrySchema = z.object({
  id: z.string().uuid().describe("Unique identifier"),
  userId: z.string().uuid().describe("Owner user ID"),
  type: portfolioEntryTypeSchema,
  title: z.string().describe("Published work title"),
  publicationName: z.string().describe("Journal/magazine name"),
  publishedAt: z.date().nullable().describe("Publication date"),
  url: z.string().nullable().describe("Link to published work"),
  contributorPublicationId: z
    .string()
    .uuid()
    .nullable()
    .describe("Linked contributor_publication (colophony_verified only)"),
  federationSourceInstance: z
    .string()
    .nullable()
    .describe("Federation source instance (future)"),
  federationEntryId: z
    .string()
    .uuid()
    .nullable()
    .describe("Federation entry ID (future)"),
  notes: z.string().nullable().describe("Private notes"),
  createdAt: z.date().describe("When the entry was created"),
  updatedAt: z.date().describe("When the entry was last updated"),
});

export type PortfolioEntry = z.infer<typeof portfolioEntrySchema>;

// --- Create schema (external entries only — colophony_verified created automatically) ---

export const createPortfolioEntrySchema = z.object({
  title: z.string().trim().min(1).max(500).describe("Published work title"),
  publicationName: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe("Journal/magazine name"),
  publishedAt: z.coerce.date().optional().describe("Publication date"),
  url: z.string().url().max(2048).optional().describe("Link to published work"),
  notes: z.string().max(5000).optional().describe("Private notes"),
});

export type CreatePortfolioEntryInput = z.infer<
  typeof createPortfolioEntrySchema
>;

// --- Update schema ---

export const updatePortfolioEntrySchema = z
  .object({
    id: z.string().uuid().describe("Entry ID to update"),
    title: z.string().trim().min(1).max(500).optional().describe("New title"),
    publicationName: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .optional()
      .describe("New publication name"),
    publishedAt: z.coerce
      .date()
      .nullable()
      .optional()
      .describe("Updated publication date"),
    url: z
      .string()
      .url()
      .max(2048)
      .nullable()
      .optional()
      .describe("Updated URL"),
    notes: z.string().max(5000).nullable().optional().describe("Updated notes"),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.publicationName !== undefined ||
      data.publishedAt !== undefined ||
      data.url !== undefined ||
      data.notes !== undefined,
    { message: "At least one field to update is required" },
  );

export type UpdatePortfolioEntryInput = z.infer<
  typeof updatePortfolioEntrySchema
>;

// --- List schema ---

export const listPortfolioEntriesSchema = z.object({
  type: portfolioEntryTypeSchema.optional().describe("Filter by entry type"),
  page: z.number().int().min(1).default(1).describe("Page number (1-based)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Items per page (1-100, default 20)"),
});

export type ListPortfolioEntriesInput = z.infer<
  typeof listPortfolioEntriesSchema
>;
