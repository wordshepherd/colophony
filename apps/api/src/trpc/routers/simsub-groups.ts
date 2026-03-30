import { z } from 'zod';
import {
  createSimsubGroupSchema,
  updateSimsubGroupSchema,
  addSimsubGroupSubmissionSchema,
  removeSimsubGroupSubmissionSchema,
  listSimsubGroupsSchema,
  availableSimsubSubmissionsSchema,
} from '@colophony/types';
import { createRouter, userProcedure, requireScopes } from '../init.js';
import { toUserServiceContext } from '../../services/context.js';
import {
  simsubGroupService,
  SimsubGroupNotFoundError,
} from '../../services/simsub-group.service.js';
import { mapServiceError } from '../error-mapper.js';

export const simsubGroupsRouter = createRouter({
  list: userProcedure
    .use(requireScopes('simsub-groups:read'))
    .input(listSimsubGroupsSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await simsubGroupService.list(
          ctx.dbTx,
          ctx.authContext.userId,
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  getById: userProcedure
    .use(requireScopes('simsub-groups:read'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const detail = await simsubGroupService.getDetail(ctx.dbTx, input.id);
        if (!detail) throw new SimsubGroupNotFoundError(input.id);
        return detail;
      } catch (e) {
        mapServiceError(e);
      }
    }),

  create: userProcedure
    .use(requireScopes('simsub-groups:write'))
    .input(createSimsubGroupSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await simsubGroupService.createWithAudit(
          toUserServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  update: userProcedure
    .use(requireScopes('simsub-groups:write'))
    .input(updateSimsubGroupSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await simsubGroupService.updateWithAudit(
          toUserServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  delete: userProcedure
    .use(requireScopes('simsub-groups:write'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await simsubGroupService.deleteWithAudit(
          toUserServiceContext(ctx),
          input.id,
        );
        return { success: true as const };
      } catch (e) {
        mapServiceError(e);
      }
    }),

  addSubmission: userProcedure
    .use(requireScopes('simsub-groups:write'))
    .input(addSimsubGroupSubmissionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await simsubGroupService.addSubmissionWithAudit(
          toUserServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  removeSubmission: userProcedure
    .use(requireScopes('simsub-groups:write'))
    .input(removeSimsubGroupSubmissionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await simsubGroupService.removeSubmissionWithAudit(
          toUserServiceContext(ctx),
          input,
        );
        return { success: true as const };
      } catch (e) {
        mapServiceError(e);
      }
    }),

  availableSubmissions: userProcedure
    .use(requireScopes('simsub-groups:read'))
    .input(availableSimsubSubmissionsSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await simsubGroupService.availableSubmissions(
          toUserServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  availableExternalSubmissions: userProcedure
    .use(requireScopes('simsub-groups:read'))
    .input(availableSimsubSubmissionsSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await simsubGroupService.availableExternalSubmissions(
          toUserServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),
});
