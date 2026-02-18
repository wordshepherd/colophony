import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  paginationSchema,
  checkSlugSchema,
} from '@colophony/types';
import {
  authedProcedure,
  orgProcedure,
  adminProcedure,
  createRouter,
} from '../init.js';
import { organizationService } from '../../services/organization.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';

const membersRouter = createRouter({
  list: orgProcedure.input(paginationSchema).query(async ({ ctx, input }) => {
    return organizationService.listMembers(ctx.dbTx, input);
  }),

  add: adminProcedure
    .input(inviteMemberSchema)
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
    .input(z.object({ memberId: z.string().uuid() }))
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
    .input(updateMemberRoleSchema)
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
  list: authedProcedure.query(async ({ ctx }) => {
    return organizationService.listUserOrganizations(ctx.authContext.userId);
  }),

  create: authedProcedure
    .input(createOrganizationSchema)
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
        return await organizationService.createWithAudit(
          ctx.audit,
          input,
          ctx.authContext.userId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  get: orgProcedure.query(async ({ ctx }) => {
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
    return org;
  }),

  update: adminProcedure
    .input(updateOrganizationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await organizationService.updateWithAudit(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  checkSlug: authedProcedure.input(checkSlugSchema).query(async ({ input }) => {
    const available = await organizationService.isSlugAvailable(input.slug);
    return { available };
  }),

  members: membersRouter,
});
