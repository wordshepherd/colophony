import { z } from "zod";

// ---------------------------------------------------------------------------
// API Key Scopes — enforced by requireScopes middleware on REST + tRPC
// ---------------------------------------------------------------------------

export const apiKeyScopeSchema = z
  .enum([
    "manuscripts:read",
    "manuscripts:write",
    "submissions:read",
    "submissions:write",
    "files:read",
    "files:write",
    "forms:read",
    "forms:write",
    "periods:read",
    "periods:write",
    "organizations:read",
    "organizations:write",
    "users:read",
    "api-keys:read",
    "api-keys:manage",
    "payments:read",
    "webhooks:manage",
    "publications:read",
    "publications:write",
    "pipeline:read",
    "pipeline:write",
    "contracts:read",
    "contracts:write",
    "issues:read",
    "issues:write",
    "cms:read",
    "cms:write",
    "email_templates:read",
    "email_templates:write",
    "csr:read",
    "csr:write",
    "external-submissions:read",
    "external-submissions:write",
    "writer-profiles:read",
    "writer-profiles:write",
    "journal-directory:read",
    "correspondence:read",
    "correspondence:write",
    "audit:read",
    "collections:read",
    "collections:write",
    "contributors:read",
    "contributors:write",
    "rights:read",
    "rights:write",
    "payment-transactions:read",
    "payment-transactions:write",
  ])
  .describe("Permission scope for the API key");

export type ApiKeyScope = z.infer<typeof apiKeyScopeSchema>;

// ---------------------------------------------------------------------------
// CRUD schemas
// ---------------------------------------------------------------------------

export const createApiKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .describe("Human-readable name for the API key"),
  scopes: z
    .array(apiKeyScopeSchema)
    .min(1)
    .describe("Permission scopes to grant (at least one)"),
  expiresAt: z.coerce
    .date()
    .optional()
    .describe("Optional expiration date (ISO-8601)"),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export const revokeApiKeySchema = z.object({
  keyId: z.string().uuid().describe("ID of the API key to revoke"),
});

export const deleteApiKeySchema = z.object({
  keyId: z.string().uuid().describe("ID of the API key to delete"),
});

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

export const apiKeyResponseSchema = z.object({
  id: z.string().uuid().describe("Unique identifier for the API key"),
  name: z.string().describe("Human-readable name"),
  scopes: z.array(apiKeyScopeSchema).describe("Granted permission scopes"),
  keyPrefix: z
    .string()
    .describe(
      "First characters of the key for identification (e.g. col_live_abc...)",
    ),
  createdAt: z.date().describe("When the key was created"),
  expiresAt: z
    .date()
    .nullable()
    .describe("When the key expires (null = never)"),
  lastUsedAt: z
    .date()
    .nullable()
    .describe("When the key was last used for authentication"),
  revokedAt: z
    .date()
    .nullable()
    .describe("When the key was revoked (null = active)"),
});

export type ApiKeyResponse = z.infer<typeof apiKeyResponseSchema>;

/** Returned from `apiKeys.revoke` — subset of key metadata with revokedAt. */
export const revokeApiKeyResponseSchema = z.object({
  id: z.string().uuid().describe("API key ID"),
  name: z.string().describe("Human-readable name"),
  revokedAt: z.date().nullable().describe("When the key was revoked"),
});

export type RevokeApiKeyResponse = z.infer<typeof revokeApiKeyResponseSchema>;

/** Only returned once on creation — plainTextKey is shown once, never stored. */
export const createApiKeyResponseSchema = apiKeyResponseSchema.extend({
  plainTextKey: z
    .string()
    .describe("The full API key — shown only once, never stored"),
});

export type CreateApiKeyResponse = z.infer<typeof createApiKeyResponseSchema>;
