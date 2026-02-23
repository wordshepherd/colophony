import type { Publication } from '@colophony/types';
import {
  listPublicationsSchema,
  createPublicationSchema,
  updatePublicationSchema,
  idParamSchema,
} from '@colophony/types';
import { builder } from '../builder.js';
import { requireOrgContext, requireScopes } from '../guards.js';
import { toServiceContext } from '../../services/context.js';
import {
  publicationService,
  PublicationNotFoundError,
} from '../../services/publication.service.js';
import { mapServiceError } from '../error-mapper.js';
import { PublicationType } from '../types/index.js';

// ---------------------------------------------------------------------------
// Paginated response type
// ---------------------------------------------------------------------------

const PaginatedPublications = builder
  .objectRef<{
    items: Publication[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>('PaginatedPublications')
  .implement({
    fields: (t) => ({
      items: t.field({
        type: [PublicationType],
        resolve: (r) => r.items,
      }),
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
  /** List publications in the org. */
  publications: t.field({
    type: PaginatedPublications,
    description: 'List publications in the organization.',
    args: {
      status: t.arg.string({
        required: false,
        description: 'Filter by publication status (ACTIVE, ARCHIVED).',
      }),
      search: t.arg.string({
        required: false,
        description: 'Search by name.',
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
      await requireScopes(ctx, 'publications:read');
      const input = listPublicationsSchema.parse({
        status: args.status ?? undefined,
        search: args.search ?? undefined,
        page: args.page,
        limit: args.limit,
      });
      return publicationService.list(orgCtx.dbTx, input);
    },
  }),

  /** Get a single publication by ID. */
  publication: t.field({
    type: PublicationType,
    nullable: true,
    description: 'Get a publication by ID.',
    args: {
      id: t.arg.string({
        required: true,
        description: 'Publication ID.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'publications:read');
      const { id } = idParamSchema.parse({ id: args.id });
      try {
        const publication = await publicationService.getById(orgCtx.dbTx, id);
        if (!publication) throw new PublicationNotFoundError(id);
        return publication;
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
  /** Create a new publication. */
  createPublication: t.field({
    type: PublicationType,
    description:
      'Create a new publication — a named publishing venue within the organization.',
    args: {
      name: t.arg.string({
        required: true,
        description: 'Display name for the publication.',
      }),
      slug: t.arg.string({
        required: true,
        description: 'URL-friendly slug (lowercase alphanumeric + hyphens).',
      }),
      description: t.arg.string({
        required: false,
        description: 'Description of the publication.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'publications:write');
      const input = createPublicationSchema.parse({
        name: args.name,
        slug: args.slug,
        description: args.description ?? undefined,
      });
      try {
        return await publicationService.createWithAudit(
          toServiceContext(orgCtx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Update a publication. */
  updatePublication: t.field({
    type: PublicationType,
    description: 'Update a publication.',
    args: {
      id: t.arg.string({ required: true, description: 'Publication ID.' }),
      name: t.arg.string({ required: false, description: 'New name.' }),
      slug: t.arg.string({ required: false, description: 'New slug.' }),
      description: t.arg.string({
        required: false,
        description: 'New description.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'publications:write');
      const { id } = idParamSchema.parse({ id: args.id });
      const data = updatePublicationSchema.parse({
        name: args.name ?? undefined,
        slug: args.slug ?? undefined,
        description:
          args.description === null ? null : (args.description ?? undefined),
      });
      try {
        return await publicationService.updateWithAudit(
          toServiceContext(orgCtx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Archive a publication. */
  archivePublication: t.field({
    type: PublicationType,
    description: 'Archive a publication.',
    args: {
      id: t.arg.string({ required: true, description: 'Publication ID.' }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'publications:write');
      const { id } = idParamSchema.parse({ id: args.id });
      try {
        return await publicationService.archiveWithAudit(
          toServiceContext(orgCtx),
          id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),
}));
