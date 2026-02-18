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
import { authedProcedure, orgProcedure, adminProcedure } from '../context.js';

// ---------------------------------------------------------------------------
// Path param schemas
// ---------------------------------------------------------------------------

const orgIdParam = z.object({ orgId: z.string().uuid() });
const memberIdParam = z.object({
  orgId: z.string().uuid(),
  memberId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Members routes
// ---------------------------------------------------------------------------

const membersList = orgProcedure
  .route({ method: 'GET', path: '/organizations/{orgId}/members' })
  .input(orgIdParam.merge(restPaginationQuery))
  .handler(async ({ input, context }) => {
    return organizationService.listMembers(context.dbTx, {
      page: input.page,
      limit: input.limit,
    });
  });

const membersAdd = adminProcedure
  .route({
    method: 'POST',
    path: '/organizations/{orgId}/members',
    successStatus: 201,
  })
  .input(orgIdParam.merge(inviteMemberSchema))
  .handler(async ({ input, context }) => {
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
  .route({
    method: 'DELETE',
    path: '/organizations/{orgId}/members/{memberId}',
  })
  .input(memberIdParam)
  .handler(async ({ context, input }) => {
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
  .route({
    method: 'PATCH',
    path: '/organizations/{orgId}/members/{memberId}',
  })
  .input(memberIdParam.merge(z.object({ role: roleSchema })))
  .handler(async ({ context, input }) => {
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
  .route({ method: 'GET', path: '/organizations' })
  .handler(async ({ context }) => {
    return organizationService.listUserOrganizations(
      context.authContext.userId,
    );
  });

const orgsCreate = authedProcedure
  .route({ method: 'POST', path: '/organizations', successStatus: 201 })
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
  .route({ method: 'GET', path: '/organizations/check-slug' })
  .input(checkSlugSchema)
  .handler(async ({ input }) => {
    const available = await organizationService.isSlugAvailable(input.slug);
    return { available };
  });

const orgsGet = orgProcedure
  .route({ method: 'GET', path: '/organizations/{orgId}' })
  .input(orgIdParam)
  .handler(async ({ context }) => {
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
  .route({ method: 'PATCH', path: '/organizations/{orgId}' })
  .input(orgIdParam.merge(updateOrganizationSchema))
  .handler(async ({ context, input }) => {
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
