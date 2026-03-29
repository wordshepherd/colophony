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

export const updateRightsAgreementSchema = z.object({
  id: z.string().uuid().describe("Rights agreement ID"),
  rightsType: rightsTypeSchema.optional(),
  customDescription: z.string().max(5000).nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  notes: z.string().max(10000).nullable().optional(),
});

export type UpdateRightsAgreementInput = z.infer<
  typeof updateRightsAgreementSchema
>;
