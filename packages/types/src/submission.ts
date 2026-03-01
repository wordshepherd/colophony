import { z } from "zod";
import { scanStatusSchema, fileSchema } from "./file";

export const submissionStatusSchema = z
  .enum([
    "DRAFT",
    "SUBMITTED",
    "UNDER_REVIEW",
    "ACCEPTED",
    "REJECTED",
    "HOLD",
    "WITHDRAWN",
    "REVISE_AND_RESUBMIT",
  ])
  .describe("Current status in the submission workflow");

export type SubmissionStatus = z.infer<typeof submissionStatusSchema>;

// Re-export scanStatus from file.ts for backwards compatibility
export { scanStatusSchema };
export type { ScanStatus } from "./file";

export const submissionSchema = z.object({
  id: z.string().uuid().describe("Unique identifier for the submission"),
  organizationId: z
    .string()
    .uuid()
    .describe("ID of the organization this submission belongs to"),
  submitterId: z
    .string()
    .uuid()
    .nullable()
    .describe("ID of the user who created the submission"),
  submissionPeriodId: z
    .string()
    .uuid()
    .nullable()
    .describe("ID of the submission period, if applicable"),
  title: z.string().nullable().describe("Title of the submission"),
  content: z.string().nullable().describe("Body content of the submission"),
  coverLetter: z.string().nullable().describe("Optional cover letter"),
  formDefinitionId: z
    .string()
    .uuid()
    .nullable()
    .describe("ID of the form definition used, if applicable"),
  formData: z
    .record(z.string(), z.unknown())
    .nullable()
    .describe("Structured form data keyed by field key"),
  manuscriptVersionId: z
    .string()
    .uuid()
    .nullable()
    .describe("ID of the manuscript version attached to this submission"),
  status: submissionStatusSchema,
  submittedAt: z
    .date()
    .nullable()
    .describe("When the submission was formally submitted"),
  createdAt: z.date().describe("When the submission was created"),
  updatedAt: z.date().describe("When the submission was last updated"),
});

export type Submission = z.infer<typeof submissionSchema>;

/** Submission list item — includes submitter email for editor list view. */
export const submissionListItemSchema = submissionSchema.extend({
  submitterEmail: z
    .string()
    .email()
    .nullable()
    .describe("Email address of the submitter"),
});

export type SubmissionListItem = z.infer<typeof submissionListItemSchema>;

export const createSubmissionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe("Title of the submission (1-500 chars)"),
  content: z
    .string()
    .max(50000)
    .optional()
    .describe("Body content (max 50,000 chars)"),
  coverLetter: z
    .string()
    .max(10000)
    .optional()
    .describe("Optional cover letter (max 10,000 chars)"),
  submissionPeriodId: z
    .string()
    .uuid()
    .optional()
    .describe("Submission period to associate with"),
  formDefinitionId: z
    .string()
    .uuid()
    .optional()
    .describe("Form definition to use for structured data"),
  formData: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Structured form data keyed by field key"),
  manuscriptVersionId: z
    .string()
    .uuid()
    .optional()
    .describe("Manuscript version to attach to this submission"),
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;

export const updateSubmissionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .optional()
    .describe("New title for the submission"),
  content: z.string().max(50000).optional().describe("New body content"),
  coverLetter: z.string().max(10000).optional().describe("New cover letter"),
  formData: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Updated structured form data keyed by field key"),
});

export type UpdateSubmissionInput = z.infer<typeof updateSubmissionSchema>;

// Backwards-compatible aliases are exported from file.ts directly
// (submissionFileSchema, SubmissionFile) — no re-export needed here.

export const submissionHistorySchema = z.object({
  id: z.string().uuid().describe("History entry ID"),
  submissionId: z.string().uuid().describe("ID of the submission"),
  fromStatus: submissionStatusSchema
    .nullable()
    .describe("Previous status (null for initial creation)"),
  toStatus: submissionStatusSchema.describe("New status after the transition"),
  changedBy: z
    .string()
    .uuid()
    .nullable()
    .describe("ID of the user who made the change"),
  comment: z
    .string()
    .nullable()
    .describe("Optional comment explaining the status change"),
  changedAt: z.date().describe("When the status change occurred"),
});

export type SubmissionHistory = z.infer<typeof submissionHistorySchema>;

