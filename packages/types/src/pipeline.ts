import { z } from "zod";
import { issueStatusSchema } from "./issue";
import { proseMirrorDocSchema } from "./prosemirror";

// ---------------------------------------------------------------------------
// Pipeline stage
// ---------------------------------------------------------------------------

export const pipelineStageSchema = z
  .enum([
    "COPYEDIT_PENDING",
    "COPYEDIT_IN_PROGRESS",
    "AUTHOR_REVIEW",
    "PROOFREAD",
    "READY_TO_PUBLISH",
    "PUBLISHED",
    "WITHDRAWN",
  ])
  .describe("Current pipeline stage for the piece");

export type PipelineStage = z.infer<typeof pipelineStageSchema>;

// ---------------------------------------------------------------------------
// Stage transition logic
// ---------------------------------------------------------------------------

export const VALID_PIPELINE_TRANSITIONS: Record<
  PipelineStage,
  PipelineStage[]
> = {
  COPYEDIT_PENDING: ["COPYEDIT_IN_PROGRESS", "WITHDRAWN"],
  COPYEDIT_IN_PROGRESS: ["AUTHOR_REVIEW", "WITHDRAWN"],
  AUTHOR_REVIEW: ["COPYEDIT_IN_PROGRESS", "PROOFREAD", "WITHDRAWN"],
  PROOFREAD: ["READY_TO_PUBLISH", "AUTHOR_REVIEW", "WITHDRAWN"],
  READY_TO_PUBLISH: ["PUBLISHED", "PROOFREAD", "WITHDRAWN"],
  PUBLISHED: [],
  WITHDRAWN: [],
};

export function isValidPipelineTransition(
  from: PipelineStage,
  to: PipelineStage,
): boolean {
  return VALID_PIPELINE_TRANSITIONS[from].includes(to);
}

// ---------------------------------------------------------------------------
// Pipeline item response schema
// ---------------------------------------------------------------------------

export const pipelineItemSchema = z.object({
  id: z.string().uuid().describe("Pipeline item ID"),
  organizationId: z.string().uuid().describe("Organization ID"),
  submissionId: z.string().uuid().describe("Linked submission ID"),
  publicationId: z.string().uuid().nullable().describe("Target publication ID"),
  stage: pipelineStageSchema,
  assignedCopyeditorId: z
    .string()
    .uuid()
    .nullable()
    .describe("Assigned copyeditor user ID"),
  assignedProofreaderId: z
    .string()
    .uuid()
    .nullable()
    .describe("Assigned proofreader user ID"),
  copyeditDueAt: z.date().nullable().describe("Copyedit deadline"),
  proofreadDueAt: z.date().nullable().describe("Proofread deadline"),
  authorReviewDueAt: z.date().nullable().describe("Author review deadline"),
  inngestRunId: z
    .string()
    .nullable()
    .describe("Active Inngest workflow run ID"),
  createdAt: z.date().describe("When the item entered the pipeline"),
  updatedAt: z.date().describe("When the item was last updated"),
  // Joined fields (optional — populated by list/getById queries)
  submission: z.object({ title: z.string().nullable() }).optional(),
  publication: z.object({ name: z.string() }).optional(),
  assignedCopyeditor: z.object({ email: z.string() }).optional(),
  assignedProofreader: z.object({ email: z.string() }).optional(),
});

export type PipelineItem = z.infer<typeof pipelineItemSchema>;

// ---------------------------------------------------------------------------
// Pipeline history entry
// ---------------------------------------------------------------------------

export const pipelineHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  pipelineItemId: z.string().uuid(),
  fromStage: pipelineStageSchema.nullable(),
  toStage: pipelineStageSchema,
  changedBy: z.string().uuid().nullable(),
  comment: z.string().nullable(),
  changedAt: z.date(),
});

export type PipelineHistoryEntry = z.infer<typeof pipelineHistoryEntrySchema>;

// ---------------------------------------------------------------------------
// Pipeline comment
// ---------------------------------------------------------------------------

export const pipelineCommentSchema = z.object({
  id: z.string().uuid(),
  pipelineItemId: z.string().uuid(),
  authorId: z.string().uuid().nullable(),
  content: z.string(),
  stage: pipelineStageSchema,
  createdAt: z.date(),
});

export type PipelineComment = z.infer<typeof pipelineCommentSchema>;

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

export const createPipelineItemSchema = z.object({
  submissionId: z.string().uuid().describe("Submission to enter the pipeline"),
  publicationId: z
    .string()
    .uuid()
    .optional()
    .describe("Target publication (optional)"),
});

export type CreatePipelineItemInput = z.infer<typeof createPipelineItemSchema>;

export const updatePipelineStageSchema = z.object({
  stage: pipelineStageSchema.describe("Target stage"),
  comment: z
    .string()
    .max(2000)
    .optional()
    .describe("Optional comment for the transition"),
});

export type UpdatePipelineStageInput = z.infer<
  typeof updatePipelineStageSchema
>;

export const assignPipelineRoleSchema = z.object({
  userId: z.string().uuid().describe("User ID to assign"),
});

export type AssignPipelineRoleInput = z.infer<typeof assignPipelineRoleSchema>;

export const addPipelineCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1)
    .max(5000)
    .describe("Comment text (max 5,000 chars)"),
});

