import { TRPCError } from '@trpc/server';
import {
  createApiKeySchema,
  revokeApiKeySchema,
  deleteApiKeySchema,
  paginationSchema,
  AuditActions,
  AuditResources,
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
    .query(async ({ ctx, input }) => {
      return apiKeyService.list(ctx.dbTx, input);
    }),

  create: adminProcedure
    .use(requireScopes('api-keys:manage'))
    .input(createApiKeySchema)
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
      return result;
    }),

  revoke: adminProcedure
    .use(requireScopes('api-keys:manage'))
    .input(revokeApiKeySchema)
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
