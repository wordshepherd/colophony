import { z } from "zod";
import { fileSchema } from "./file";

// ---------------------------------------------------------------------------
// Core schemas
// ---------------------------------------------------------------------------

export const manuscriptSchema = z.object({
  id: z.string().uuid().describe("Unique identifier for the manuscript"),
  ownerId: z
    .string()
    .uuid()
    .describe("ID of the user who owns this manuscript"),
  title: z.string().describe("Title of the manuscript"),
  description: z
    .string()
    .nullable()
    .describe("Optional description of the manuscript"),
  createdAt: z.date().describe("When the manuscript was created"),
  updatedAt: z.date().describe("When the manuscript was last updated"),
});

export type Manuscript = z.infer<typeof manuscriptSchema>;

export const manuscriptVersionSchema = z.object({
  id: z.string().uuid().describe("Unique identifier for the version"),
  manuscriptId: z.string().uuid().describe("ID of the parent manuscript"),
  versionNumber: z
    .number()
    .int()
    .describe("Sequential version number (1, 2, 3, ...)"),
  label: z
    .string()
    .nullable()
    .describe(
      "Optional label (e.g. 'Initial draft', 'Revised after feedback')",
    ),
  createdAt: z.date().describe("When the version was created"),
});

export type ManuscriptVersion = z.infer<typeof manuscriptVersionSchema>;

// fileSchema and FileRecord are exported from ./file (canonical location)

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

export const createManuscriptSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe("Title of the manuscript (1-500 chars)"),
  description: z
    .string()
    .max(5000)
    .optional()
    .describe("Optional description (max 5,000 chars)"),
});

export type CreateManuscriptInput = z.infer<typeof createManuscriptSchema>;

export const updateManuscriptSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .optional()
    .describe("New title for the manuscript"),
  description: z
    .string()
    .max(5000)
    .nullable()
    .optional()
    .describe("New description (null to clear)"),
});

export type UpdateManuscriptInput = z.infer<typeof updateManuscriptSchema>;

export const createManuscriptVersionSchema = z.object({
  manuscriptId: z.string().uuid().describe("ID of the parent manuscript"),
  label: z
    .string()
    .max(255)
    .optional()
    .describe("Optional label for the version"),
});

export type CreateManuscriptVersionInput = z.infer<
  typeof createManuscriptVersionSchema
>;

export const listManuscriptsSchema = z.object({
  search: z
    .string()
    .trim()
    .max(200)
    .optional()
    .describe("Search by title (max 200 chars)"),
  page: z.number().int().min(1).default(1).describe("Page number (1-based)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Items per page (1-100, default 20)"),
});

export type ListManuscriptsInput = z.infer<typeof listManuscriptsSchema>;

// ---------------------------------------------------------------------------
// Detail / nested schemas
// ---------------------------------------------------------------------------

export const manuscriptVersionDetailSchema = manuscriptVersionSchema.extend({
  files: z.array(fileSchema).describe("Files attached to this version"),
});

export type ManuscriptVersionDetail = z.infer<
  typeof manuscriptVersionDetailSchema
>;

export const manuscriptDetailSchema = manuscriptSchema.extend({
  versions: z
    .array(manuscriptVersionDetailSchema)
    .describe("All versions of this manuscript with their files"),
});

export type ManuscriptDetail = z.infer<typeof manuscriptDetailSchema>;

// ---------------------------------------------------------------------------
// Related submissions (for withdraw prompt)
// ---------------------------------------------------------------------------

export const relatedSubmissionSchema = z.object({
  id: z.string().uuid().describe("Submission ID"),
  organizationId: z.string().uuid().describe("Organization ID"),
  status: z.string().describe("Current submission status"),
  title: z.string().nullable().describe("Submission title"),
  versionNumber: z.number().int().describe("Manuscript version number used"),
  submittedAt: z
    .date()
    .nullable()
    .describe("When the submission was submitted"),
});

export type RelatedSubmission = z.infer<typeof relatedSubmissionSchema>;

// ---------------------------------------------------------------------------
// Param schemas (for route params)
// ---------------------------------------------------------------------------

export const manuscriptIdParamSchema = z.object({
  manuscriptId: z.string().uuid(),
});

export const manuscriptVersionIdParamSchema = z.object({
  manuscriptVersionId: z.string().uuid(),
});