/** Submission detail — includes files and submitter email (for `getById`). */
export const submissionDetailSchema = submissionSchema.extend({
  files: z
    .array(fileSchema)
    .describe("Files attached to this submission (via manuscript version)"),
  submitterEmail: z
    .string()
    .email()
    .nullable()
    .describe("Email address of the submitter"),
  manuscript: z
    .object({
      manuscriptId: z.string().uuid(),
      manuscriptTitle: z.string(),
      versionNumber: z.number().int(),
    })
    .nullable()
    .describe("Linked manuscript info (null if no manuscript attached)"),
});

export type SubmissionDetail = z.infer<typeof submissionDetailSchema>;

/** Response from status-change mutations (submit, withdraw, updateStatus). */
export const submissionStatusChangeResponseSchema = z.object({
  submission: submissionSchema.describe(
    "The submission after the status change",
  ),
  historyEntry: submissionHistorySchema.describe(
    "The history entry for this transition",
  ),
});

export type SubmissionStatusChangeResponse = z.infer<
  typeof submissionStatusChangeResponseSchema
>;

export const updateSubmissionStatusSchema = z.object({
  status: submissionStatusSchema.describe("Target status for the transition"),
  comment: z
    .string()
    .max(1000)
    .optional()
    .describe("Optional comment for the status change (max 1,000 chars)"),
});

export type UpdateSubmissionStatusInput = z.infer<
  typeof updateSubmissionStatusSchema
>;

export const resubmitSchema = z.object({
  id: z.string().uuid(),
  manuscriptVersionId: z.string().uuid(),
});

export type ResubmitInput = z.infer<typeof resubmitSchema>;

export const submissionSortBySchema = z
  .enum(["title", "submitterEmail", "submittedAt", "status", "createdAt"])
  .default("createdAt")
  .describe("Field to sort submissions by");

export type SubmissionSortBy = z.infer<typeof submissionSortBySchema>;

export const sortOrderSchema = z
  .enum(["asc", "desc"])
  .default("desc")
  .describe("Sort direction");

export type SortOrder = z.infer<typeof sortOrderSchema>;

export const listSubmissionsSchema = z.object({
  status: submissionStatusSchema
    .optional()
    .describe("Filter by submission status"),
  submissionPeriodId: z
    .string()
    .uuid()
    .optional()
    .describe("Filter by submission period"),
  search: z
    .string()
    .trim()
    .max(200)
    .optional()
    .describe("Full-text search query (max 200 chars)"),
  sortBy: submissionSortBySchema.optional().describe("Sort field"),
  sortOrder: sortOrderSchema.optional().describe("Sort direction"),
  page: z.number().int().min(1).default(1).describe("Page number (1-based)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Items per page (1-100, default 20)"),
});

export type ListSubmissionsInput = z.infer<typeof listSubmissionsSchema>;

export const blindReviewModeSchema = z
  .enum(["none", "single_blind", "double_blind"])
  .describe("Blind review mode for the submission period");

export type BlindReviewMode = z.infer<typeof blindReviewModeSchema>;

export const submissionPeriodSchema = z.object({
  id: z.string().uuid().describe("Unique identifier for the submission period"),
  organizationId: z.string().uuid().describe("ID of the owning organization"),
  name: z.string().describe("Display name of the period"),
  description: z
    .string()
    .nullable()
    .describe("Optional description of the period"),
  opensAt: z.date().describe("When submissions open"),
  closesAt: z.date().describe("When submissions close"),
  fee: z.number().nullable().describe("Submission fee in cents (null = free)"),
  maxSubmissions: z
    .number()
    .nullable()
    .describe("Max submissions allowed (null = unlimited)"),
  formDefinitionId: z
    .string()
    .uuid()
    .nullable()
    .describe("ID of the form definition linked to this period"),
  simSubProhibited: z
    .boolean()
    .describe("Whether simultaneous submissions are prohibited"),
  blindReviewMode: blindReviewModeSchema,
  createdAt: z.date().describe("When the period was created"),
  updatedAt: z.date().describe("When the period was last updated"),
});

export type SubmissionPeriod = z.infer<typeof submissionPeriodSchema>;

