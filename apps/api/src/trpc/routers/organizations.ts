import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  inviteMemberSchema,
  updateMemberRolesSchema,
  paginationSchema,
  checkSlugSchema,
  memberIdParamSchema,
  organizationSchema,
  organizationMemberSchema,
  organizationInvitationSchema,
  userOrganizationSchema,
  slugAvailabilitySchema,
  createOrganizationResponseSchema,
  inviteOrAddResultSchema,
  acceptInvitationSchema,
  acceptInvitationResultSchema,
  organizationMemberMutationResponseSchema,
  successResponseSchema,
  paginatedResponseSchema,
  type Organization,
  type CreateOrganizationResponse,
  type Role,
} from '@colophony/types';
import {
  authedProcedure,
  orgProcedure,
  adminProcedure,
  userProcedure,
  createRouter,
  requireScopes,
} from '../init.js';
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
    .output(inviteOrAddResultSchema)
    .mutation(async ({ ctx, input }) => {
      const env = validateEnv();
      try {
        return await organizationService.inviteOrAddMemberWithAudit(
          toServiceContext(ctx),
          env,
          input.email,
          input.roles,
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

  updateRoles: adminProcedure
    .use(requireScopes('organizations:write'))
    .input(updateMemberRolesSchema)
    .output(organizationMemberMutationResponseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await organizationService.updateMemberRolesWithAudit(
          toServiceContext(ctx),
          input.memberId,
          input.roles,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),
});

const invitationsRouter = createRouter({
  list: adminProcedure
    .use(requireScopes('organizations:read'))
    .output(z.array(organizationInvitationSchema))
    .query(async ({ ctx }) => {
      const items = await invitationService.listPending(
        ctx.dbTx,
        ctx.authContext.orgId,
      );
      // Strip inviterEmail (not in output schema) and cast roles
      return items.map(({ inviterEmail: _, ...rest }) => ({
        ...rest,
        roles: rest.roles as typeof rest.roles & Role[],
      }));
    }),

  revoke: adminProcedure
    .use(requireScopes('organizations:write'))
    .input(z.object({ invitationId: z.string().uuid() }))
    .output(successResponseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await invitationService.revokeWithAudit(
          toServiceContext(ctx),
          input.invitationId,
        );
        return { success: true as const };
      } catch (e) {
        mapServiceError(e);
      }
    }),

  resend: adminProcedure
    .use(requireScopes('organizations:write'))
    .input(z.object({ invitationId: z.string().uuid() }))
    .output(organizationInvitationSchema)
    .mutation(async ({ ctx, input }) => {
      const env = validateEnv();
      try {
        const invitation = await invitationService.resendWithAudit(
          toServiceContext(ctx),
          input.invitationId,
          env,
        );
        return invitation;
      } catch (e) {
        mapServiceError(e);
      }
    }),

  accept: userProcedure
    .input(acceptInvitationSchema)
    .output(acceptInvitationResultSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await invitationService.acceptWithAudit(
          toUserServiceContext(ctx),
          input.token,
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

  delete: adminProcedure
    .use(requireScopes('organizations:write'))
    .output(successResponseSchema)
    .mutation(async ({ ctx }) => {
      const env = validateEnv();
      try {
        await gdprService.deleteOrganization(
          ctx.authContext.orgId,
          ctx.authContext.userId,
          env,
        );
        return { success: true as const };
      } catch (err) {
        if (err instanceof OrgNotDeletableError) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: err.message,
          });
        }
        throw err;
      }
    }),

  members: membersRouter,
  invitations: invitationsRouter,
});
