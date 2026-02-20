import {
  paginationSchema,
  createOrganizationSchema,
  updateOrganizationSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  memberIdParamSchema,
} from '@colophony/types';
import { builder } from '../builder.js';
import {
  requireAuth,
  requireOrgContext,
  requireAdmin,
  requireScopes,
} from '../guards.js';
import { toServiceContext } from '../../services/context.js';
import { organizationService } from '../../services/organization.service.js';
import { mapServiceError } from '../error-mapper.js';
import { OrganizationType, OrganizationMemberType } from '../types/index.js';
import {
  CreateOrganizationPayload,
  SuccessPayload,
} from '../types/payloads.js';

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
    description:
      "List the current user's organizations (cross-org, no org context needed).",
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
    description:
      'Get the current organization (requires X-Organization-Id header).',
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
    description: 'List members of the current organization.',
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
      await requireScopes(ctx, 'organizations:read');
      const input = paginationSchema.parse({
        page: args.page,
        limit: args.limit,
      });
      return organizationService.listMembers(orgCtx.dbTx, input);
    },
  }),
}));

// ---------------------------------------------------------------------------
// Mutation fields
// ---------------------------------------------------------------------------

builder.mutationFields((t) => ({
  /**
   * Create a new organization. No org context needed (it doesn't exist yet).
   */
  createOrganization: t.field({
    type: CreateOrganizationPayload,
    description:
      'Create a new organization. The caller becomes the first ADMIN.',
    args: {
      name: t.arg.string({
        required: true,
        description: 'Display name of the organization.',
      }),
      slug: t.arg.string({
        required: true,
        description:
          'URL-friendly identifier (3-63 chars, lowercase alphanumeric with hyphens).',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const authed = requireAuth(ctx);
      await requireScopes(ctx, 'organizations:write');
      const input = createOrganizationSchema.parse({
        name: args.name,
        slug: args.slug,
      });
      try {
        return await organizationService.createWithAudit(
          authed.audit,
          input,
          authed.authContext.userId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /**
   * Update the current organization (admin only).
   */
  updateOrganization: t.field({
    type: OrganizationType,
    description:
      "Update the current organization's name or settings. Requires ADMIN role.",
    args: {
      name: t.arg.string({ required: false, description: 'New display name.' }),
      settings: t.arg({
        type: 'JSON',
        required: false,
        description: 'Organization settings as key-value pairs.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireAdmin(ctx);
      await requireScopes(ctx, 'organizations:write');
      const input = updateOrganizationSchema.parse({
        name: args.name ?? undefined,
        settings: args.settings ?? undefined,
      });
      try {
        return await organizationService.updateWithAudit(
          toServiceContext(orgCtx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /**
   * Add a member to the current organization (admin only).
   */
  addOrganizationMember: t.field({
    type: OrganizationMemberType,
    description:
      'Add a member to the current organization by email. Requires ADMIN role.',
    args: {
      email: t.arg.string({
        required: true,
        description: 'Email address of the user to invite.',
      }),
      role: t.arg.string({
        required: true,
        description: 'Role to assign (ADMIN, EDITOR, or READER).',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireAdmin(ctx);
      await requireScopes(ctx, 'organizations:write');
      const { email, role } = inviteMemberSchema.parse({
        email: args.email,
        role: args.role,
      });
      try {
        return await organizationService.addMemberWithAudit(
          toServiceContext(orgCtx),
          email,
          role,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /**
   * Remove a member from the current organization (admin only).
   */
  removeOrganizationMember: t.field({
    type: SuccessPayload,
    description:
      'Remove a member from the current organization. Requires ADMIN role.',
    args: {
      memberId: t.arg.string({
        required: true,
        description: 'ID of the membership record to remove.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireAdmin(ctx);
      await requireScopes(ctx, 'organizations:write');
      const { memberId } = memberIdParamSchema.parse({
        memberId: args.memberId,
      });
      try {
        return await organizationService.removeMemberWithAudit(
          toServiceContext(orgCtx),
          memberId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /**
   * Update a member's role in the current organization (admin only).
   */
  updateOrganizationMemberRole: t.field({
    type: OrganizationMemberType,
    description:
      "Change a member's role in the current organization. Requires ADMIN role.",
    args: {
      memberId: t.arg.string({
        required: true,
        description: 'ID of the membership record to update.',
      }),
      role: t.arg.string({
        required: true,
        description: 'New role (ADMIN, EDITOR, or READER).',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireAdmin(ctx);
      await requireScopes(ctx, 'organizations:write');
      const { memberId, role } = updateMemberRoleSchema.parse({
        memberId: args.memberId,
        role: args.role,
      });
      try {
        return await organizationService.updateMemberRoleWithAudit(
          toServiceContext(orgCtx),
          memberId,
          role,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),
}));
