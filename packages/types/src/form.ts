import { z } from "zod";
import {
  conditionalRulesSchema,
  ruleConditionSchema,
} from "./conditional-rules";

// Re-export branching schemas from conditional-rules (canonical location)
export {
  branchDefinitionSchema,
  branchingConfigSchema,
  type BranchDefinition,
  type BranchingConfig,
} from "./conditional-rules";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const formStatusSchema = z
  .enum(["DRAFT", "PUBLISHED", "ARCHIVED"])
  .describe("Current status of the form definition");

export type FormStatus = z.infer<typeof formStatusSchema>;

export const formFieldTypeSchema = z
  .enum([
    "text",
    "textarea",
    "rich_text",
    "number",
    "email",
    "url",
    "date",
    "select",
    "multi_select",
    "radio",
    "checkbox",
    "checkbox_group",
    "file_upload",
    "section_header",
    "info_text",
  ])
  .describe("Type of form field");

export type FormFieldType = z.infer<typeof formFieldTypeSchema>;

/** Presentational field types that are not collected as response data. */
export const PRESENTATIONAL_FIELD_TYPES: FormFieldType[] = [
  "section_header",
  "info_text",
];

/** Field types that support branching (select-like fields with discrete options). */
export const BRANCHING_FIELD_TYPES: FormFieldType[] = [
  "select",
  "radio",
  "checkbox_group",
];

// ---------------------------------------------------------------------------
// Per-type config schemas (for validation in the service layer)
// ---------------------------------------------------------------------------

export const textFieldConfigSchema = z.object({
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(1).optional(),
});

export const numberFieldConfigSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
});

export const selectOptionSchema = z.object({
  label: z.string().min(1).max(500),
  value: z.string().min(1).max(255),
});

export const selectFieldConfigSchema = z.object({
  options: z.array(selectOptionSchema).min(1),
});

export const fileUploadFieldConfigSchema = z.object({
  allowedMimeTypes: z.array(z.string()).optional(),
  maxFileSize: z.number().int().min(1).optional(),
  maxFiles: z.number().int().min(1).optional(),
});

export const richTextFieldConfigSchema = z.object({
  maxLength: z.number().int().min(1).optional(),
});

/** Loose config schema for DB storage — validated per-type in service layer. */
export const fieldConfigSchema = z
  .record(z.string(), z.unknown())
  .default({})
  .describe("Type-specific configuration for the field");

// ---------------------------------------------------------------------------
// Page branching schemas
// ---------------------------------------------------------------------------

export const pageBranchingRuleSchema = z.object({
  targetPageId: z.string().uuid(),
  condition: ruleConditionSchema,
});

export type PageBranchingRule = z.infer<typeof pageBranchingRuleSchema>;

export const formPageSchema = z.object({
  id: z.string().uuid(),
  formDefinitionId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
  branchingRules: z.array(pageBranchingRuleSchema).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type FormPage = z.infer<typeof formPageSchema>;

export const createFormPageSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().max(2000).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type CreateFormPageInput = z.infer<typeof createFormPageSchema>;

export const updateFormPageSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  branchingRules: z.array(pageBranchingRuleSchema).nullable().optional(),
});

export type UpdateFormPageInput = z.infer<typeof updateFormPageSchema>;

export const reorderFormPagesSchema = z.object({
  pageIds: z.array(z.string().uuid()).min(1),
});

export type ReorderFormPagesInput = z.infer<typeof reorderFormPagesSchema>;

// ---------------------------------------------------------------------------
// Form field schema
// ---------------------------------------------------------------------------

export const formFieldSchema = z.object({
  id: z.string().uuid().describe("Unique identifier for the field"),
  formDefinitionId: z
    .string()
    .uuid()
    .describe("ID of the parent form definition"),
  fieldKey: z
    .string()
    .min(1)
    .max(100)
    .describe("Machine name for the field (unique per form)"),
  fieldType: formFieldTypeSchema,
  label: z.string().min(1).max(500).describe("Human-readable label"),
  description: z.string().nullable().describe("Help text for the field"),
  placeholder: z
    .string()
    .nullable()
    .describe("Placeholder text for input fields"),
  required: z
    .boolean()
    .describe("Whether the field is required for submission"),
  sortOrder: z.number().int().describe("Display order within the form"),
  config: z
    .record(z.string(), z.unknown())
    .nullable()
    .describe("Type-specific configuration for the field"),
  conditionalRules: conditionalRulesSchema
    .nullable()
    .describe("Conditional display rules"),
  branchId: z
    .string()
    .nullable()
    .describe("Branch ID this field belongs to (from source field config)"),
  pageId: z.string().uuid().nullable().describe("Page this field belongs to"),
  createdAt: z.date().describe("When the field was created"),
  updatedAt: z.date().describe("When the field was last updated"),
});

