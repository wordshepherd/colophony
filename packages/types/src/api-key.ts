import { z } from "zod";

// ---------------------------------------------------------------------------
// API Key Scopes — enforced by requireScopes middleware on REST + tRPC
// ---------------------------------------------------------------------------

export const apiKeyScopeSchema = z.enum([
  "submissions:read",
  "submissions:write",
  "files:read",
  "files:write",
  "organizations:read",
  "organizations:write",
  "users:read",
  "api-keys:read",
  "api-keys:manage",
  "payments:read",
  "webhooks:manage",
]);

export type ApiKeyScope = z.infer<typeof apiKeyScopeSchema>;

// ---------------------------------------------------------------------------
// CRUD schemas
// ---------------------------------------------------------------------------

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(apiKeyScopeSchema).min(1),
  expiresAt: z.coerce.date().optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export const revokeApiKeySchema = z.object({
  keyId: z.string().uuid(),
});

export const deleteApiKeySchema = z.object({
  keyId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

export const apiKeyResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  scopes: z.array(apiKeyScopeSchema),
  keyPrefix: z.string(),
  createdAt: z.date(),
  expiresAt: z.date().nullable(),
  lastUsedAt: z.date().nullable(),
  revokedAt: z.date().nullable(),
});

export type ApiKeyResponse = z.infer<typeof apiKeyResponseSchema>;

/** Only returned once on creation — plainTextKey is shown once, never stored. */
export const createApiKeyResponseSchema = apiKeyResponseSchema.extend({
  plainTextKey: z.string(),
});

export type CreateApiKeyResponse = z.infer<typeof createApiKeyResponseSchema>;
