import { GraphQLError } from 'graphql';
import {
  paginationSchema,
  createApiKeySchema,
  revokeApiKeySchema,
  deleteApiKeySchema,
  AuditActions,
  AuditResources,
} from '@colophony/types';
import { builder } from '../builder.js';
import { requireOrgContext, requireAdmin, requireScopes } from '../guards.js';
import { apiKeyService } from '../../services/api-key.service.js';
import { ApiKeyType } from '../types/api-key.js';
import {
  CreateApiKeyPayload,
  RevokeApiKeyPayload,
  SuccessPayload,
} from '../types/payloads.js';

// ---------------------------------------------------------------------------
// Paginated response type
// ---------------------------------------------------------------------------

const PaginatedApiKeys = builder
  .objectRef<{
    items: {
      id: string;
      name: string;
      scopes: unknown;
      keyPrefix: string;
      createdAt: Date;
      expiresAt: Date | null;
      lastUsedAt: Date | null;
      revokedAt: Date | null;
    }[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>('PaginatedApiKeys')
  .implement({
    fields: (t) => ({
      items: t.field({ type: [ApiKeyType], resolve: (r) => r.items }),
      total: t.exposeInt('total'),
      page: t.exposeInt('page'),
      limit: t.exposeInt('limit'),
      totalPages: t.exposeInt('totalPages'),
    }),
  });

// ---------------------------------------------------------------------------
// Query fields
// ---------------------------------------------------------------------------

builder.queryFields((t) => ({
  /**
   * List API keys for the current organization.
   */
  apiKeys: t.field({
    type: PaginatedApiKeys,
    description: 'List API keys for the current organization.',
    args: {
      page: t.arg.int({
        required: false,
        defaultValue: 1,
        description: 'Page number (1-based).',
      }),
      limit: t.arg.int({
        required: false,
        defaultValue: 20,
        description: 'Items per page (1-100).',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'api-keys:read');
      const input = paginationSchema.parse({
        page: args.page,
        limit: args.limit,
      });
      return apiKeyService.list(orgCtx.dbTx, input);
    },
  }),
}));

// ---------------------------------------------------------------------------
// Mutation fields
// ---------------------------------------------------------------------------

builder.mutationFields((t) => ({
  /**
   * Create a new API key (admin only). Returns the plain text key once.
   */
  createApiKey: t.field({
    type: CreateApiKeyPayload,
    description:
      'Create a new API key. The plain-text key is returned only once. Requires ADMIN role.',
    args: {
      name: t.arg.string({
        required: true,
        description: 'Human-readable name for the key.',
      }),
      scopes: t.arg.stringList({
        required: true,
        description: 'Permission scopes to grant.',
      }),
      expiresAt: t.arg({
        type: 'DateTime',
        required: false,
        description: 'Optional expiration date.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireAdmin(ctx);
      await requireScopes(ctx, 'api-keys:manage');
      const input = createApiKeySchema.parse({
        name: args.name,
        scopes: args.scopes,
        expiresAt: args.expiresAt ?? undefined,
      });
      const result = await apiKeyService.create(
        orgCtx.dbTx,
        orgCtx.authContext.orgId,
        orgCtx.authContext.userId,
        input,
      );
      await ctx.audit({
        action: AuditActions.API_KEY_CREATED,
        resource: AuditResources.API_KEY,
        resourceId: result.id,
        newValue: { name: input.name, scopes: input.scopes },
      });
      return result;
    },
  }),

  /**
   * Revoke an API key (admin only).
   */
  revokeApiKey: t.field({
    type: RevokeApiKeyPayload,
    description:
      'Revoke an active API key, preventing further use. Requires ADMIN role.',
    args: {
      keyId: t.arg.string({
        required: true,
        description: 'ID of the API key to revoke.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireAdmin(ctx);
      await requireScopes(ctx, 'api-keys:manage');
      const { keyId } = revokeApiKeySchema.parse({ keyId: args.keyId });
      const revoked = await apiKeyService.revoke(orgCtx.dbTx, keyId);
      if (!revoked) {
        throw new GraphQLError('API key not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      await ctx.audit({
        action: AuditActions.API_KEY_REVOKED,
        resource: AuditResources.API_KEY,
        resourceId: revoked.id,
      });
      return revoked;
    },
  }),

  /**
   * Delete an API key (admin only).
   */
  deleteApiKey: t.field({
    type: SuccessPayload,
    description: 'Permanently delete an API key record. Requires ADMIN role.',
    args: {
      keyId: t.arg.string({
        required: true,
        description: 'ID of the API key to delete.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireAdmin(ctx);
      await requireScopes(ctx, 'api-keys:manage');
      const { keyId } = deleteApiKeySchema.parse({ keyId: args.keyId });
      const deleted = await apiKeyService.delete(orgCtx.dbTx, keyId);
      if (!deleted) {
        throw new GraphQLError('API key not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      await ctx.audit({
        action: AuditActions.API_KEY_DELETED,
        resource: AuditResources.API_KEY,
        resourceId: deleted.id,
      });
      return { success: true };
    },
  }),
}));