export type AddPipelineCommentInput = z.infer<typeof addPipelineCommentSchema>;

export const listPipelineItemsSchema = z.object({
  stage: pipelineStageSchema.optional().describe("Filter by pipeline stage"),
  publicationId: z.string().uuid().optional().describe("Filter by publication"),
  assignedCopyeditorId: z
    .string()
    .uuid()
    .optional()
    .describe("Filter by assigned copyeditor"),
  assignedProofreaderId: z
    .string()
    .uuid()
    .optional()
    .describe("Filter by assigned proofreader"),
  search: z
    .string()
    .trim()
    .max(200)
    .optional()
    .describe("Search by submission title"),
  page: z.number().int().min(1).default(1).describe("Page number (1-based)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Items per page (1-100, default 20)"),
});

export type ListPipelineItemsInput = z.infer<typeof listPipelineItemsSchema>;

// ---------------------------------------------------------------------------
// Copyedit
// ---------------------------------------------------------------------------

export const saveCopyeditInputSchema = z.object({
  content: z
    .object({
      type: z.literal("doc"),
      attrs: z.record(z.string(), z.unknown()).optional(),
      content: z.array(z.unknown()),
    })
    .passthrough()
    .describe("ProseMirror document with copyedited content"),
  label: z
    .string()
    .max(255)
    .optional()
    .describe("Version label (defaults to 'Copyedit')"),
});

export type SaveCopyeditInput = z.infer<typeof saveCopyeditInputSchema>;

export const copyeditContentSchema = z.object({
  content: z.unknown().nullable(),
  previousContent: z.unknown().nullable(),
  contentExtractionStatus: z.string(),
  genreHint: z.string().nullable(),
  versions: z.array(
    z.object({
      id: z.string().uuid(),
      versionNumber: z.number(),
      label: z.string().nullable(),
      createdAt: z.coerce.date(),
    }),
  ),
});

export type CopyeditContent = z.infer<typeof copyeditContentSchema>;

// ---------------------------------------------------------------------------
// Copyedit round-trip (export/import .docx)
// ---------------------------------------------------------------------------

export const exportCopyeditResponseSchema = z.object({
  downloadUrl: z.string().describe("Presigned S3 URL for the exported .docx"),
  filename: z.string().describe("Suggested filename for download"),
});

export type ExportCopyeditResponse = z.infer<
  typeof exportCopyeditResponseSchema
>;

export const importCopyeditInputSchema = z.object({
  id: z.string().uuid().describe("Pipeline item ID"),
  fileBase64: z.string().describe("Base64-encoded .docx file"),
  filename: z.string().max(255).describe("Original filename"),
});

export type ImportCopyeditInput = z.infer<typeof importCopyeditInputSchema>;

export const importCopyeditResponseSchema = z.object({
  versionId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  content: proseMirrorDocSchema,
});

export type ImportCopyeditResponse = z.infer<
  typeof importCopyeditResponseSchema
>;

// ---------------------------------------------------------------------------
// Production dashboard
// ---------------------------------------------------------------------------

export const productionDashboardInputSchema = z.object({
  issueId: z
    .string()
    .uuid()
    .optional()
    .describe(
      "Issue to show. If omitted, auto-selects the first non-terminal issue",
    ),
});

export type ProductionDashboardInput = z.infer<
  typeof productionDashboardInputSchema
>;

export const productionDashboardItemSchema = z.object({
  pipelineItemId: z.string().uuid(),
  stage: pipelineStageSchema,
  submissionId: z.string().uuid(),
  submissionTitle: z.string().nullable(),
  issueId: z.string().uuid(),
  issueTitle: z.string(),
  issueSectionTitle: z.string().nullable(),
  sortOrder: z.number().int().nullable(),
  publicationDate: z.coerce.date().nullable(),
  assignedCopyeditorEmail: z.string().nullable(),
  assignedProofreaderEmail: z.string().nullable(),
  copyeditDueAt: z.coerce.date().nullable(),
  proofreadDueAt: z.coerce.date().nullable(),
  authorReviewDueAt: z.coerce.date().nullable(),
  daysInStage: z.number().int(),
  lastStageChangeAt: z.coerce.date(),
  contractStatus: z.string().nullable(),
});

export type ProductionDashboardItem = z.infer<
  typeof productionDashboardItemSchema
>;

export const productionDashboardSummarySchema = z.object({
  total: z.number().int(),
  onTrack: z.number().int(),
  atRisk: z.number().int(),
  overdue: z.number().int(),
  waiting: z.number().int(),
});

export type ProductionDashboardSummary = z.infer<
  typeof productionDashboardSummarySchema
>;

export const productionDashboardSchema = z.object({
  issueId: z.string().uuid(),
  issueTitle: z.string(),
  issueStatus: issueStatusSchema,
  publicationDate: z.coerce.date().nullable(),
  items: z.array(productionDashboardItemSchema),
  summary: productionDashboardSummarySchema,
});

export type ProductionDashboard = z.infer<typeof productionDashboardSchema>;

export const activeIssueSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  status: issueStatusSchema,
  publicationDate: z.coerce.date().nullable(),
});

export type ActiveIssue = z.infer<typeof activeIssueSchema>;
