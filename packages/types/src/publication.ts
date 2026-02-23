import { z } from "zod";

// ---------------------------------------------------------------------------
// Publication status
// ---------------------------------------------------------------------------

export const publicationStatusSchema = z
  .enum(["ACTIVE", "ARCHIVED"])
  .describe("Current status of the publication");

export type PublicationStatus = z.infer<typeof publicationStatusSchema>;

// ---------------------------------------------------------------------------
// Publication response schema
// ---------------------------------------------------------------------------

export const publicationSchema = z.object({
  id: z.string().uuid().describe("Unique identifier for the publication"),
  organizationId: z.string().uuid().describe("ID of the owning organization"),
  name: z.string().describe("Display name of the publication"),
  slug: z.string().describe("URL-friendly slug (unique per org)"),
  description: z
    .string()
    .nullable()
    .describe("Optional description of the publication"),
  settings: z
    .record(z.string(), z.unknown())
    .nullable()
    .describe("Publication settings (default contract template, CMS config)"),
  status: publicationStatusSchema,
  createdAt: z.date().describe("When the publication was created"),
  updatedAt: z.date().describe("When the publication was last updated"),
});

export type Publication = z.infer<typeof publicationSchema>;

// ---------------------------------------------------------------------------
// Create / Update input schemas
// ---------------------------------------------------------------------------

export const createPublicationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .describe("Display name for the publication"),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase alphanumeric with hyphens",
    )
    .describe("URL-friendly slug (lowercase alphanumeric + hyphens)"),
  description: z
    .string()
    .max(2000)
    .optional()
    .describe("Description of the publication (max 2,000 chars)"),
  settings: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Publication settings"),
});

export type CreatePublicationInput = z.infer<typeof createPublicationSchema>;

export const updatePublicationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .optional()
    .describe("New display name"),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase alphanumeric with hyphens",
    )
    .optional()
    .describe("New URL-friendly slug"),
  description: z
    .string()
    .max(2000)
    .nullable()
    .optional()
    .describe("New description (null to clear)"),
  settings: z
    .record(z.string(), z.unknown())
    .nullable()
    .optional()
    .describe("New settings (null to clear)"),
});

export type UpdatePublicationInput = z.infer<typeof updatePublicationSchema>;

// ---------------------------------------------------------------------------
// List / filter input schema
// ---------------------------------------------------------------------------

export const listPublicationsSchema = z.object({
  status: publicationStatusSchema
    .optional()
    .describe("Filter by publication status"),
  search: z
    .string()
    .trim()
    .max(200)
    .optional()
    .describe("Search by name (max 200 chars)"),
  page: z.number().int().min(1).default(1).describe("Page number (1-based)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Items per page (1-100, default 20)"),
});

export type ListPublicationsInput = z.infer<typeof listPublicationsSchema>;
