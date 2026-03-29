import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const rightsTypeSchema = z
  .enum([
    "first_north_american_serial",
    "electronic",
    "anthology",
    "audio",
    "translation",
    "custom",
  ])
  .describe("Type of rights granted");

export type RightsType = z.infer<typeof rightsTypeSchema>;

export const rightsAgreementStatusSchema = z
  .enum(["DRAFT", "SENT", "SIGNED", "ACTIVE", "REVERTED"])
  .describe("Current status of the rights agreement");

export type RightsAgreementStatus = z.infer<typeof rightsAgreementStatusSchema>;

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

/** Allowed status transitions for rights agreements. */
export const VALID_RIGHTS_STATUS_TRANSITIONS: Record<
  RightsAgreementStatus,
  RightsAgreementStatus[]
> = {
  DRAFT: ["SENT", "SIGNED", "ACTIVE"],
  SENT: ["SIGNED", "ACTIVE"],
  SIGNED: ["ACTIVE"],
  ACTIVE: ["REVERTED"],
  REVERTED: [],
};

// ---------------------------------------------------------------------------
// Response
// ---------------------------------------------------------------------------

export const rightsAgreementSchema = z.object({
  id: z.string().uuid().describe("Rights agreement ID"),
  organizationId: z.string().uuid().describe("Organization ID"),
  contributorId: z.string().uuid().describe("Contributor ID"),
  pipelineItemId: z.string().uuid().nullable().describe("Pipeline item ID"),
  rightsType: rightsTypeSchema,
  customDescription: z
    .string()
    .nullable()
    .describe("Description when type is custom"),
  status: rightsAgreementStatusSchema,
  grantedAt: z.date().nullable().describe("When rights were granted"),
  expiresAt: z.date().nullable().describe("When rights revert"),
  revertedAt: z
    .date()
    .nullable()
    .describe("When rights were actually reverted"),
  notes: z.string().nullable().describe("Internal notes"),
  createdAt: z.date().describe("Record creation timestamp"),
  updatedAt: z.date().describe("Record update timestamp"),
});

export type RightsAgreement = z.infer<typeof rightsAgreementSchema>;

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export const createRightsAgreementSchema = z.object({
  contributorId: z.string().uuid().describe("Contributor ID"),
  pipelineItemId: z.string().uuid().optional().describe("Pipeline item ID"),
  rightsType: rightsTypeSchema,
  customDescription: z
    .string()
    .max(5000)
    .optional()
    .describe("Description when type is custom"),
  expiresAt: z.coerce.date().optional().describe("Reversion date"),
  notes: z.string().max(10000).optional().describe("Internal notes"),
});

export type CreateRightsAgreementInput = z.infer<
  typeof createRightsAgreementSchema
>;

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export const updateRightsAgreementSchema = z
  .object({
    id: z.string().uuid().describe("Rights agreement ID"),
    rightsType: rightsTypeSchema.optional(),
    customDescription: z.string().max(5000).nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    notes: z.string().max(10000).nullable().optional(),
  })
  .refine(
    (data) =>
      data.rightsType !== undefined ||
      data.customDescription !== undefined ||
      data.expiresAt !== undefined ||
      data.notes !== undefined,
    { message: "At least one field to update is required" },
  );

export type UpdateRightsAgreementInput = z.infer<
  typeof updateRightsAgreementSchema
>;

// ---------------------------------------------------------------------------
// Transition
// ---------------------------------------------------------------------------

export const transitionRightsAgreementStatusSchema = z.object({
  id: z.string().uuid().describe("Rights agreement ID"),
  status: rightsAgreementStatusSchema.describe("Target status"),
});

export type TransitionRightsAgreementStatusInput = z.infer<
  typeof transitionRightsAgreementStatusSchema
>;

// ---------------------------------------------------------------------------
// List (with joined names)
// ---------------------------------------------------------------------------

export const listRightsAgreementsSchema = z.object({
  contributorId: z.string().uuid().optional().describe("Filter by contributor"),
  pipelineItemId: z
    .string()
    .uuid()
    .optional()
    .describe("Filter by pipeline item"),
  status: rightsAgreementStatusSchema.optional().describe("Filter by status"),
  rightsType: rightsTypeSchema.optional().describe("Filter by rights type"),
  page: z.number().int().min(1).default(1).describe("Page number (1-based)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Items per page"),
});

export type ListRightsAgreementsInput = z.infer<
  typeof listRightsAgreementsSchema
>;

/** Extended response schema for list queries with joined display names. */
export const rightsAgreementListItemSchema = rightsAgreementSchema.extend({
  contributorName: z.string().describe("Contributor display name"),
  pipelineItemTitle: z
    .string()
    .nullable()
    .describe("Pipeline item title, if linked"),
});
