import { z } from "zod";
import { scanStatusSchema, submissionFileSchema } from "./file";

export const submissionStatusSchema = z
  .enum([
    "DRAFT",
    "SUBMITTED",
    "UNDER_REVIEW",
    "ACCEPTED",
    "REJECTED",
    "HOLD",
    "WITHDRAWN",
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
  status: submissionStatusSchema,
  submittedAt: z
    .date()
    .nullable()
    .describe("When the submission was formally submitted"),
  createdAt: z.date().describe("When the submission was created"),
  updatedAt: z.date().describe("When the submission was last updated"),
});

export type Submission = z.infer<typeof submissionSchema>;

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

// Re-export submissionFileSchema from file.ts for backwards compatibility
export { submissionFileSchema, type SubmissionFile } from "./file";

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
    .array(submissionFileSchema)
    .describe("Files attached to this submission"),
  submitterEmail: z
    .string()
    .email()
    .nullable()
    .describe("Email address of the submitter"),
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
  opensAt: z.date().describe("When submissions open (ISO-8601)"),
  closesAt: z.date().describe("When submissions close (ISO-8601)"),
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
});

export type CreateSubmissionPeriodInput = z.infer<
  typeof createSubmissionPeriodSchema
>;

/**
 * Valid status transitions for submissions.
 * Key is the current status, value is array of allowed next statuses.
 *
 * Workflow:
 * - DRAFT -> SUBMITTED (by submitter) or WITHDRAWN (by submitter)
 * - SUBMITTED -> UNDER_REVIEW, REJECTED, WITHDRAWN
 * - UNDER_REVIEW -> ACCEPTED, REJECTED, HOLD, WITHDRAWN
 * - HOLD -> UNDER_REVIEW, ACCEPTED, REJECTED, WITHDRAWN
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
  UNDER_REVIEW: ["ACCEPTED", "REJECTED", "HOLD", "WITHDRAWN"],
  HOLD: ["UNDER_REVIEW", "ACCEPTED", "REJECTED", "WITHDRAWN"],
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
  UNDER_REVIEW: ["ACCEPTED", "REJECTED", "HOLD"],
  HOLD: ["UNDER_REVIEW", "ACCEPTED", "REJECTED"],
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
