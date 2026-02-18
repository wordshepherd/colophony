import { TRPCError } from '@trpc/server';
import {
  createApiKeySchema,
  revokeApiKeySchema,
  deleteApiKeySchema,
  paginationSchema,
  AuditActions,
  AuditResources,
  apiKeyResponseSchema,
  createApiKeyResponseSchema,
  revokeApiKeyResponseSchema,
  successResponseSchema,
  paginatedResponseSchema,
  type ApiKeyResponse,
  type CreateApiKeyResponse,
  type PaginatedResponse,
} from '@colophony/types';
import {
  orgProcedure,
  adminProcedure,
  createRouter,
  requireScopes,
} from '../init.js';
import { apiKeyService } from '../../services/api-key.service.js';

export const apiKeysRouter = createRouter({
  list: orgProcedure
    .use(requireScopes('api-keys:read'))
    .input(paginationSchema)
    .output(paginatedResponseSchema(apiKeyResponseSchema))
    .query(async ({ ctx, input }) => {
      // Cast: Drizzle JSONB returns `scopes: string[]`; .output() validates at runtime
      return apiKeyService.list(ctx.dbTx, input) as Promise<
        PaginatedResponse<ApiKeyResponse>
      >;
    }),

  create: adminProcedure
    .use(requireScopes('api-keys:manage'))
    .input(createApiKeySchema)
    .output(createApiKeyResponseSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await apiKeyService.create(
        ctx.dbTx,
        ctx.authContext.orgId,
        ctx.authContext.userId,
        input,
      );
      await ctx.audit({
        action: AuditActions.API_KEY_CREATED,
        resource: AuditResources.API_KEY,
        resourceId: result.id,
        newValue: { name: input.name, scopes: input.scopes },
      });
      // Cast: Drizzle JSONB returns `scopes: string[]`; .output() validates at runtime
      return result as CreateApiKeyResponse;
    }),

  revoke: adminProcedure
    .use(requireScopes('api-keys:manage'))
    .input(revokeApiKeySchema)
    .output(revokeApiKeyResponseSchema)
    .mutation(async ({ ctx, input }) => {
      const revoked = await apiKeyService.revoke(ctx.dbTx, input.keyId);
      if (!revoked) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'API key not found',
        });
      }
      await ctx.audit({
        action: AuditActions.API_KEY_REVOKED,
        resource: AuditResources.API_KEY,
        resourceId: revoked.id,
      });
      return revoked;
    }),

  delete: adminProcedure
    .use(requireScopes('api-keys:manage'))
    .input(deleteApiKeySchema)
    .output(successResponseSchema)
    .mutation(async ({ ctx, input }) => {
      const deleted = await apiKeyService.delete(ctx.dbTx, input.keyId);
      if (!deleted) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'API key not found',
        });
      }
      await ctx.audit({
        action: AuditActions.API_KEY_DELETED,
        resource: AuditResources.API_KEY,
        resourceId: deleted.id,
      });
      return { success: true };
    }),
});
