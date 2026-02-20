import { paginationSchema } from '@colophony/types';
import { builder } from '../builder.js';
import { requireAuth, requireOrgContext, requireScopes } from '../guards.js';
import { organizationService } from '../../services/organization.service.js';
import { OrganizationType } from '../types/index.js';

// ---------------------------------------------------------------------------
// Paginated response types
// ---------------------------------------------------------------------------

const PaginatedOrganizationMembers = builder
  .objectRef<{
    items: {
      id: string;
      userId: string;
      role: string;
      email: string;
      createdAt: Date;
    }[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>('PaginatedOrganizationMembers')
  .implement({
    fields: (t) => ({
      items: t.field({
        type: [OrgMemberWithEmailType],
        resolve: (r) => r.items,
      }),
      total: t.exposeInt('total'),
      page: t.exposeInt('page'),
      limit: t.exposeInt('limit'),
      totalPages: t.exposeInt('totalPages'),
    }),
  });

/** Organization member as returned by listMembers (includes joined email). */
const OrgMemberWithEmailType = builder
  .objectRef<{
    id: string;
    userId: string;
    role: string;
    email: string;
    createdAt: Date;
  }>('OrgMemberWithEmail')
  .implement({
    fields: (t) => ({
      id: t.exposeString('id'),
      userId: t.exposeString('userId'),
      role: t.exposeString('role'),
      email: t.exposeString('email'),
      createdAt: t.expose('createdAt', { type: 'DateTime' }),
    }),
  });

/** User organization listing shape (from listUserOrganizations). */
const UserOrganizationType = builder
  .objectRef<{
    organizationId: string;
    role: string;
    name: string;
    slug: string;
  }>('UserOrganization')
  .implement({
    fields: (t) => ({
      organizationId: t.exposeString('organizationId'),
      role: t.exposeString('role'),
      name: t.exposeString('name'),
      slug: t.exposeString('slug'),
    }),
  });

// ---------------------------------------------------------------------------
// Query fields
// ---------------------------------------------------------------------------

builder.queryFields((t) => ({
  /**
   * List the current user's organizations (cross-org, no RLS needed).
   */
  myOrganizations: t.field({
    type: [UserOrganizationType],
    resolve: async (_root, _args, ctx) => {
      const authed = requireAuth(ctx);
      await requireScopes(ctx, 'organizations:read');
      return organizationService.listUserOrganizations(
        authed.authContext.userId,
      );
    },
  }),

  /**
   * Get the current org (requires org context).
   */
  organization: t.field({
    type: OrganizationType,
    nullable: true,
    resolve: async (_root, _args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'organizations:read');
      return organizationService.getById(orgCtx.dbTx, orgCtx.authContext.orgId);
    },
  }),

  /**
   * List members of the current org.
   */
  organizationMembers: t.field({
    type: PaginatedOrganizationMembers,
    args: {
      page: t.arg.int({ required: false, defaultValue: 1 }),
      limit: t.arg.int({ required: false, defaultValue: 20 }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'organizations:read');
      const input = paginationSchema.parse({
        page: args.page,
        limit: args.limit,
      });
      return organizationService.listMembers(orgCtx.dbTx, input);
    },
  }),
}));
