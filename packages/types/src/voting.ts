import { z } from "zod";

// ---------------------------------------------------------------------------
// Vote decision enum
// ---------------------------------------------------------------------------

export const voteDecisionSchema = z.enum(["ACCEPT", "REJECT", "MAYBE"]);
export type VoteDecision = z.infer<typeof voteDecisionSchema>;

// ---------------------------------------------------------------------------
// Voting config (stored in organizations.settings JSONB)
// ---------------------------------------------------------------------------

export const votingConfigSchema = z.object({
  votingEnabled: z.boolean().default(false),
  scoringEnabled: z.boolean().default(false),
  scoreMin: z.number().default(1),
  scoreMax: z.number().default(10),
});

export type VotingConfig = z.infer<typeof votingConfigSchema>;

// ---------------------------------------------------------------------------
// Submission vote response
// ---------------------------------------------------------------------------

export const submissionVoteSchema = z.object({
  id: z.string().uuid(),
  submissionId: z.string().uuid(),
  voterUserId: z.string().uuid(),
  voterEmail: z.string().nullable(),
  decision: voteDecisionSchema,
  score: z.number().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type SubmissionVote = z.infer<typeof submissionVoteSchema>;

// ---------------------------------------------------------------------------
// Vote summary (aggregated tallies)
// ---------------------------------------------------------------------------

export const voteSummarySchema = z.object({
  acceptCount: z.number(),
  rejectCount: z.number(),
  maybeCount: z.number(),
  totalVotes: z.number(),
  averageScore: z.number().nullable(),
});

export type VoteSummary = z.infer<typeof voteSummarySchema>;

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

export const castVoteInputSchema = z.object({
  submissionId: z.string().uuid(),
  decision: voteDecisionSchema,
  score: z.number().min(0).max(1000).optional(),
});

export type CastVoteInput = z.infer<typeof castVoteInputSchema>;

export const listVotesInputSchema = z.object({
  submissionId: z.string().uuid(),
});

export const deleteVoteInputSchema = z.object({
  submissionId: z.string().uuid(),
});
