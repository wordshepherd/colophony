import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const contributorPublicationRoleSchema = z
  .enum(["author", "translator", "illustrator", "photographer", "editor"])
  .describe("Contributor's role in a publication");

export type ContributorPublicationRole = z.infer<
  typeof contributorPublicationRoleSchema
>;

// ---------------------------------------------------------------------------
// Contributor response
// ---------------------------------------------------------------------------

export const contributorSchema = z.object({
  id: z.string().uuid().describe("Contributor ID"),
  organizationId: z.string().uuid().describe("Organization ID"),
  userId: z.string().uuid().nullable().describe("Linked Colophony user ID"),
  displayName: z.string().describe("Display name"),
  bio: z.string().nullable().describe("Biography"),
  pronouns: z.string().nullable().describe("Pronouns"),
  email: z.string().nullable().describe("Contact email"),
  website: z.string().nullable().describe("Website URL"),
  mailingAddress: z.string().nullable().describe("Mailing address (sensitive)"),
  notes: z.string().nullable().describe("Internal notes"),
  createdAt: z.date().describe("When the contributor was created"),
  updatedAt: z.date().describe("When the contributor was last updated"),
});

export type Contributor = z.infer<typeof contributorSchema>;

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export const createContributorSchema = z.object({
  displayName: z.string().trim().min(1).max(255).describe("Display name"),
  bio: z.string().max(5000).optional().describe("Biography"),
  pronouns: z.string().max(100).optional().describe("Pronouns"),
  email: z.string().email().max(320).optional().describe("Contact email"),
  website: z.string().url().max(2048).optional().describe("Website URL"),
  mailingAddress: z.string().max(2000).optional().describe("Mailing address"),
  notes: z.string().max(10000).optional().describe("Internal notes"),
  userId: z
    .string()
    .uuid()
    .optional()
    .describe("Link to existing Colophony user"),
});

export type CreateContributorInput = z.infer<typeof createContributorSchema>;

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export const updateContributorSchema = z.object({
  id: z.string().uuid().describe("Contributor ID to update"),
  displayName: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .optional()
    .describe("Display name"),
  bio: z.string().max(5000).nullable().optional().describe("Biography"),
  pronouns: z.string().max(100).nullable().optional().describe("Pronouns"),
  email: z
    .string()
    .email()
    .max(320)
    .nullable()
    .optional()
    .describe("Contact email"),
  website: z
    .string()
    .url()
    .max(2048)
    .nullable()
    .optional()
    .describe("Website URL"),
  mailingAddress: z
    .string()
    .max(2000)
    .nullable()
    .optional()
    .describe("Mailing address"),
  notes: z.string().max(10000).nullable().optional().describe("Internal notes"),
  userId: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .describe("Link/unlink Colophony user"),
});

export type UpdateContributorInput = z.infer<typeof updateContributorSchema>;

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export const listContributorsSchema = z.object({
  search: z
    .string()
    .trim()
    .max(200)
    .optional()
    .describe("Search by display name"),
  page: z.number().int().min(1).default(1).describe("Page number (1-based)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Items per page"),
});

export type ListContributorsInput = z.infer<typeof listContributorsSchema>;

// ---------------------------------------------------------------------------
// Contributor publication link
// ---------------------------------------------------------------------------

export const contributorPublicationSchema = z.object({
  id: z.string().uuid().describe("Contributor publication link ID"),
  contributorId: z.string().uuid().describe("Contributor ID"),
  pipelineItemId: z.string().uuid().describe("Pipeline item ID"),
  role: contributorPublicationRoleSchema,
  displayOrder: z.number().int().describe("Display order"),
  createdAt: z.date().describe("When the link was created"),
});

export type ContributorPublication = z.infer<
  typeof contributorPublicationSchema
>;

export const addContributorPublicationSchema = z.object({
  contributorId: z.string().uuid().describe("Contributor ID"),
  pipelineItemId: z.string().uuid().describe("Pipeline item ID"),
  role: contributorPublicationRoleSchema
    .default("author")
    .describe("Role in publication"),
  displayOrder: z.number().int().min(0).default(0).describe("Display order"),
});

export type AddContributorPublicationInput = z.infer<
  typeof addContributorPublicationSchema
>;

export const removeContributorPublicationSchema = z.object({
  contributorId: z.string().uuid().describe("Contributor ID"),
  pipelineItemId: z.string().uuid().describe("Pipeline item ID"),
  role: contributorPublicationRoleSchema.describe("Role to remove"),
});

export type RemoveContributorPublicationInput = z.infer<
  typeof removeContributorPublicationSchema
>;
