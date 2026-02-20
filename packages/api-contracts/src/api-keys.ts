import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  createApiKeySchema,
  apiKeyResponseSchema,
  createApiKeyResponseSchema,
} from "@colophony/types";
import { restPaginationQuery } from "./shared.js";

// ---------------------------------------------------------------------------
// Path param schemas
// ---------------------------------------------------------------------------

const keyIdParam = z.object({
  keyId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

const paginatedApiKeysSchema = z.object({
  items: z.array(apiKeyResponseSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

const deleteResponseSchema = z.object({
  success: z.literal(true),
});

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export const apiKeysContract = {
  list: oc
    .route({
      method: "GET",
      path: "/api-keys",
      summary: "List API keys",
      description:
        "Returns a paginated list of API keys for the current organization.",
      operationId: "listApiKeys",
      tags: ["API Keys"],
    })
    .input(restPaginationQuery)
    .output(paginatedApiKeysSchema),

  create: oc
    .route({
      method: "POST",
      path: "/api-keys",
      successStatus: 201,
      summary: "Create an API key",
      description:
        "Generate a new API key with specified scopes. The plain-text key is returned only once. Requires ADMIN role.",
      operationId: "createApiKey",
      tags: ["API Keys"],
    })
    .input(createApiKeySchema)
    .output(createApiKeyResponseSchema),

  revoke: oc
    .route({
      method: "POST",
      path: "/api-keys/{keyId}/revoke",
      summary: "Revoke an API key",
      description:
        "Revoke an active API key, preventing further use. Requires ADMIN role.",
      operationId: "revokeApiKey",
      tags: ["API Keys"],
    })
    .input(keyIdParam)
    .output(apiKeyResponseSchema),

  delete: oc
    .route({
      method: "DELETE",
      path: "/api-keys/{keyId}",
      summary: "Delete an API key",
      description: "Permanently delete an API key record. Requires ADMIN role.",
      operationId: "deleteApiKey",
      tags: ["API Keys"],
    })
    .input(keyIdParam)
    .output(deleteResponseSchema),
};
