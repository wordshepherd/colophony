import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import {
  createApiKeySchema,
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
// API key routes
// ---------------------------------------------------------------------------

const list = orgProcedure
  .use(requireScopes('api-keys:read'))
  .route({ method: 'GET', path: '/api-keys' })
  .input(restPaginationQuery)
  .handler(async ({ input, context }) => {
    return apiKeyService.list(context.dbTx, input);
  });

const create = adminProcedure
  .use(requireScopes('api-keys:manage'))
  .route({ method: 'POST', path: '/api-keys', successStatus: 201 })
  .input(createApiKeySchema)
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
  .route({ method: 'POST', path: '/api-keys/{keyId}/revoke' })
  .input(keyIdParam)
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
  .route({ method: 'DELETE', path: '/api-keys/{keyId}' })
  .input(keyIdParam)
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
