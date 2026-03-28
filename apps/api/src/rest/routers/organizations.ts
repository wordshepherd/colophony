import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  checkSlugSchema,
  inviteMemberSchema,
  rolesSchema,
  organizationMemberSchema,
  userOrganizationSchema,
  organizationMemberMutationResponseSchema,
  inviteOrAddResultSchema,
  organizationInvitationSchema,
  acceptInvitationSchema,
  acceptInvitationResultSchema,
  paginatedResponseSchema,
  successResponseSchema,
  type Role,
} from '@colophony/types';
import { restPaginationQuery } from '@colophony/api-contracts';
import { organizationService } from '../../services/organization.service.js';
import { invitationService } from '../../services/invitation.service.js';
import {
  gdprService,
  OrgNotDeletableError,
} from '../../services/gdpr.service.js';
import { validateEnv } from '../../config/env.js';
import {
  toServiceContext,
  toUserServiceContext,
} from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';
import {
  authedProcedure,
  orgProcedure,
  adminProcedure,
  userProcedure,
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
const invitationIdParam = z.object({
  orgId: z.string().uuid(),
  invitationId: z.string().uuid(),
});

/**
 * Enforce that the orgId path parameter matches the org context from the
 * X-Organization-Id header. Prevents URL/resource mismatch where a client
 * could request /organizations/{A} but operate on organization B.
 */
// ---------------------------------------------------------------------------
// Output schemas
// ---------------------------------------------------------------------------

const checkSlugResponseSchema = z.object({ available: z.boolean() });

// Drizzle returns settings as `unknown` and includes extra columns like
// federationOptedOut — use passthrough to accept the actual DB shape.
const organizationOutputSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    settings: z.unknown(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .passthrough();

const createOrgOutputSchema = z.object({
  organization: organizationOutputSchema,
  membership: z
    .object({
      id: z.string().uuid(),
      organizationId: z.string().uuid(),
      userId: z.string().uuid(),
      roles: rolesSchema,
      createdAt: z.date(),
      updatedAt: z.date(),
    })
    .passthrough(),
});

const paginatedMembersSchema = paginatedResponseSchema(
  organizationMemberSchema,
);

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
  .output(paginatedMembersSchema)
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
    summary: 'Add or invite a member',
    description:
      'Add a user to the organization by email. If the user does not have an account, sends an invitation email. Requires ADMIN role.',
    operationId: 'addOrganizationMember',
    tags: ['Organizations'],
  })
  .input(orgIdParam.merge(inviteMemberSchema))
  .output(inviteOrAddResultSchema)
  .handler(async ({ input, context }) => {
    assertOrgIdMatch(input.orgId, context.authContext.orgId);
    const env = validateEnv();
    try {
      return await organizationService.inviteOrAddMemberWithAudit(
        toServiceContext(context),
        env,
        input.email,
        input.roles,
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
  .output(successResponseSchema)
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

const membersUpdateRoles = adminProcedure
  .use(requireScopes('organizations:write'))
  .route({
    method: 'PATCH',
    path: '/organizations/{orgId}/members/{memberId}',
    summary: 'Update member roles',
    description:
      "Change a member's roles within the organization. Requires ADMIN role.",
    operationId: 'updateOrganizationMemberRoles',
    tags: ['Organizations'],
  })
  .input(memberIdParam.merge(z.object({ roles: rolesSchema })))
  .output(organizationMemberMutationResponseSchema)
  .handler(async ({ context, input }) => {
    assertOrgIdMatch(input.orgId, context.authContext.orgId);
    try {
      return await organizationService.updateMemberRolesWithAudit(
        toServiceContext(context),
        input.memberId,
        input.roles,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

// ---------------------------------------------------------------------------
// Invitation routes
// ---------------------------------------------------------------------------

const invitationsList = adminProcedure
  .use(requireScopes('organizations:read'))
  .route({
    method: 'GET',
    path: '/organizations/{orgId}/invitations',
    summary: 'List pending invitations',
    description:
      'Returns pending invitations for the specified organization. Requires ADMIN role.',
    operationId: 'listOrganizationInvitations',
    tags: ['Invitations'],
  })
  .input(orgIdParam)
  .output(z.array(organizationInvitationSchema))
  .handler(async ({ input, context }) => {
    assertOrgIdMatch(input.orgId, context.authContext.orgId);
    const items = await invitationService.listPending(
      context.dbTx,
      context.authContext.orgId,
    );
    return items.map(({ inviterEmail: _, ...rest }) => ({
      ...rest,
      roles: rest.roles as typeof rest.roles & Role[],
    }));
  });

const invitationsRevoke = adminProcedure
  .use(requireScopes('organizations:write'))
  .route({
    method: 'DELETE',
    path: '/organizations/{orgId}/invitations/{invitationId}',
    summary: 'Revoke an invitation',
    description: 'Revoke a pending invitation. Requires ADMIN role.',
    operationId: 'revokeOrganizationInvitation',
    tags: ['Invitations'],
  })
  .input(invitationIdParam)
  .output(successResponseSchema)
  .handler(async ({ input, context }) => {
    assertOrgIdMatch(input.orgId, context.authContext.orgId);
    try {
      await invitationService.revokeWithAudit(
        toServiceContext(context),
        input.invitationId,
      );
      return { success: true as const };
    } catch (e) {
      mapServiceError(e);
    }
  });

const invitationsResend = adminProcedure
  .use(requireScopes('organizations:write'))
  .route({
    method: 'POST',
    path: '/organizations/{orgId}/invitations/{invitationId}/resend',
    summary: 'Resend an invitation',
    description:
      'Revoke the existing invitation and send a new one with a fresh token and expiry. Requires ADMIN role.',
    operationId: 'resendOrganizationInvitation',
    tags: ['Invitations'],
  })
  .input(invitationIdParam)
  .output(organizationInvitationSchema)
  .handler(async ({ input, context }) => {
    assertOrgIdMatch(input.orgId, context.authContext.orgId);
    const env = validateEnv();
    try {
      return await invitationService.resendWithAudit(
        toServiceContext(context),
        input.invitationId,
        env,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const invitationsAccept = userProcedure
  .route({
    method: 'POST',
    path: '/invitations/accept',
    summary: 'Accept an invitation',
    description:
      'Accept a pending invitation using the token from the invitation email. Adds the authenticated user as a member of the inviting organization.',
    operationId: 'acceptInvitation',
    tags: ['Invitations'],
  })
  .input(acceptInvitationSchema)
  .output(acceptInvitationResultSchema)
  .handler(async ({ input, context }) => {
    try {
      return await invitationService.acceptWithAudit(
        toUserServiceContext(context),
        input.token,
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
  .output(z.array(userOrganizationSchema))
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
  .output(createOrgOutputSchema)
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
  .output(checkSlugResponseSchema)
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
  .output(organizationOutputSchema)
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
  .output(organizationOutputSchema)
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

const orgsDelete = adminProcedure
  .use(requireScopes('organizations:write'))
  .route({
    method: 'DELETE',
    path: '/organizations/{orgId}',
    summary: 'Delete an organization',
    description:
      'Permanently delete an organization and all its data. Requires ADMIN role. This action cannot be undone.',
    operationId: 'deleteOrganization',
    tags: ['Organizations'],
  })
  .input(orgIdParam)
  .output(successResponseSchema)
  .handler(async ({ input, context }) => {
    assertOrgIdMatch(input.orgId, context.authContext.orgId);
    const env = validateEnv();
    try {
      await gdprService.deleteOrganization(
        context.authContext.orgId,
        context.authContext.userId,
        env,
      );
      return { success: true };
    } catch (e) {
      if (e instanceof OrgNotDeletableError) {
        throw new ORPCError('FORBIDDEN', { message: e.message });
      }
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
  delete: orgsDelete,
  members: {
    list: membersList,
    add: membersAdd,
    remove: membersRemove,
    updateRoles: membersUpdateRoles,
  },
  invitations: {
    list: invitationsList,
    revoke: invitationsRevoke,
    resend: invitationsResend,
    accept: invitationsAccept,
  },
};
