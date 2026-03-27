import { z } from "zod";
import type { SubmissionStatus } from "./submission";
import {
  submissionSchema,
  submissionDetailSchema,
  listSubmissionsSchema,
} from "./submission";

// ---------------------------------------------------------------------------
// WriterStatus — the writer-visible state machine (7 values)
// HOLD collapses into IN_REVIEW; REJECTED becomes DECISION_SENT
// ---------------------------------------------------------------------------

export const writerStatusSchema = z
  .enum([
    "DRAFT",
    "RECEIVED",
    "IN_REVIEW",
    "REVISION_REQUESTED",
    "ACCEPTED",
    "DECISION_SENT",
    "WITHDRAWN",
  ])
  .describe("Writer-facing submission status");

export type WriterStatus = z.infer<typeof writerStatusSchema>;

// ---------------------------------------------------------------------------
// Internal → Writer mapping
// ---------------------------------------------------------------------------

export const SUBMISSION_TO_WRITER_STATUS: Record<
  SubmissionStatus,
  WriterStatus
> = {
  DRAFT: "DRAFT",
  SUBMITTED: "RECEIVED",
  UNDER_REVIEW: "IN_REVIEW",
  HOLD: "IN_REVIEW",
  REVISE_AND_RESUBMIT: "REVISION_REQUESTED",
  ACCEPTED: "ACCEPTED",
  REJECTED: "DECISION_SENT",
  WITHDRAWN: "WITHDRAWN",
};

/**
 * Reverse mapping: WriterStatus → internal SubmissionStatus[].
 * Used to expand writer-facing filters into internal status queries.
 */
export const WRITER_TO_INTERNAL_STATUSES: Record<
  WriterStatus,
  SubmissionStatus[]
> = {
  DRAFT: ["DRAFT"],
  RECEIVED: ["SUBMITTED"],
  IN_REVIEW: ["UNDER_REVIEW", "HOLD"],
  REVISION_REQUESTED: ["REVISE_AND_RESUBMIT"],
  ACCEPTED: ["ACCEPTED"],
  DECISION_SENT: ["REJECTED"],
  WITHDRAWN: ["WITHDRAWN"],
};

// ---------------------------------------------------------------------------
// Default display labels
// ---------------------------------------------------------------------------

export const DEFAULT_WRITER_STATUS_LABELS: Record<WriterStatus, string> = {
  DRAFT: "Draft",
  RECEIVED: "Received",
  IN_REVIEW: "In Review",
  REVISION_REQUESTED: "Revision Requested",
  ACCEPTED: "Accepted",
  DECISION_SENT: "Decision Sent",
  WITHDRAWN: "Withdrawn",
};

/**
 * Explanatory notes for the admin settings UI.
 * Each note tells the admin which internal states a writer-facing status covers.
 */
export const WRITER_STATUS_DESCRIPTIONS: Record<WriterStatus, string> = {
  DRAFT: "Writer's unsubmitted work",
  RECEIVED: "Submission has been sent to the magazine",
  IN_REVIEW: "Covers all active review stages (Under Review and Hold)",
  REVISION_REQUESTED: "Editor has asked the writer to revise and resubmit",
  ACCEPTED: "Submission has been accepted for publication",
  DECISION_SENT:
    "Covers rejected submissions (softened language for the writer)",
  WITHDRAWN: "Writer withdrew the submission",
};

// ---------------------------------------------------------------------------
// Pure projection functions
// ---------------------------------------------------------------------------

/** Map an internal SubmissionStatus to a WriterStatus enum value. */
export function projectWriterStatus(
  internalStatus: SubmissionStatus,
): WriterStatus {
  return SUBMISSION_TO_WRITER_STATUS[internalStatus];
}

/**
 * Resolve the display label for a WriterStatus.
 * Checks org overrides first, then falls back to defaults.
 */
export function resolveWriterStatusLabel(
  writerStatus: WriterStatus,
  overrides?: Partial<Record<WriterStatus, string>>,
): string {
  return (
    overrides?.[writerStatus] ?? DEFAULT_WRITER_STATUS_LABELS[writerStatus]
  );
}

// ---------------------------------------------------------------------------
// Zod schemas for API responses
// ---------------------------------------------------------------------------

export const writerStatusProjectionSchema = z.object({
  writerStatus: writerStatusSchema,
  writerStatusLabel: z
    .string()
    .describe("Org-configurable display label for the writer status"),
});

/** Writer-facing submission (list item) — status replaced with projection. */
export const writerSubmissionSchema = submissionSchema
  .omit({ status: true })
  .extend({
    writerStatus: writerStatusSchema,
    writerStatusLabel: z
      .string()
      .describe("Org-configurable display label for the writer status"),
  });

export type WriterSubmission = z.infer<typeof writerSubmissionSchema>;

/** Writer-facing submission detail — status replaced with projection. */
export const writerSubmissionDetailSchema = submissionDetailSchema
  .omit({ status: true })
  .extend({
    writerStatus: writerStatusSchema,
    writerStatusLabel: z
      .string()
      .describe("Org-configurable display label for the writer status"),
  });

export type WriterSubmissionDetail = z.infer<
  typeof writerSubmissionDetailSchema
>;

// ---------------------------------------------------------------------------
// Org settings schema for writer status label overrides
// ---------------------------------------------------------------------------

export const writerStatusLabelsSchema = z
  .record(writerStatusSchema, z.string().min(1).max(100))
  .optional()
  .describe("Per-status display label overrides for writers");

// ---------------------------------------------------------------------------
// Writer-specific list input (extends shared listSubmissionsSchema)
// ---------------------------------------------------------------------------

export const listWriterSubmissionsSchema = listSubmissionsSchema.extend({
  writerStatus: writerStatusSchema
    .optional()
    .describe("Filter by writer-projected status"),
});

export type ListWriterSubmissionsInput = z.infer<
  typeof listWriterSubmissionsSchema
>;
