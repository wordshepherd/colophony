import { z } from 'zod';
import {
  rightsAgreementSchema,
  rightsAgreementListItemSchema,
  createRightsAgreementSchema,
  updateRightsAgreementSchema,
  listRightsAgreementsSchema,
  transitionRightsAgreementStatusSchema,
  idParamSchema,
  paginatedResponseSchema,
} from '@colophony/types';
import { businessOpsProcedure, createRouter, requireScopes } from '../init.js';
import { rightsAgreementService } from '../../services/rights-agreement.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';

export const rightsAgreementsRouter = createRouter({
  /** List rights agreements for the current org (with joined names). */
  list: businessOpsProcedure
    .use(requireScopes('rights:read'))
    .input(listRightsAgreementsSchema)
    .output(paginatedResponseSchema(rightsAgreementListItemSchema))
    .query(async ({ ctx, input }) => {
      return rightsAgreementService.list(
        ctx.dbTx,
        input,
        ctx.authContext.orgId,
      );
    }),

  /** Get a rights agreement by ID. */
  getById: businessOpsProcedure
    .use(requireScopes('rights:read'))
    .input(idParamSchema)
    .output(rightsAgreementSchema)
    .query(async ({ ctx, input }) => {
      try {
        const agreement = await rightsAgreementService.getById(
          ctx.dbTx,
          input.id,
          ctx.authContext.orgId,
        );
        if (!agreement) {
          const { RightsAgreementNotFoundError } =
            await import('../../services/rights-agreement.service.js');
          throw new RightsAgreementNotFoundError(input.id);
        }
        return agreement;
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Get active agreements with upcoming reversion dates. */
  upcomingReversions: businessOpsProcedure
    .use(requireScopes('rights:read'))
    .input(
      z.object({
        withinDays: z.number().int().min(1).max(365).default(30),
      }),
    )
    .output(z.array(rightsAgreementSchema))
    .query(async ({ ctx, input }) => {
      return rightsAgreementService.getUpcomingReversions(
        ctx.dbTx,
        ctx.authContext.orgId,
        input.withinDays,
      );
    }),

  /** Create a new rights agreement. */
  create: businessOpsProcedure
    .use(requireScopes('rights:write'))
    .input(createRightsAgreementSchema)
    .output(rightsAgreementSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await rightsAgreementService.createWithAudit(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Update a rights agreement (metadata only, not status). */
  update: businessOpsProcedure
    .use(requireScopes('rights:write'))
    .input(updateRightsAgreementSchema)
    .output(rightsAgreementSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await rightsAgreementService.updateWithAudit(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Transition a rights agreement to a new status. */
  transitionStatus: businessOpsProcedure
    .use(requireScopes('rights:write'))
    .input(transitionRightsAgreementStatusSchema)
    .output(rightsAgreementSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await rightsAgreementService.transitionStatusWithAudit(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Delete a rights agreement. */
  delete: businessOpsProcedure
    .use(requireScopes('rights:write'))
    .input(idParamSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await rightsAgreementService.deleteWithAudit(
          toServiceContext(ctx),
          input.id,
        );
        return { success: true };
      } catch (e) {
        mapServiceError(e);
      }
    }),
});
