import { z } from "zod";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const EMBED_TOKEN_PREFIX = "col_emb_";

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
});

export type EmbedSubmitInput = z.infer<typeof embedSubmitSchema>;

export const embedSubmitResponseSchema = z.object({
  success: z.literal(true),
  submissionId: z.string().uuid().describe("Created submission ID"),
  message: z.string().describe("Confirmation message"),
});

export type EmbedSubmitResponse = z.infer<typeof embedSubmitResponseSchema>;

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
