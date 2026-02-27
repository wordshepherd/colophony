import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import {
  createApiKeySchema,
  revokeApiKeyResponseSchema,
  paginatedResponseSchema,
  successResponseSchema,
  AuditActions,
  AuditResources,
} from '@colophony/types';
import { restPaginationQuery } from '@colophony/api-contracts';
import { apiKeyService } from '../../services/api-key.service.js';
import { orgProcedure, adminProcedure, requireScopes } from '../context.js';

// ---------------------------------------------------------------------------
// Path param schemas
// ---------------------------------------------------------------------------

const keyIdParam = z.object({ keyId: z.string().uuid() });

// ---------------------------------------------------------------------------
// Output schemas
// ---------------------------------------------------------------------------

// Use z.array(z.string()) for scopes because Drizzle returns string[] from JSONB
const apiKeyOutputSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  scopes: z.array(z.string()),
  keyPrefix: z.string(),
  createdAt: z.date(),
  expiresAt: z.date().nullable(),
  lastUsedAt: z.date().nullable(),
  revokedAt: z.date().nullable(),
});

const createApiKeyOutputSchema = apiKeyOutputSchema.extend({
  plainTextKey: z.string(),
});

const paginatedApiKeysSchema = paginatedResponseSchema(apiKeyOutputSchema);

// ---------------------------------------------------------------------------
// API key routes
// ---------------------------------------------------------------------------

const list = orgProcedure
  .use(requireScopes('api-keys:read'))
  .route({
    method: 'GET',
    path: '/api-keys',
    summary: 'List API keys',
    description:
      'Returns all API keys for the current organization. Key values are masked.',
    operationId: 'listApiKeys',
    tags: ['API Keys'],
  })
  .input(restPaginationQuery)
  .output(paginatedApiKeysSchema)
  .handler(async ({ input, context }) => {
    return apiKeyService.list(context.dbTx, input);
  });

const create = adminProcedure
  .use(requireScopes('api-keys:manage'))
  .route({
    method: 'POST',
    path: '/api-keys',
    successStatus: 201,
    summary: 'Create an API key',
    description:
      'Create a new API key for the organization. The plain-text key is returned only once. Requires ADMIN role.',
    operationId: 'createApiKey',
    tags: ['API Keys'],
  })
  .input(createApiKeySchema)
  .output(createApiKeyOutputSchema)
  .handler(async ({ input, context }) => {
    const result = await apiKeyService.create(
      context.dbTx,
      context.authContext.orgId,
      context.authContext.userId,
      input,
    );
    await context.audit({
      action: AuditActions.API_KEY_CREATED,
      resource: AuditResources.API_KEY,
      resourceId: result.id,
      newValue: { name: input.name, scopes: input.scopes },
    });
    return result;
  });

const revoke = adminProcedure
  .use(requireScopes('api-keys:manage'))
  .route({
    method: 'POST',
    path: '/api-keys/{keyId}/revoke',
    summary: 'Revoke an API key',
    description:
      'Revoke an API key so it can no longer be used for authentication. Requires ADMIN role.',
    operationId: 'revokeApiKey',
    tags: ['API Keys'],
  })
  .input(keyIdParam)
  .output(revokeApiKeyResponseSchema)
  .handler(async ({ input, context }) => {
    const revoked = await apiKeyService.revoke(context.dbTx, input.keyId);
    if (!revoked) {
      throw new ORPCError('NOT_FOUND', { message: 'API key not found' });
    }
    await context.audit({
      action: AuditActions.API_KEY_REVOKED,
      resource: AuditResources.API_KEY,
      resourceId: revoked.id,
    });
    return revoked;
  });

const del = adminProcedure
  .use(requireScopes('api-keys:manage'))
  .route({
    method: 'DELETE',
    path: '/api-keys/{keyId}',
    summary: 'Delete an API key',
    description: 'Permanently delete an API key. Requires ADMIN role.',
    operationId: 'deleteApiKey',
    tags: ['API Keys'],
  })
  .input(keyIdParam)
  .output(successResponseSchema)
  .handler(async ({ input, context }) => {
    const deleted = await apiKeyService.delete(context.dbTx, input.keyId);
    if (!deleted) {
      throw new ORPCError('NOT_FOUND', { message: 'API key not found' });
    }
    await context.audit({
      action: AuditActions.API_KEY_DELETED,
      resource: AuditResources.API_KEY,
      resourceId: deleted.id,
    });
    return { success: true as const };
  });

// ---------------------------------------------------------------------------
// Assembled router
// ---------------------------------------------------------------------------

export const apiKeysRouter = {
  list,
  create,
  revoke,
  delete: del,
};
