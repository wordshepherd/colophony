import { z } from "zod";
import { scanStatusSchema } from "./file";

export const submissionStatusSchema = z.enum([
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACCEPTED",
  "REJECTED",
  "HOLD",
  "WITHDRAWN",
]);

export type SubmissionStatus = z.infer<typeof submissionStatusSchema>;

// Re-export scanStatus from file.ts for backwards compatibility
export { scanStatusSchema };
export type { ScanStatus } from "./file";

export const submissionSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  submitterId: z.string().uuid(),
  submissionPeriodId: z.string().uuid().nullable(),
  title: z.string(),
  content: z.string().nullable(),
  coverLetter: z.string().nullable(),
  status: submissionStatusSchema,
  submittedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Submission = z.infer<typeof submissionSchema>;

export const createSubmissionSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().max(50000).optional(),
  coverLetter: z.string().max(10000).optional(),
  submissionPeriodId: z.string().uuid().optional(),
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;

export const updateSubmissionSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().max(50000).optional(),
  coverLetter: z.string().max(10000).optional(),
});

export type UpdateSubmissionInput = z.infer<typeof updateSubmissionSchema>;

// Re-export submissionFileSchema from file.ts for backwards compatibility
export { submissionFileSchema, type SubmissionFile } from "./file";

export const submissionHistorySchema = z.object({
  id: z.string().uuid(),
  submissionId: z.string().uuid(),
  fromStatus: submissionStatusSchema.nullable(),
  toStatus: submissionStatusSchema,
  changedBy: z.string().uuid().nullable(),
  comment: z.string().nullable(),
  changedAt: z.date(),
});

export type SubmissionHistory = z.infer<typeof submissionHistorySchema>;

export const updateSubmissionStatusSchema = z.object({
  status: submissionStatusSchema,
  comment: z.string().max(1000).optional(),
});

export type UpdateSubmissionStatusInput = z.infer<
  typeof updateSubmissionStatusSchema
>;

export const listSubmissionsSchema = z.object({
  status: submissionStatusSchema.optional(),
  submissionPeriodId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type ListSubmissionsInput = z.infer<typeof listSubmissionsSchema>;

export const submissionPeriodSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  opensAt: z.date(),
  closesAt: z.date(),
  fee: z.number().nullable(),
  maxSubmissions: z.number().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SubmissionPeriod = z.infer<typeof submissionPeriodSchema>;

export const createSubmissionPeriodSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  opensAt: z.date(),
  closesAt: z.date(),
  fee: z.number().min(0).optional(),
  maxSubmissions: z.number().int().min(1).optional(),
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
