import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  paginationSchema,
  AuditActions,
  AuditResources,
} from '@prospector/types';
import {
  authedProcedure,
  orgProcedure,
  adminProcedure,
  createRouter,
} from '../init.js';
import {
  organizationService,
  UserNotFoundError,
  LastAdminError,
} from '../../services/organization.service.js';

const membersRouter = createRouter({
  list: orgProcedure.input(paginationSchema).query(async ({ ctx, input }) => {
    return organizationService.listMembers(ctx.dbTx, input);
  }),

  add: adminProcedure
    .input(inviteMemberSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const member = await organizationService.addMember(
          ctx.dbTx,
          ctx.authContext.orgId,
          input.email,
          input.role,
        );
        await ctx.audit({
          action: AuditActions.ORG_MEMBER_ADDED,
          resource: AuditResources.ORGANIZATION,
          resourceId: member.id,
          newValue: { email: input.email, role: input.role },
        });
        return member;
      } catch (e) {
        if (e instanceof UserNotFoundError) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: e.message,
          });
        }
        throw e;
      }
    }),

  remove: adminProcedure
    .input(z.object({ memberId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const deleted = await organizationService.removeMember(
          ctx.dbTx,
          input.memberId,
        );
        if (!deleted) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Member not found',
          });
        }
        await ctx.audit({
          action: AuditActions.ORG_MEMBER_REMOVED,
          resource: AuditResources.ORGANIZATION,
          resourceId: deleted.id,
          oldValue: { userId: deleted.userId, role: deleted.role },
        });
        return { success: true };
      } catch (e) {
        if (e instanceof LastAdminError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: e.message,
          });
        }
        throw e;
      }
    }),

  updateRole: adminProcedure
    .input(updateMemberRoleSchema)
    .mutation(async ({ ctx, input }) => {
      const updated = await organizationService.updateMemberRole(
        ctx.dbTx,
        input.memberId,
        input.role,
      );
      if (!updated) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Member not found',
        });
      }
      await ctx.audit({
        action: AuditActions.ORG_MEMBER_ROLE_CHANGED,
        resource: AuditResources.ORGANIZATION,
        resourceId: updated.id,
        newValue: { role: input.role },
      });
      return updated;
    }),
});

export const organizationsRouter = createRouter({
  list: authedProcedure.query(async ({ ctx }) => {
    return organizationService.listUserOrganizations(ctx.authContext.userId);
  }),

  create: authedProcedure
    .input(createOrganizationSchema)
    .mutation(async ({ ctx, input }) => {
      const available = await organizationService.isSlugAvailable(input.slug);
      if (!available) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Slug "${input.slug}" is already taken`,
        });
      }
      const result = await organizationService.create(
        input,
        ctx.authContext.userId,
      );
      // Audit with null org context (org didn't exist when hooks ran).
      // The audit INSERT policy allows organization_id IS NULL.
      await ctx.audit({
        action: AuditActions.ORG_CREATED,
        resource: AuditResources.ORGANIZATION,
        resourceId: result.organization.id,
        newValue: { name: input.name, slug: input.slug },
      });
      return result;
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
      const old = await organizationService.getById(
        ctx.dbTx,
        ctx.authContext.orgId,
      );
      const updated = await organizationService.update(
        ctx.dbTx,
        ctx.authContext.orgId,
        input,
      );
      if (!updated) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Organization not found',
        });
      }
      await ctx.audit({
        action: AuditActions.ORG_UPDATED,
        resource: AuditResources.ORGANIZATION,
        resourceId: updated.id,
        oldValue: old ? { name: old.name, settings: old.settings } : undefined,
        newValue: input,
      });
      return updated;
    }),

  checkSlug: authedProcedure
    .input(z.object({ slug: z.string().min(3).max(63) }))
    .query(async ({ input }) => {
      const available = await organizationService.isSlugAvailable(input.slug);
      return { available };
    }),

  members: membersRouter,
});
