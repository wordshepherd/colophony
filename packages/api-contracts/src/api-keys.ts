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
    .route({ method: "GET", path: "/api-keys" })
    .input(restPaginationQuery)
    .output(paginatedApiKeysSchema),

  create: oc
    .route({ method: "POST", path: "/api-keys", successStatus: 201 })
    .input(createApiKeySchema)
    .output(createApiKeyResponseSchema),

  revoke: oc
    .route({ method: "POST", path: "/api-keys/{keyId}/revoke" })
    .input(keyIdParam)
    .output(apiKeyResponseSchema),

  delete: oc
    .route({ method: "DELETE", path: "/api-keys/{keyId}" })
    .input(keyIdParam)
    .output(deleteResponseSchema),
};
