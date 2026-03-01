import { z } from "zod";
import { scanStatusSchema } from "./file";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const EMBED_TOKEN_PREFIX = "col_emb_";
export const STATUS_TOKEN_PREFIX = "col_sta_";

// ---------------------------------------------------------------------------
// Theme config
// ---------------------------------------------------------------------------

export const embedThemeConfigSchema = z
  .object({
    primaryColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional()
      .describe("Primary brand color (hex, e.g. #3b82f6)"),
    fontFamily: z
      .string()
      .max(100)
      .optional()
      .describe("CSS font-family value"),
    borderRadius: z
      .string()
      .max(20)
      .optional()
      .describe("CSS border-radius value (e.g. 8px)"),
    darkMode: z.boolean().optional().describe("Enable dark mode theme"),
  })
  .describe("Theme configuration for the embedded form");

export type EmbedThemeConfig = z.infer<typeof embedThemeConfigSchema>;

// ---------------------------------------------------------------------------
// Origin validation — scheme + host + optional port, no path
// ---------------------------------------------------------------------------

const ORIGIN_RE = /^https?:\/\/[a-zA-Z0-9.-]+(:\d{1,5})?$/;

export const allowedOriginSchema = z
  .string()
  .regex(
    ORIGIN_RE,
    "Must be a valid origin (scheme + host + optional port, no path)",
  )
  .describe("Allowed embedding origin (e.g. https://magazine.example.com)");

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

export const createEmbedTokenSchema = z.object({
  submissionPeriodId: z
    .string()
    .uuid()
    .describe("Submission period to generate the embed for"),
  allowedOrigins: z
    .array(allowedOriginSchema)
    .default([])
    .describe("Origins allowed to embed the form (empty = any origin)"),
  themeConfig: embedThemeConfigSchema.optional().describe("Custom theme"),
  expiresAt: z.coerce
    .date()
    .optional()
    .describe("Optional expiration date (ISO-8601)"),
});

export type CreateEmbedTokenInput = z.infer<typeof createEmbedTokenSchema>;

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

export const embedTokenResponseSchema = z.object({
  id: z.string().uuid().describe("Embed token ID"),
  submissionPeriodId: z.string().uuid().describe("Linked submission period"),
  tokenPrefix: z
    .string()
    .describe("Token prefix for identification (col_emb_)"),
  allowedOrigins: z
    .array(z.string())
    .describe("Origins allowed to embed the form"),
  themeConfig: embedThemeConfigSchema
    .nullable()
    .describe("Theme configuration"),
  active: z.boolean().describe("Whether the token is active"),
  createdAt: z.date().describe("When the token was created"),
  expiresAt: z
    .date()
    .nullable()
    .describe("When the token expires (null = never)"),
});

export type EmbedTokenResponse = z.infer<typeof embedTokenResponseSchema>;

export const createEmbedTokenResponseSchema = embedTokenResponseSchema.extend({
  plainTextToken: z
    .string()
    .describe("The full embed token — shown only once, never stored"),
});

export type CreateEmbedTokenResponse = z.infer<
  typeof createEmbedTokenResponseSchema
>;

export const embedFormResponseSchema = z
  .object({
    period: z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        opensAt: z.date(),
        closesAt: z.date(),
      })
      .describe("Submission period metadata"),
    form: z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        fields: z.array(z.unknown()),
        pages: z.array(z.unknown()),
      })
      .nullable()
      .describe("Form definition with fields and pages (null if no form)"),
    theme: embedThemeConfigSchema.nullable().describe("Theme configuration"),
    organizationId: z.string().uuid().describe("Organization ID"),
  })
  .describe("Public embed form response");

export type EmbedFormResponse = z.infer<typeof embedFormResponseSchema>;

// ---------------------------------------------------------------------------
// Submit schemas
// ---------------------------------------------------------------------------

export const embedSubmitSchema = z.object({
  email: z.string().email().max(255).describe("Submitter email address"),
  name: z.string().max(255).optional().describe("Submitter display name"),
  title: z.string().min(1).max(500).describe("Submission title"),
  content: z.string().optional().describe("Submission content/body text"),
  coverLetter: z.string().optional().describe("Cover letter text"),
  formData: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Dynamic form field responses"),
  manuscriptVersionId: z
    .string()
    .uuid()
    .optional()
    .describe("Manuscript version with uploaded files (from prepareUpload)"),
});

export type EmbedSubmitInput = z.infer<typeof embedSubmitSchema>;

export const embedSubmitResponseSchema = z.object({
  success: z.literal(true),
  submissionId: z.string().uuid().describe("Created submission ID"),
  message: z.string().describe("Confirmation message"),
  statusToken: z
    .string()
    .optional()
    .describe("Status check token (col_sta_ prefixed)"),
});

export type EmbedSubmitResponse = z.infer<typeof embedSubmitResponseSchema>;

export const embedStatusCheckResponseSchema = z.object({
  title: z.string().nullable().describe("Submission title"),
  status: z.string().describe("User-friendly submission status"),
  submittedAt: z
    .string()
    .nullable()
    .describe("Submission date (ISO-8601 string)"),
  organizationName: z.string().describe("Organization name"),
  periodName: z.string().nullable().describe("Submission period name"),
});

export type EmbedStatusCheckResponse = z.infer<
  typeof embedStatusCheckResponseSchema
>;

// ---------------------------------------------------------------------------
// Revoke schema
// ---------------------------------------------------------------------------

export const revokeEmbedTokenSchema = z.object({
  tokenId: z.string().uuid().describe("ID of the embed token to revoke"),
});

export const listEmbedTokensByPeriodSchema = z.object({
  submissionPeriodId: z
    .string()
    .uuid()
    .describe("Submission period to list tokens for"),
});

// ---------------------------------------------------------------------------
// Prepare upload schemas
// ---------------------------------------------------------------------------

export const embedPrepareUploadSchema = z.object({
  email: z.string().email().max(255).describe("Submitter email address"),
  name: z.string().max(255).optional().describe("Submitter display name"),
});

export type EmbedPrepareUploadInput = z.infer<typeof embedPrepareUploadSchema>;

export const embedPrepareUploadResponseSchema = z.object({
  manuscriptVersionId: z
    .string()
    .uuid()
    .describe("Manuscript version ID for tus metadata"),
  guestUserId: z.string().uuid().describe("Guest user ID for tus metadata"),
  tusEndpoint: z.string().url().describe("tusd endpoint URL"),
  maxFileSize: z.number().describe("Max file size in bytes"),
  maxFiles: z.number().describe("Max files per manuscript version"),
  allowedMimeTypes: z
    .array(z.string())
    .describe("Allowed MIME types for upload"),
});

export type EmbedPrepareUploadResponse = z.infer<
  typeof embedPrepareUploadResponseSchema
>;

// ---------------------------------------------------------------------------
// Upload status schemas
// ---------------------------------------------------------------------------

export const embedUploadStatusQuerySchema = z.object({
  email: z
    .string()
    .email()
    .max(255)
    .describe("Submitter email for ownership check"),
});

export const embedUploadStatusResponseSchema = z.object({
  files: z.array(
    z.object({
      id: z.string().uuid(),
      filename: z.string(),
      size: z.number(),
      mimeType: z.string(),
      scanStatus: scanStatusSchema,
    }),
  ),
  allClean: z.boolean().describe("Whether all files passed virus scanning"),
});

export type EmbedUploadStatusResponse = z.infer<
  typeof embedUploadStatusResponseSchema
>;
