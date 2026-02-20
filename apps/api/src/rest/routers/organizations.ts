import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  checkSlugSchema,
  inviteMemberSchema,
  roleSchema,
} from '@colophony/types';
import { restPaginationQuery } from '@colophony/api-contracts';
import { organizationService } from '../../services/organization.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';
import {
  authedProcedure,
  orgProcedure,
  adminProcedure,
  requireScopes,
} from '../context.js';

// ---------------------------------------------------------------------------
// Path param schemas
// ---------------------------------------------------------------------------

const orgIdParam = z.object({ orgId: z.string().uuid() });
const memberIdParam = z.object({
  orgId: z.string().uuid(),
  memberId: z.string().uuid(),
});

/**
 * Enforce that the orgId path parameter matches the org context from the
 * X-Organization-Id header. Prevents URL/resource mismatch where a client
 * could request /organizations/{A} but operate on organization B.
 */
function assertOrgIdMatch(pathOrgId: string, contextOrgId: string): void {
  if (pathOrgId !== contextOrgId) {
    throw new ORPCError('BAD_REQUEST', {
      message:
        'Path orgId does not match X-Organization-Id header. Ensure the URL and header reference the same organization.',
    });
  }
}

// ---------------------------------------------------------------------------
// Members routes
// ---------------------------------------------------------------------------

const membersList = orgProcedure
  .use(requireScopes('organizations:read'))
  .route({
    method: 'GET',
    path: '/organizations/{orgId}/members',
    summary: 'List organization members',
    description:
      'Returns a paginated list of members for the specified organization.',
    operationId: 'listOrganizationMembers',
    tags: ['Organizations'],
  })
  .input(orgIdParam.merge(restPaginationQuery))
  .handler(async ({ input, context }) => {
    assertOrgIdMatch(input.orgId, context.authContext.orgId);
    return organizationService.listMembers(context.dbTx, {
      page: input.page,
      limit: input.limit,
    });
  });

const membersAdd = adminProcedure
  .use(requireScopes('organizations:write'))
  .route({
    method: 'POST',
    path: '/organizations/{orgId}/members',
    successStatus: 201,
    summary: 'Add a member',
    description:
      'Invite a user to the organization by email. The user must already have an account. Requires ADMIN role.',
    operationId: 'addOrganizationMember',
    tags: ['Organizations'],
  })
  .input(orgIdParam.merge(inviteMemberSchema))
  .handler(async ({ input, context }) => {
    assertOrgIdMatch(input.orgId, context.authContext.orgId);
    try {
      return await organizationService.addMemberWithAudit(
        toServiceContext(context),
        input.email,
        input.role,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const membersRemove = adminProcedure
  .use(requireScopes('organizations:write'))
  .route({
    method: 'DELETE',
    path: '/organizations/{orgId}/members/{memberId}',
    summary: 'Remove a member',
    description: 'Remove a member from the organization. Requires ADMIN role.',
    operationId: 'removeOrganizationMember',
    tags: ['Organizations'],
  })
  .input(memberIdParam)
  .handler(async ({ context, input }) => {
    assertOrgIdMatch(input.orgId, context.authContext.orgId);
    try {
      return await organizationService.removeMemberWithAudit(
        toServiceContext(context),
        input.memberId,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const membersUpdateRole = adminProcedure
  .use(requireScopes('organizations:write'))
  .route({
    method: 'PATCH',
    path: '/organizations/{orgId}/members/{memberId}',
    summary: 'Update member role',
    description:
      "Change a member's role within the organization. Requires ADMIN role.",
    operationId: 'updateOrganizationMemberRole',
    tags: ['Organizations'],
  })
  .input(memberIdParam.merge(z.object({ role: roleSchema })))
  .handler(async ({ context, input }) => {
    assertOrgIdMatch(input.orgId, context.authContext.orgId);
    try {
      return await organizationService.updateMemberRoleWithAudit(
        toServiceContext(context),
        input.memberId,
        input.role,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

// ---------------------------------------------------------------------------
// Organization routes
// ---------------------------------------------------------------------------

const orgsList = authedProcedure
  .use(requireScopes('organizations:read'))
  .route({
    method: 'GET',
    path: '/organizations',
    summary: 'List organizations',
    description:
      'Returns all organizations the authenticated user is a member of.',
    operationId: 'listOrganizations',
    tags: ['Organizations'],
  })
  .handler(async ({ context }) => {
    return organizationService.listUserOrganizations(
      context.authContext.userId,
    );
  });

const orgsCreate = authedProcedure
  .use(requireScopes('organizations:write'))
  .route({
    method: 'POST',
    path: '/organizations',
    successStatus: 201,
    summary: 'Create an organization',
    description:
      'Create a new organization. The authenticated user becomes the first ADMIN member.',
    operationId: 'createOrganization',
    tags: ['Organizations'],
  })
  .input(createOrganizationSchema)
  .handler(async ({ context, input }) => {
    const available = await organizationService.isSlugAvailable(input.slug);
    if (!available) {
      throw new ORPCError('CONFLICT', {
        message: `Slug "${input.slug}" is already taken`,
        status: 409,
      });
    }
    try {
      return await organizationService.createWithAudit(
        context.audit,
        input,
        context.authContext.userId,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const orgsCheckSlug = authedProcedure
  .use(requireScopes('organizations:read'))
  .route({
    method: 'GET',
    path: '/organizations/check-slug',
    summary: 'Check slug availability',
    description:
      'Check whether a slug is available for use when creating an organization.',
    operationId: 'checkSlugAvailability',
    tags: ['Organizations'],
  })
  .input(checkSlugSchema)
  .handler(async ({ input }) => {
    const available = await organizationService.isSlugAvailable(input.slug);
    return { available };
  });

const orgsGet = orgProcedure
  .use(requireScopes('organizations:read'))
  .route({
    method: 'GET',
    path: '/organizations/{orgId}',
    summary: 'Get an organization',
    description: 'Retrieve a single organization by its ID.',
    operationId: 'getOrganization',
    tags: ['Organizations'],
  })
  .input(orgIdParam)
  .handler(async ({ input, context }) => {
    assertOrgIdMatch(input.orgId, context.authContext.orgId);
    const org = await organizationService.getById(
      context.dbTx,
      context.authContext.orgId,
    );
    if (!org) {
      throw new ORPCError('NOT_FOUND', { message: 'Organization not found' });
    }
    return org;
  });

const orgsUpdate = adminProcedure
  .use(requireScopes('organizations:write'))
  .route({
    method: 'PATCH',
    path: '/organizations/{orgId}',
    summary: 'Update an organization',
    description:
      "Update an organization's name or settings. Requires ADMIN role.",
    operationId: 'updateOrganization',
    tags: ['Organizations'],
  })
  .input(orgIdParam.merge(updateOrganizationSchema))
  .handler(async ({ context, input }) => {
    assertOrgIdMatch(input.orgId, context.authContext.orgId);
    try {
      return await organizationService.updateWithAudit(
        toServiceContext(context),
        { name: input.name, settings: input.settings },
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

// ---------------------------------------------------------------------------
// Assembled router
// ---------------------------------------------------------------------------

export const organizationsRouter = {
  list: orgsList,
  create: orgsCreate,
  checkSlug: orgsCheckSlug,
  get: orgsGet,
  update: orgsUpdate,
  members: {
    list: membersList,
    add: membersAdd,
    remove: membersRemove,
    updateRole: membersUpdateRole,
  },
};