export const createSubmissionPeriodSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(255)
    .describe("Display name for the submission period"),
  description: z
    .string()
    .max(2000)
    .optional()
    .describe("Description of the period (max 2,000 chars)"),
  opensAt: z.coerce.date().describe("When submissions open (ISO-8601)"),
  closesAt: z.coerce.date().describe("When submissions close (ISO-8601)"),
  fee: z
    .number()
    .min(0)
    .optional()
    .describe("Submission fee in cents (omit for free)"),
  maxSubmissions: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Maximum number of submissions (omit for unlimited)"),
  formDefinitionId: z
    .string()
    .uuid()
    .optional()
    .describe("Form definition to link to this period"),
  simSubProhibited: z
    .boolean()
    .optional()
    .describe(
      "Whether simultaneous submissions are prohibited (default: false)",
    ),
  blindReviewMode: blindReviewModeSchema
    .optional()
    .describe(
      "Blind review mode: none, single_blind, or double_blind (default: none)",
    ),
});

export type CreateSubmissionPeriodInput = z.infer<
  typeof createSubmissionPeriodSchema
>;

export const updateSubmissionPeriodSchema = createSubmissionPeriodSchema
  .partial()
  .extend({
    formDefinitionId: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .describe("Form definition to link (null to unlink)"),
  });
export type UpdateSubmissionPeriodInput = z.infer<
  typeof updateSubmissionPeriodSchema
>;

export const periodStatusSchema = z.enum(["UPCOMING", "OPEN", "CLOSED"]);
export type PeriodStatus = z.infer<typeof periodStatusSchema>;

/**
 * Compute the status of a submission period from its date range.
 * UPCOMING = not yet open, OPEN = currently accepting, CLOSED = past deadline.
 */
export function computePeriodStatus(
  opensAt: Date,
  closesAt: Date,
): PeriodStatus {
  const now = new Date();
  if (now < opensAt) return "UPCOMING";
  if (now <= closesAt) return "OPEN";
  return "CLOSED";
}

export const listSubmissionPeriodsSchema = z.object({
  status: periodStatusSchema
    .optional()
    .describe("Filter by computed period status"),
  search: z
    .string()
    .trim()
    .max(200)
    .optional()
    .describe("Search period name (max 200 chars)"),
  page: z.number().int().min(1).default(1).describe("Page number (1-based)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Items per page (1-100, default 20)"),
});

export type ListSubmissionPeriodsInput = z.infer<
  typeof listSubmissionPeriodsSchema
>;

/**
 * Valid status transitions for submissions.
 * Key is the current status, value is array of allowed next statuses.
 *
 * Workflow:
 * - DRAFT -> SUBMITTED (by submitter) or WITHDRAWN (by submitter)
 * - SUBMITTED -> UNDER_REVIEW, REJECTED, WITHDRAWN
 * - UNDER_REVIEW -> ACCEPTED, REJECTED, HOLD, REVISE_AND_RESUBMIT, WITHDRAWN
 * - HOLD -> UNDER_REVIEW, ACCEPTED, REJECTED, REVISE_AND_RESUBMIT, WITHDRAWN
 * - REVISE_AND_RESUBMIT -> SUBMITTED (resubmit), WITHDRAWN
 * - ACCEPTED -> (terminal state, no transitions except admin override)
 * - REJECTED -> (terminal state, no transitions except admin override)
 * - WITHDRAWN -> (terminal state, no transitions)
 */
export const VALID_STATUS_TRANSITIONS: Record<
  SubmissionStatus,
  SubmissionStatus[]
> = {
  DRAFT: ["SUBMITTED", "WITHDRAWN"],
  SUBMITTED: ["UNDER_REVIEW", "REJECTED", "WITHDRAWN"],
  UNDER_REVIEW: [
    "ACCEPTED",
    "REJECTED",
    "HOLD",
    "REVISE_AND_RESUBMIT",
    "WITHDRAWN",
  ],
  HOLD: [
    "UNDER_REVIEW",
    "ACCEPTED",
    "REJECTED",
    "REVISE_AND_RESUBMIT",
    "WITHDRAWN",
  ],
  REVISE_AND_RESUBMIT: ["SUBMITTED", "WITHDRAWN"],
  ACCEPTED: [], // Terminal state
  REJECTED: [], // Terminal state
  WITHDRAWN: [], // Terminal state
};

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(
  from: SubmissionStatus,
  to: SubmissionStatus,
): boolean {
  return VALID_STATUS_TRANSITIONS[from].includes(to);
}

/**
 * Status transitions allowed by editors (excludes submitter-only transitions)
 */
export const EDITOR_ALLOWED_TRANSITIONS: Record<
  SubmissionStatus,
  SubmissionStatus[]
