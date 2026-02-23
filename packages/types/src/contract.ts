import { z } from "zod";

// ---------------------------------------------------------------------------
// Contract status
// ---------------------------------------------------------------------------

export const contractStatusSchema = z
  .enum([
    "DRAFT",
    "SENT",
    "VIEWED",
    "SIGNED",
    "COUNTERSIGNED",
    "COMPLETED",
    "VOIDED",
  ])
  .describe("Current status of the contract");

export type ContractStatus = z.infer<typeof contractStatusSchema>;

// ---------------------------------------------------------------------------
// Merge field definition
// ---------------------------------------------------------------------------

export const mergeFieldDefinitionSchema = z.object({
  key: z.string().describe("Merge field key (e.g. author_name)"),
  label: z.string().describe("Human-readable label"),
  source: z
    .enum(["auto", "manual"])
    .describe("Whether the field is auto-populated or manually entered"),
  defaultValue: z.string().optional().describe("Default value if not provided"),
});

export type MergeFieldDefinition = z.infer<typeof mergeFieldDefinitionSchema>;

// ---------------------------------------------------------------------------
// Contract template schemas
// ---------------------------------------------------------------------------

export const contractTemplateSchema = z.object({
  id: z.string().uuid().describe("Contract template ID"),
  organizationId: z.string().uuid().describe("Organization ID"),
  name: z.string().describe("Template name"),
  description: z.string().nullable().describe("Template description"),
  body: z.string().describe("Template body with {{merge_field}} placeholders"),
  mergeFields: z
    .array(mergeFieldDefinitionSchema)
    .nullable()
    .describe("Merge field definitions"),
  isDefault: z.boolean().describe("Whether this is the default template"),
  createdAt: z.date().describe("When the template was created"),
  updatedAt: z.date().describe("When the template was last updated"),
});

export type ContractTemplate = z.infer<typeof contractTemplateSchema>;

export const createContractTemplateSchema = z.object({
  name: z.string().trim().min(1).max(255).describe("Template name"),
  description: z.string().max(2000).optional().describe("Template description"),
  body: z
    .string()
    .min(1)
    .describe("Template body with {{merge_field}} placeholders"),
  mergeFields: z
    .array(mergeFieldDefinitionSchema)
    .optional()
    .describe("Merge field definitions"),
  isDefault: z.boolean().optional().describe("Set as default template"),
});

export type CreateContractTemplateInput = z.infer<
  typeof createContractTemplateSchema
>;

export const updateContractTemplateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional().describe("New name"),
  description: z
    .string()
    .max(2000)
    .nullable()
    .optional()
    .describe("New description (null to clear)"),
  body: z.string().min(1).optional().describe("New template body"),
  mergeFields: z
    .array(mergeFieldDefinitionSchema)
    .nullable()
    .optional()
    .describe("New merge field definitions"),
  isDefault: z.boolean().optional().describe("Set as default template"),
});

export type UpdateContractTemplateInput = z.infer<
  typeof updateContractTemplateSchema
>;

export const listContractTemplatesSchema = z.object({
  search: z.string().trim().max(200).optional().describe("Search by name"),
  page: z.number().int().min(1).default(1).describe("Page number (1-based)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Items per page (1-100, default 20)"),
});

export type ListContractTemplatesInput = z.infer<
  typeof listContractTemplatesSchema
>;

// ---------------------------------------------------------------------------
// Contract schemas
// ---------------------------------------------------------------------------

export const contractSchema = z.object({
  id: z.string().uuid().describe("Contract ID"),
  organizationId: z.string().uuid().describe("Organization ID"),
  pipelineItemId: z.string().uuid().describe("Pipeline item ID"),
  contractTemplateId: z
    .string()
    .uuid()
    .nullable()
    .describe("Source template ID"),
  status: contractStatusSchema,
  renderedBody: z.string().describe("Contract body with merge fields resolved"),
  mergeData: z
    .record(z.string(), z.string())
    .nullable()
    .describe("Merge field values used"),
  documensoDocumentId: z.string().nullable().describe("Documenso document ID"),
  signedAt: z.date().nullable().describe("When the contract was signed"),
  countersignedAt: z
    .date()
    .nullable()
    .describe("When the contract was countersigned"),
  completedAt: z.date().nullable().describe("When the contract was completed"),
  createdAt: z.date().describe("When the contract was created"),
  updatedAt: z.date().describe("When the contract was last updated"),
});

export type Contract = z.infer<typeof contractSchema>;

export const generateContractSchema = z.object({
  pipelineItemId: z.string().uuid().describe("Pipeline item ID"),
  contractTemplateId: z.string().uuid().describe("Contract template to use"),
  mergeData: z
    .record(z.string(), z.string())
    .optional()
    .describe("Override merge field values"),
});

export type GenerateContractInput = z.infer<typeof generateContractSchema>;

export const listContractsSchema = z.object({
  status: contractStatusSchema.optional().describe("Filter by status"),
  pipelineItemId: z
    .string()
    .uuid()
    .optional()
    .describe("Filter by pipeline item"),
  page: z.number().int().min(1).default(1).describe("Page number (1-based)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Items per page (1-100, default 20)"),
});

export type ListContractsInput = z.infer<typeof listContractsSchema>;
