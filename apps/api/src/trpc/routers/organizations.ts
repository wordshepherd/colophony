import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  paginationSchema,
  checkSlugSchema,
  memberIdParamSchema,
  organizationSchema,
  organizationMemberSchema,
  userOrganizationSchema,
  slugAvailabilitySchema,
  createOrganizationResponseSchema,
  organizationMemberMutationResponseSchema,
  successResponseSchema,
  paginatedResponseSchema,
  type Organization,
  type CreateOrganizationResponse,
} from '@colophony/types';
import {
  authedProcedure,
  orgProcedure,
  adminProcedure,
  createRouter,
  requireScopes,
} from '../init.js';
import { organizationService } from '../../services/organization.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';

const membersRouter = createRouter({
  list: orgProcedure
    .use(requireScopes('organizations:read'))
    .input(paginationSchema)
    .output(paginatedResponseSchema(organizationMemberSchema))
    .query(async ({ ctx, input }) => {
      return organizationService.listMembers(ctx.dbTx, input);
    }),

  add: adminProcedure
    .use(requireScopes('organizations:write'))
    .input(inviteMemberSchema)
    .output(organizationMemberMutationResponseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await organizationService.addMemberWithAudit(
          toServiceContext(ctx),
          input.email,
          input.role,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  remove: adminProcedure
    .use(requireScopes('organizations:write'))
    .input(memberIdParamSchema)
    .output(successResponseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await organizationService.removeMemberWithAudit(
          toServiceContext(ctx),
          input.memberId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  updateRole: adminProcedure
    .use(requireScopes('organizations:write'))
    .input(updateMemberRoleSchema)
    .output(organizationMemberMutationResponseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await organizationService.updateMemberRoleWithAudit(
          toServiceContext(ctx),
          input.memberId,
          input.role,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),
});

export const organizationsRouter = createRouter({
  list: authedProcedure
    .use(requireScopes('organizations:read'))
    .output(z.array(userOrganizationSchema))
    .query(async ({ ctx }) => {
      return organizationService.listUserOrganizations(ctx.authContext.userId);
    }),

  create: authedProcedure
    .use(requireScopes('organizations:write'))
    .input(createOrganizationSchema)
    .output(createOrganizationResponseSchema)
    .mutation(async ({ ctx, input }) => {
      // Pre-check is a UX optimization; the unique constraint is the real safety net.
      const available = await organizationService.isSlugAvailable(input.slug);
      if (!available) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Slug "${input.slug}" is already taken`,
        });
      }

      try {
        // Cast: Drizzle JSONB returns `settings: unknown`; .output() validates at runtime
        return (await organizationService.createWithAudit(
          ctx.audit,
          input,
          ctx.authContext.userId,
        )) as CreateOrganizationResponse;
      } catch (e) {
        mapServiceError(e);
      }
    }),

  get: orgProcedure
    .use(requireScopes('organizations:read'))
    .output(organizationSchema)
    .query(async ({ ctx }) => {
      const org = await organizationService.getById(
        ctx.dbTx,
        ctx.authContext.orgId,
      );
      if (!org) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Organization not found',
        });
      }
      // Cast: Drizzle JSONB returns `settings: unknown`; .output() validates at runtime
      return org as Organization;
    }),

  update: adminProcedure
    .use(requireScopes('organizations:write'))
    .input(updateOrganizationSchema)
    .output(organizationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Cast: Drizzle JSONB returns `settings: unknown`; .output() validates at runtime
        return (await organizationService.updateWithAudit(
          toServiceContext(ctx),
          input,
        )) as Organization;
      } catch (e) {
        mapServiceError(e);
      }
    }),

  checkSlug: authedProcedure
    .use(requireScopes('organizations:read'))
    .input(checkSlugSchema)
    .output(slugAvailabilitySchema)
    .query(async ({ input }) => {
      const available = await organizationService.isSlugAvailable(input.slug);
      return { available };
    }),

  members: membersRouter,
});