> = {
  DRAFT: [], // Editors cannot transition drafts
  SUBMITTED: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["ACCEPTED", "REJECTED", "HOLD", "REVISE_AND_RESUBMIT"],
  HOLD: ["UNDER_REVIEW", "ACCEPTED", "REJECTED", "REVISE_AND_RESUBMIT"],
  REVISE_AND_RESUBMIT: [], // Submitter handles exit (resubmit or withdraw)
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

/**
 * Check if an editor can make a specific status transition
 */
export function isEditorAllowedTransition(
  from: SubmissionStatus,
  to: SubmissionStatus,
): boolean {
  return EDITOR_ALLOWED_TRANSITIONS[from].includes(to);
}

// ---------------------------------------------------------------------------
// Reviewer assignment schemas
// ---------------------------------------------------------------------------

export const submissionReviewerSchema = z.object({
  id: z.string().uuid(),
  submissionId: z.string().uuid(),
  reviewerUserId: z.string().uuid(),
  reviewerEmail: z.string().nullable(),
  reviewerRole: z.enum(["ADMIN", "EDITOR", "READER"]),
  assignedBy: z.string().uuid().nullable(),
  assignedAt: z.coerce.date(),
  readAt: z.coerce.date().nullable(),
});
export type SubmissionReviewer = z.infer<typeof submissionReviewerSchema>;

export const assignReviewerInputSchema = z.object({
  submissionId: z.string().uuid(),
  reviewerUserIds: z.array(z.string().uuid()).min(1).max(20),
});
export type AssignReviewerInput = z.infer<typeof assignReviewerInputSchema>;

export const unassignReviewerInputSchema = z.object({
  submissionId: z.string().uuid(),
  reviewerUserId: z.string().uuid(),
});
export type UnassignReviewerInput = z.infer<typeof unassignReviewerInputSchema>;

export const markReviewerReadInputSchema = z.object({
  submissionId: z.string().uuid(),
});
export type MarkReviewerReadInput = z.infer<typeof markReviewerReadInputSchema>;

// ---------------------------------------------------------------------------
// Batch operation schemas
// ---------------------------------------------------------------------------

export const BATCH_MAX_SIZE = 50;

export const batchStatusChangeInputSchema = z.object({
  submissionIds: z.array(z.string().uuid()).min(1).max(BATCH_MAX_SIZE),
  status: submissionStatusSchema,
  comment: z.string().max(1000).optional(),
});
export type BatchStatusChangeInput = z.infer<
  typeof batchStatusChangeInputSchema
>;

export const batchAssignReviewersInputSchema = z.object({
  submissionIds: z.array(z.string().uuid()).min(1).max(BATCH_MAX_SIZE),
  reviewerUserIds: z.array(z.string().uuid()).min(1).max(20),
});
export type BatchAssignReviewersInput = z.infer<
  typeof batchAssignReviewersInputSchema
>;

export const batchResultItemSchema = z.object({
  submissionId: z.string().uuid(),
  error: z.string(),
});

export const batchStatusChangeResponseSchema = z.object({
  succeeded: z.array(
    z.object({
      submissionId: z.string().uuid(),
      previousStatus: submissionStatusSchema,
      status: submissionStatusSchema,
    }),
  ),
  failed: z.array(batchResultItemSchema),
});
export type BatchStatusChangeResponse = z.infer<
  typeof batchStatusChangeResponseSchema
>;

export const batchAssignReviewersResponseSchema = z.object({
  succeeded: z.array(
    z.object({
      submissionId: z.string().uuid(),
      assignedCount: z.number().int(),
    }),
  ),
  failed: z.array(batchResultItemSchema),
});
export type BatchAssignReviewersResponse = z.infer<
  typeof batchAssignReviewersResponseSchema
>;

// ---------------------------------------------------------------------------
// Export schemas
// ---------------------------------------------------------------------------

export const exportSubmissionsSchema = z.object({
  status: submissionStatusSchema
    .optional()
    .describe("Filter by submission status"),
  submissionPeriodId: z
    .string()
    .uuid()
    .optional()
    .describe("Filter by submission period"),
  search: z
    .string()
    .trim()
    .max(200)
    .optional()
    .describe("Full-text search query (max 200 chars)"),
  format: z
    .enum(["json", "csv"])
    .default("json")
    .describe("Export format (json or csv)"),
});

export type ExportSubmissionsInput = z.infer<typeof exportSubmissionsSchema>;

export const submissionExportItemSchema = submissionListItemSchema.extend({
  periodName: z
    .string()
    .nullable()
    .describe("Name of the submission period, if any"),
});

export type SubmissionExportItem = z.infer<typeof submissionExportItemSchema>;
