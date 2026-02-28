import { z } from "zod";

// ---------------------------------------------------------------------------
// Submission discussion comment schema
// ---------------------------------------------------------------------------

export const submissionDiscussionSchema = z.object({
  id: z.string().uuid(),
  submissionId: z.string().uuid(),
  authorId: z.string().uuid().nullable(),
  authorEmail: z.string().nullable(),
  parentId: z.string().uuid().nullable(),
  content: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().nullable(),
});

export type SubmissionDiscussion = z.infer<typeof submissionDiscussionSchema>;

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

export const createDiscussionCommentSchema = z.object({
  submissionId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  content: z.string().trim().min(1).max(50000),
});

export type CreateDiscussionCommentInput = z.infer<
  typeof createDiscussionCommentSchema
>;

export const listDiscussionCommentsSchema = z.object({
  submissionId: z.string().uuid(),
});
