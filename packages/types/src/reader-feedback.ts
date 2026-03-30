import { z } from "zod";

// ---------------------------------------------------------------------------
// Reader Feedback — org-scoped feedback from readers on submissions
// ---------------------------------------------------------------------------

// --- Org settings for reader feedback feature ---

export const readerFeedbackSettingsSchema = z.object({
  enabled: z
    .boolean()
    .default(false)
    .describe("Whether reader feedback is enabled for this org"),
  availableTags: z
    .array(z.string().max(50))
    .max(20)
    .default([])
    .describe("Org-configured feedback tags readers can select from"),
});

export type ReaderFeedbackSettings = z.infer<
  typeof readerFeedbackSettingsSchema
>;

// --- Response schemas ---

export const readerFeedbackSchema = z.object({
  id: z.string().uuid().describe("Unique identifier"),
  organizationId: z.string().uuid().describe("Organization ID"),
  submissionId: z.string().uuid().describe("Submission being reviewed"),
  reviewerUserId: z
    .string()
    .uuid()
    .nullable()
    .describe("Who left the feedback"),
  tags: z.array(z.string()).describe("Selected feedback tags"),
  comment: z
    .string()
    .nullable()
    .describe("Short feedback comment (max 280 chars)"),
  isForwardable: z
    .boolean()
    .describe("Whether this can be forwarded to the writer"),
  forwardedAt: z
    .date()
    .nullable()
    .describe("When the feedback was forwarded (null = not forwarded)"),
  forwardedBy: z
    .string()
    .uuid()
    .nullable()
    .describe("Editor who forwarded the feedback"),
  createdAt: z.date().describe("When the feedback was created"),
  updatedAt: z.date().describe("When the feedback was last updated"),
});

export type ReaderFeedback = z.infer<typeof readerFeedbackSchema>;

/** Writer-facing response: reviewer identity stripped for anonymity. */
export const readerFeedbackWriterSchema = z.object({
  id: z.string().uuid().describe("Feedback ID"),
  submissionId: z.string().uuid().describe("Submission ID"),
  tags: z.array(z.string()).describe("Selected feedback tags"),
  comment: z.string().nullable().describe("Short feedback comment"),
  forwardedAt: z.date().nullable().describe("When the feedback was forwarded"),
});

export type ReaderFeedbackWriter = z.infer<typeof readerFeedbackWriterSchema>;

// --- Create schema ---

export const createReaderFeedbackSchema = z.object({
  submissionId: z.string().uuid().describe("Submission to leave feedback on"),
  tags: z
    .array(z.string().max(50))
    .max(5)
    .default([])
    .describe("Selected feedback tags"),
  comment: z
    .string()
    .max(280)
    .optional()
    .describe("Short feedback comment (max 280 chars)"),
  isForwardable: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether this can be forwarded to the writer"),
});

export type CreateReaderFeedbackInput = z.infer<
  typeof createReaderFeedbackSchema
>;

// --- Forward schema ---

export const forwardReaderFeedbackSchema = z.object({
  feedbackId: z.string().uuid().describe("ID of the feedback to forward"),
});

export type ForwardReaderFeedbackInput = z.infer<
  typeof forwardReaderFeedbackSchema
>;

// --- List schema ---

export const listReaderFeedbackSchema = z.object({
  submissionId: z.string().uuid().describe("Filter by submission ID"),
  page: z.number().int().min(1).default(1).describe("Page number (1-based)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Items per page (1-100, default 20)"),
});

export type ListReaderFeedbackInput = z.infer<typeof listReaderFeedbackSchema>;