export type FormField = z.infer<typeof formFieldSchema>;

// ---------------------------------------------------------------------------
// Form definition schemas
// ---------------------------------------------------------------------------

export const formDefinitionSchema = z.object({
  id: z.string().uuid().describe("Unique identifier for the form definition"),
  organizationId: z.string().uuid().describe("ID of the owning organization"),
  name: z.string().describe("Display name of the form"),
  description: z.string().nullable().describe("Description of the form"),
  status: formStatusSchema,
  version: z.number().int().describe("Version number"),
  duplicatedFromId: z
    .string()
    .uuid()
    .nullable()
    .describe("ID of the form this was duplicated from"),
  createdBy: z.string().uuid().describe("ID of the user who created the form"),
  publishedAt: z.date().nullable().describe("When the form was published"),
  archivedAt: z.date().nullable().describe("When the form was archived"),
  createdAt: z.date().describe("When the form was created"),
  updatedAt: z.date().describe("When the form was last updated"),
});

export type FormDefinition = z.infer<typeof formDefinitionSchema>;

/** Form definition with its fields and pages — returned by getById. */
export const formDefinitionDetailSchema = formDefinitionSchema.extend({
  fields: z
    .array(formFieldSchema)
    .describe("Fields in this form, ordered by sortOrder"),
  pages: z
    .array(formPageSchema)
    .describe("Pages in this form, ordered by sortOrder"),
});

export type FormDefinitionDetail = z.infer<typeof formDefinitionDetailSchema>;

// ---------------------------------------------------------------------------
// CRUD input schemas
// ---------------------------------------------------------------------------

export const createFormDefinitionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .describe("Display name for the form (1-255 chars)"),
  description: z
    .string()
    .max(2000)
    .optional()
    .describe("Description of the form (max 2,000 chars)"),
});

export type CreateFormDefinitionInput = z.infer<
  typeof createFormDefinitionSchema
>;

export const updateFormDefinitionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .optional()
    .describe("New display name"),
  description: z.string().max(2000).optional().describe("New description"),
});

export type UpdateFormDefinitionInput = z.infer<
  typeof updateFormDefinitionSchema
>;

export const createFormFieldSchema = z.object({
  fieldKey: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "Field key must start with a lowercase letter and contain only lowercase letters, numbers, and underscores",
    )
    .describe("Machine name for the field"),
  fieldType: formFieldTypeSchema,
  label: z.string().trim().min(1).max(500).describe("Human-readable label"),
  description: z
    .string()
    .max(2000)
    .optional()
    .describe("Help text for the field"),
  placeholder: z.string().max(500).optional().describe("Placeholder text"),
  required: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether the field is required"),
  sortOrder: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Display order (auto-assigned if omitted)"),
  config: fieldConfigSchema.optional().describe("Type-specific configuration"),
  branchId: z.string().optional().describe("Branch ID to assign this field to"),
});

export type CreateFormFieldInput = z.infer<typeof createFormFieldSchema>;

export const updateFormFieldSchema = z.object({
  label: z.string().trim().min(1).max(500).optional().describe("New label"),
  description: z.string().max(2000).optional().describe("New help text"),
  placeholder: z.string().max(500).optional().describe("New placeholder"),
  required: z.boolean().optional().describe("New required state"),
  config: fieldConfigSchema.optional().describe("New configuration"),
  conditionalRules: conditionalRulesSchema
    .nullable()
    .optional()
    .describe("Conditional display rules"),
  branchId: z
    .string()
    .nullable()
    .optional()
    .describe("Branch ID to assign this field to"),
});

export type UpdateFormFieldInput = z.infer<typeof updateFormFieldSchema>;

export const reorderFormFieldsSchema = z.object({
  fieldIds: z
    .array(z.string().uuid())
    .min(1)
    .describe("Ordered list of field IDs"),
});

export type ReorderFormFieldsInput = z.infer<typeof reorderFormFieldsSchema>;

export const listFormDefinitionsSchema = z.object({
  status: formStatusSchema.optional().describe("Filter by form status"),
  search: z
    .string()
    .trim()
    .max(200)
    .optional()
    .describe("Search by name (max 200 chars)"),
  page: z.number().int().min(1).default(1).describe("Page number (1-based)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Items per page (1-100, default 20)"),
});

export type ListFormDefinitionsInput = z.infer<
  typeof listFormDefinitionsSchema
>;

// ---------------------------------------------------------------------------
// Form data validation error
// ---------------------------------------------------------------------------

export const formFieldErrorSchema = z.object({
  fieldKey: z.string().describe("Key of the invalid field"),
  message: z.string().describe("Validation error message"),
});

export type FormFieldError = z.infer<typeof formFieldErrorSchema>;
