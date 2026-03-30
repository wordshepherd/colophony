import { z } from "zod";

// ---------------------------------------------------------------------------
// Sim-Sub Group — user-scoped simultaneous submission groupings
// ---------------------------------------------------------------------------

export const simsubGroupStatusSchema = z
  .enum(["ACTIVE", "RESOLVED", "WITHDRAWN"])
  .describe("Status of the sim-sub group");

export type SimsubGroupStatus = z.infer<typeof simsubGroupStatusSchema>;

// --- Response schemas ---

export const simsubGroupSchema = z.object({
  id: z.string().uuid().describe("Unique identifier"),
  userId: z.string().uuid().describe("Owner user ID"),
  name: z.string().describe("Human-readable group name"),
  manuscriptId: z
    .string()
    .uuid()
    .nullable()
    .describe("Optional linked manuscript"),
  status: simsubGroupStatusSchema,
  notes: z.string().nullable().describe("Private notes"),
  createdAt: z.date().describe("When the group was created"),
  updatedAt: z.date().describe("When the group was last updated"),
});

export type SimsubGroup = z.infer<typeof simsubGroupSchema>;

export const simsubGroupSubmissionSchema = z.object({
  id: z.string().uuid().describe("Junction row ID"),
  simsubGroupId: z.string().uuid().describe("Parent group ID"),
  submissionId: z
    .string()
    .uuid()
    .nullable()
    .describe("Native submission ID (XOR with externalSubmissionId)"),
  externalSubmissionId: z
    .string()
    .uuid()
    .nullable()
    .describe("External submission ID (XOR with submissionId)"),
  addedAt: z.date().describe("When the submission was added to the group"),
});

export type SimsubGroupSubmission = z.infer<typeof simsubGroupSubmissionSchema>;

export const simsubGroupDetailSchema = simsubGroupSchema.extend({
  submissions: z
    .array(simsubGroupSubmissionSchema)
    .describe("Submissions in this group"),
});

export type SimsubGroupDetail = z.infer<typeof simsubGroupDetailSchema>;

// --- Create/Update schemas ---

export const createSimsubGroupSchema = z.object({
  name: z.string().trim().min(1).max(255).describe("Human-readable group name"),
  manuscriptId: z
    .string()
    .uuid()
    .optional()
    .describe("Optional link to source manuscript"),
  notes: z.string().max(5000).optional().describe("Private notes"),
});

export type CreateSimsubGroupInput = z.infer<typeof createSimsubGroupSchema>;

export const updateSimsubGroupSchema = z
  .object({
    id: z.string().uuid().describe("Group ID to update"),
    name: z.string().trim().min(1).max(255).optional().describe("New name"),
    status: simsubGroupStatusSchema.optional().describe("New status"),
    notes: z.string().max(5000).nullable().optional().describe("Updated notes"),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.status !== undefined ||
      data.notes !== undefined,
    { message: "At least one field to update is required" },
  );

export type UpdateSimsubGroupInput = z.infer<typeof updateSimsubGroupSchema>;

export const addSimsubGroupSubmissionSchema = z
  .object({
    groupId: z.string().uuid().describe("Target group ID"),
    submissionId: z.string().uuid().optional().describe("Native submission ID"),
    externalSubmissionId: z
      .string()
      .uuid()
      .optional()
      .describe("External submission ID"),
  })
  .refine(
    (data) =>
      (data.submissionId != null) !== (data.externalSubmissionId != null),
    { message: "Exactly one of submissionId or externalSubmissionId required" },
  );

export type AddSimsubGroupSubmissionInput = z.infer<
  typeof addSimsubGroupSubmissionSchema
>;

export const removeSimsubGroupSubmissionSchema = z
  .object({
    groupId: z.string().uuid().describe("Target group ID"),
    submissionId: z.string().uuid().optional().describe("Native submission ID"),
    externalSubmissionId: z
      .string()
      .uuid()
      .optional()
      .describe("External submission ID"),
  })
  .refine(
    (data) =>
      (data.submissionId != null) !== (data.externalSubmissionId != null),
    { message: "Exactly one of submissionId or externalSubmissionId required" },
  );

export type RemoveSimsubGroupSubmissionInput = z.infer<
  typeof removeSimsubGroupSubmissionSchema
>;

// --- List schema ---

export const listSimsubGroupsSchema = z.object({
  status: simsubGroupStatusSchema.optional().describe("Filter by group status"),
  manuscriptId: z
    .string()
    .uuid()
    .optional()
    .describe("Filter by linked manuscript"),
  page: z.number().int().min(1).default(1).describe("Page number (1-based)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Items per page (1-100, default 20)"),
});

export type ListSimsubGroupsInput = z.infer<typeof listSimsubGroupsSchema>;

// --- Enriched detail schemas (for UI display) ---

export const enrichedSimsubGroupSubmissionSchema = z.object({
  id: z.string().uuid().describe("Junction row ID"),
  simsubGroupId: z.string().uuid().describe("Parent group ID"),
  addedAt: z.date().describe("When added to the group"),
  type: z
    .enum(["colophony", "external"])
    .describe("Whether this is a Colophony or external submission"),
  // Colophony submission fields (null for external)
  submissionId: z.string().uuid().nullable(),
  submissionTitle: z.string().nullable(),
  submissionStatus: z.string().nullable(),
  magazineName: z.string().nullable(),
  submittedAt: z.date().nullable(),
  // External submission fields (null for colophony)
  externalSubmissionId: z.string().uuid().nullable(),
  journalName: z.string().nullable(),
  externalStatus: z.string().nullable(),
  sentAt: z.date().nullable(),
});

export type EnrichedSimsubGroupSubmission = z.infer<
  typeof enrichedSimsubGroupSubmissionSchema
>;

export const enrichedSimsubGroupDetailSchema = simsubGroupSchema.extend({
  submissions: z.array(enrichedSimsubGroupSubmissionSchema),
  manuscriptTitle: z.string().nullable(),
});

export type EnrichedSimsubGroupDetail = z.infer<
  typeof enrichedSimsubGroupDetailSchema
>;

// --- Picker input schema ---

export const availableSimsubSubmissionsSchema = z.object({
  groupId: z.string().uuid().describe("Group to check membership against"),
});

export type AvailableSimsubSubmissionsInput = z.infer<
  typeof availableSimsubSubmissionsSchema
>;
