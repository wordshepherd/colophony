import {
  createSubmissionPeriodSchema,
  updateSubmissionPeriodSchema,
  listSubmissionPeriodsSchema,
  submissionPeriodSchema,
  idParamSchema,
  successResponseSchema,
  paginatedResponseSchema,
} from '@colophony/types';
import { orgProcedure, createRouter, requireScopes } from '../init.js';
import { periodService } from '../../services/period.service.js';
import { PeriodNotFoundError } from '../../services/period.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';

export const periodsRouter = createRouter({
  /** List submission periods in the org. */
  list: orgProcedure
    .use(requireScopes('periods:read'))
    .input(listSubmissionPeriodsSchema)
    .output(paginatedResponseSchema(submissionPeriodSchema))
    .query(async ({ ctx, input }) => {
      return periodService.list(ctx.dbTx, input);
    }),

  /** Get submission period by ID. */
  getById: orgProcedure
    .use(requireScopes('periods:read'))
    .input(idParamSchema)
    .output(submissionPeriodSchema)
    .query(async ({ ctx, input }) => {
      try {
        const period = await periodService.getById(ctx.dbTx, input.id);
        if (!period) throw new PeriodNotFoundError(input.id);
        return period;
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Create a new submission period. */
  create: orgProcedure
    .use(requireScopes('periods:write'))
    .input(createSubmissionPeriodSchema)
    .output(submissionPeriodSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await periodService.createWithAudit(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Update a submission period. */
  update: orgProcedure
    .use(requireScopes('periods:write'))
    .input(idParamSchema.merge(updateSubmissionPeriodSchema))
    .output(submissionPeriodSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      try {
        return await periodService.updateWithAudit(
          toServiceContext(ctx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Delete a submission period. */
  delete: orgProcedure
    .use(requireScopes('periods:write'))
    .input(idParamSchema)
    .output(successResponseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await periodService.deleteWithAudit(
          toServiceContext(ctx),
          input.id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),
});
