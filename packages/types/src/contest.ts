import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const contestJudgeRoleSchema = z
  .enum(["head_judge", "judge", "screener"])
  .describe("Role of a contest judge");

export type ContestJudgeRole = z.infer<typeof contestJudgeRoleSchema>;

// ---------------------------------------------------------------------------
// Contest Group
// ---------------------------------------------------------------------------

export const contestGroupSchema = z.object({
  id: z.string().uuid().describe("Contest group ID"),
  organizationId: z.string().uuid().describe("Organization ID"),
  name: z.string().describe("Contest name"),
  description: z.string().nullable().describe("Contest description"),
  totalRoundsPlanned: z
    .number()
    .int()
    .nullable()
    .describe("Total rounds planned for this contest"),
  createdAt: z.date().describe("Created timestamp"),
  updatedAt: z.date().describe("Updated timestamp"),
});

export type ContestGroup = z.infer<typeof contestGroupSchema>;

export const createContestGroupSchema = z.object({
  name: z.string().trim().min(1).max(255).describe("Contest name"),
  description: z.string().max(2000).optional().describe("Contest description"),
  totalRoundsPlanned: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe("Total rounds planned"),
});

export type CreateContestGroupInput = z.infer<typeof createContestGroupSchema>;

export const updateContestGroupSchema = createContestGroupSchema.partial();

export type UpdateContestGroupInput = z.infer<typeof updateContestGroupSchema>;

