import { z } from "zod";

// ---------------------------------------------------------------------------
// Issue status
// ---------------------------------------------------------------------------

export const issueStatusSchema = z
  .enum(["PLANNING", "ASSEMBLING", "READY", "PUBLISHED", "ARCHIVED"])
  .describe("Current status of the issue");

export type IssueStatus = z.infer<typeof issueStatusSchema>;

// ---------------------------------------------------------------------------
// Issue schemas
// ---------------------------------------------------------------------------

export const issueSchema = z.object({
  id: z.string().uuid().describe("Issue ID"),
  organizationId: z.string().uuid().describe("Organization ID"),
  publicationId: z.string().uuid().describe("Publication ID"),
  title: z.string().describe("Issue title"),
  volume: z.number().int().nullable().describe("Volume number"),
  issueNumber: z.number().int().nullable().describe("Issue number"),
  description: z.string().nullable().describe("Issue description"),
  coverImageUrl: z.string().nullable().describe("Cover image URL"),
  status: issueStatusSchema,
  publicationDate: z.date().nullable().describe("Scheduled publication date"),
  publishedAt: z.date().nullable().describe("Actual publish timestamp"),
  metadata: z.record(z.string(), z.unknown()).nullable().describe("Metadata"),
  createdAt: z.date().describe("When the issue was created"),
  updatedAt: z.date().describe("When the issue was last updated"),
});

export type Issue = z.infer<typeof issueSchema>;

export const issueSectionSchema = z.object({
  id: z.string().uuid().describe("Section ID"),
  issueId: z.string().uuid().describe("Issue ID"),
  title: z.string().describe("Section title"),
  sortOrder: z.number().int().describe("Sort order"),
  createdAt: z.date().describe("When the section was created"),
});

export type IssueSection = z.infer<typeof issueSectionSchema>;

export const issueItemSchema = z.object({
  id: z.string().uuid().describe("Issue item ID"),
  issueId: z.string().uuid().describe("Issue ID"),
  pipelineItemId: z.string().uuid().describe("Pipeline item ID"),
  issueSectionId: z
    .string()
    .uuid()
    .nullable()
    .describe("Section ID (if assigned)"),
  sortOrder: z.number().int().describe("Sort order within section"),
  createdAt: z.date().describe("When the item was added"),
});

export type IssueItem = z.infer<typeof issueItemSchema>;

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

export const createIssueSchema = z.object({
  publicationId: z.string().uuid().describe("Publication ID"),
  title: z.string().trim().min(1).max(500).describe("Issue title"),
  volume: z.number().int().positive().optional().describe("Volume number"),
  issueNumber: z.number().int().positive().optional().describe("Issue number"),
  description: z.string().max(5000).optional().describe("Issue description"),
  coverImageUrl: z
    .string()
    .url()
    .max(1000)
    .optional()
    .describe("Cover image URL"),
  publicationDate: z.coerce
    .date()
    .optional()
    .describe("Scheduled publication date"),
});

export type CreateIssueInput = z.infer<typeof createIssueSchema>;

export const updateIssueSchema = z.object({
  title: z.string().trim().min(1).max(500).optional().describe("New title"),
  volume: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .describe("New volume number"),
  issueNumber: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .describe("New issue number"),
  description: z
    .string()
    .max(5000)
    .nullable()
    .optional()
    .describe("New description"),
  coverImageUrl: z
    .string()
    .url()
    .max(1000)
    .nullable()
    .optional()
    .describe("New cover image URL"),
  publicationDate: z.coerce
    .date()
    .nullable()
    .optional()
    .describe("New publication date"),
});

export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;

export const listIssuesSchema = z.object({
  publicationId: z.string().uuid().optional().describe("Filter by publication"),
  status: issueStatusSchema.optional().describe("Filter by status"),
  search: z.string().trim().max(200).optional().describe("Search by title"),
  page: z.number().int().min(1).default(1).describe("Page number (1-based)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Items per page (1-100, default 20)"),
});

export type ListIssuesInput = z.infer<typeof listIssuesSchema>;

export const addIssueItemSchema = z.object({
  pipelineItemId: z.string().uuid().describe("Pipeline item to add"),
  issueSectionId: z
    .string()
    .uuid()
    .optional()
    .describe("Section to place item in"),
  sortOrder: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Sort order within section"),
});

export type AddIssueItemInput = z.infer<typeof addIssueItemSchema>;

export const addIssueSectionSchema = z.object({
  title: z.string().trim().min(1).max(255).describe("Section title"),
  sortOrder: z.number().int().min(0).optional().describe("Sort order"),
});

export type AddIssueSectionInput = z.infer<typeof addIssueSectionSchema>;

export const reorderItemsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        sortOrder: z.number().int().min(0),
      }),
    )
    .describe("Items with new sort orders"),
});

export type ReorderItemsInput = z.infer<typeof reorderItemsSchema>;
