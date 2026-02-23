import type { CmsConnection } from '@colophony/types';
import {
  listCmsConnectionsSchema,
  createCmsConnectionSchema,
  updateCmsConnectionSchema,
  idParamSchema,
} from '@colophony/types';
import { builder } from '../builder.js';
import { requireOrgContext, requireScopes } from '../guards.js';
import { toServiceContext } from '../../services/context.js';
import {
  cmsConnectionService,
  CmsConnectionNotFoundError,
} from '../../services/cms-connection.service.js';
import { mapServiceError } from '../error-mapper.js';
import { CmsConnectionType } from '../types/index.js';

// ---------------------------------------------------------------------------
// Paginated response type
// ---------------------------------------------------------------------------

const PaginatedCmsConnections = builder
  .objectRef<{
    items: CmsConnection[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>('PaginatedCmsConnections')
  .implement({
    fields: (t) => ({
      items: t.field({
        type: [CmsConnectionType],
        resolve: (r) => r.items,
      }),
      total: t.exposeInt('total'),
      page: t.exposeInt('page'),
      limit: t.exposeInt('limit'),
      totalPages: t.exposeInt('totalPages'),
    }),
  });

// ---------------------------------------------------------------------------
// Test result type
// ---------------------------------------------------------------------------

const CmsTestResultType = builder
  .objectRef<{ success: boolean; error?: string }>('CmsTestResult')
  .implement({
    fields: (t) => ({
      success: t.exposeBoolean('success'),
      error: t.exposeString('error', { nullable: true }),
    }),
  });

// ---------------------------------------------------------------------------
// Query fields
// ---------------------------------------------------------------------------

builder.queryFields((t) => ({
  /** List CMS connections in the org. */
  cmsConnections: t.field({
    type: PaginatedCmsConnections,
    description: 'List CMS connections in the organization.',
    args: {
      publicationId: t.arg.string({
        required: false,
        description: 'Filter by publication ID.',
      }),
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
      await requireScopes(ctx, 'cms:read');
      const input = listCmsConnectionsSchema.parse({
        publicationId: args.publicationId ?? undefined,
        page: args.page,
        limit: args.limit,
      });
      return cmsConnectionService.list(orgCtx.dbTx, input);
    },
  }),

  /** Get a single CMS connection by ID. */
  cmsConnection: t.field({
    type: CmsConnectionType,
    nullable: true,
    description: 'Get a CMS connection by ID.',
    args: {
      id: t.arg.string({
        required: true,
        description: 'CMS connection ID.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'cms:read');
      const { id } = idParamSchema.parse({ id: args.id });
      try {
        const connection = await cmsConnectionService.getById(orgCtx.dbTx, id);
        if (!connection) throw new CmsConnectionNotFoundError(id);
        return connection;
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),
}));

// ---------------------------------------------------------------------------
// Mutation fields
// ---------------------------------------------------------------------------

builder.mutationFields((t) => ({
  /** Create a new CMS connection. */
  createCmsConnection: t.field({
    type: CmsConnectionType,
    description: 'Create a new CMS connection.',
    args: {
      adapterType: t.arg.string({
        required: true,
        description: 'CMS adapter type (WORDPRESS or GHOST).',
      }),
      name: t.arg.string({
        required: true,
        description: 'Display name for this connection.',
      }),
      config: t.arg.string({
        required: true,
        description: 'JSON string of adapter-specific configuration.',
      }),
      publicationId: t.arg.string({
        required: false,
        description: 'Optional publication ID.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'cms:write');
      const input = createCmsConnectionSchema.parse({
        adapterType: args.adapterType,
        name: args.name,
        config: JSON.parse(args.config),
        publicationId: args.publicationId ?? undefined,
      });
      try {
        return await cmsConnectionService.createWithAudit(
          toServiceContext(orgCtx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Update a CMS connection. */
  updateCmsConnection: t.field({
    type: CmsConnectionType,
    description: 'Update a CMS connection.',
    args: {
      id: t.arg.string({ required: true, description: 'CMS connection ID.' }),
      name: t.arg.string({ required: false, description: 'New name.' }),
      config: t.arg.string({
        required: false,
        description: 'New config as JSON string.',
      }),
      isActive: t.arg.boolean({ required: false, description: 'Active flag.' }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'cms:write');
      const { id } = idParamSchema.parse({ id: args.id });
      const data = updateCmsConnectionSchema.parse({
        name: args.name ?? undefined,
        config: args.config ? JSON.parse(args.config) : undefined,
        isActive: args.isActive ?? undefined,
      });
      try {
        return await cmsConnectionService.updateWithAudit(
          toServiceContext(orgCtx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Delete a CMS connection. */
  deleteCmsConnection: t.field({
    type: CmsConnectionType,
    description: 'Delete a CMS connection.',
    args: {
      id: t.arg.string({ required: true, description: 'CMS connection ID.' }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'cms:write');
      const { id } = idParamSchema.parse({ id: args.id });
      try {
        return await cmsConnectionService.deleteWithAudit(
          toServiceContext(orgCtx),
          id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Test a CMS connection. */
  testCmsConnection: t.field({
    type: CmsTestResultType,
    description: 'Test the configuration of a CMS connection.',
    args: {
      id: t.arg.string({ required: true, description: 'CMS connection ID.' }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'cms:read');
      const { id } = idParamSchema.parse({ id: args.id });
      try {
        return await cmsConnectionService.testConnection(orgCtx.dbTx, id);
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),
}));