export const listContestGroupsSchema = z.object({
  page: z.number().int().min(1).default(1).describe("Page number"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Items per page"),
});

export type ListContestGroupsInput = z.infer<typeof listContestGroupsSchema>;

// ---------------------------------------------------------------------------
// Contest Judge
// ---------------------------------------------------------------------------

export const contestJudgeSchema = z.object({
  id: z.string().uuid().describe("Judge assignment ID"),
  submissionPeriodId: z.string().uuid().describe("Contest period ID"),
  userId: z.string().uuid().describe("Judge user ID"),
  userEmail: z
    .string()
    .nullable()
    .describe("Judge email (null when blinded in anonymous mode)"),
  role: contestJudgeRoleSchema,
  assignedBy: z.string().uuid().nullable().describe("Assigning user ID"),
  assignedAt: z.coerce.date().describe("When the judge was assigned"),
  notes: z.string().nullable().describe("Notes about this judge assignment"),
});

export type ContestJudge = z.infer<typeof contestJudgeSchema>;

export const assignContestJudgeSchema = z.object({
  submissionPeriodId: z.string().uuid().describe("Contest period to assign to"),
  userId: z.string().uuid().describe("User to assign as judge"),
  role: contestJudgeRoleSchema
    .optional()
    .describe("Judge role (default: judge)"),
  notes: z
    .string()
    .max(1000)
    .optional()
    .describe("Notes about this assignment"),
});

export type AssignContestJudgeInput = z.infer<typeof assignContestJudgeSchema>;

export const updateContestJudgeSchema = z.object({
  id: z.string().uuid().describe("Judge assignment ID"),
  role: contestJudgeRoleSchema.optional().describe("Updated role"),
  notes: z.string().max(1000).nullable().optional().describe("Updated notes"),
});

export type UpdateContestJudgeInput = z.infer<typeof updateContestJudgeSchema>;

export const listContestJudgesSchema = z.object({
  submissionPeriodId: z.string().uuid().describe("Contest period ID"),
});

export type ListContestJudgesInput = z.infer<typeof listContestJudgesSchema>;

// ---------------------------------------------------------------------------
// Contest Result
// ---------------------------------------------------------------------------

export const contestResultSchema = z.object({
  id: z.string().uuid().describe("Result ID"),
  submissionPeriodId: z.string().uuid().describe("Contest period ID"),
  submissionId: z.string().uuid().describe("Submission ID"),
  submissionTitle: z.string().nullable().describe("Submission title (joined)"),
  submitterEmail: z
    .string()
    .nullable()
    .describe("Submitter email (null when blinded)"),
  placement: z
    .number()
    .int()
    .nullable()
    .describe("Placement (1st, 2nd, 3rd, etc.)"),
  category: z.string().nullable().describe("Category (e.g. fiction, poetry)"),
  prizeAmount: z.number().int().nullable().describe("Prize amount in cents"),
  prizeCurrency: z.string().max(3).describe("ISO 4217 currency code"),
  disbursementId: z
    .string()
    .uuid()
    .nullable()
    .describe("Linked payment transaction ID"),
  disbursementStatus: z
    .string()
    .nullable()
    .describe("Disbursement payment status (joined)"),
  announcedAt: z
    .date()
    .nullable()
    .describe("When the result was publicly announced"),
  averageScore: z
    .number()
    .nullable()
    .describe("Average judge score (aggregated)"),
  notes: z.string().nullable().describe("Result notes"),
  createdAt: z.date().describe("Created timestamp"),
  updatedAt: z.date().describe("Updated timestamp"),
});

export type ContestResult = z.infer<typeof contestResultSchema>;

export const createContestResultSchema = z.object({
  submissionPeriodId: z.string().uuid().describe("Contest period"),
  submissionId: z.string().uuid().describe("Submission to place"),
  placement: z.number().int().min(1).optional().describe("Placement number"),
  category: z.string().max(255).optional().describe("Category for this result"),
  prizeAmount: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Prize amount in cents"),
  prizeCurrency: z
    .string()
    .length(3, "Currency code must be 3 characters")
    .default("usd")
    .describe("ISO 4217 currency code"),
  notes: z.string().max(2000).optional().describe("Notes about this result"),
});

export type CreateContestResultInput = z.infer<
  typeof createContestResultSchema
>;

export const updateContestResultSchema = z.object({
  id: z.string().uuid().describe("Result ID"),
  placement: z.number().int().min(1).nullable().optional(),
  category: z.string().max(255).nullable().optional(),
  prizeAmount: z.number().int().min(0).nullable().optional(),
  prizeCurrency: z.string().length(3).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export type UpdateContestResultInput = z.infer<
  typeof updateContestResultSchema
>;

export const listContestResultsSchema = z.object({
  submissionPeriodId: z.string().uuid().describe("Contest period ID"),
  category: z.string().optional().describe("Filter by category"),
  page: z.number().int().min(1).default(1).describe("Page number"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Items per page"),
});

export type ListContestResultsInput = z.infer<typeof listContestResultsSchema>;

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

export const contestLeaderboardEntrySchema = z.object({
  submissionId: z.string().uuid(),
  submissionTitle: z.string().nullable(),
  submitterEmail: z
    .string()
    .nullable()
    .describe("Submitter email (null when blinded)"),
  averageScore: z.number().nullable(),
  totalVotes: z.number().int(),
  acceptCount: z.number().int(),
  rejectCount: z.number().int(),
  maybeCount: z.number().int(),
  placement: z.number().int().nullable(),
});

export type ContestLeaderboardEntry = z.infer<
  typeof contestLeaderboardEntrySchema
>;

export const contestLeaderboardSchema = z.object({
  submissionPeriodId: z.string().uuid().describe("Contest period ID"),
  category: z.string().optional().describe("Filter by genre/category"),
});

export type ContestLeaderboardInput = z.infer<typeof contestLeaderboardSchema>;

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export const announceWinnersSchema = z.object({
  submissionPeriodId: z.string().uuid().describe("Contest period ID"),
});

export type AnnounceWinnersInput = z.infer<typeof announceWinnersSchema>;

export const disbursePrizeSchema = z.object({
  contestResultId: z.string().uuid().describe("Contest result to disburse"),
});

export type DisbursePrizeInput = z.infer<typeof disbursePrizeSchema>;
