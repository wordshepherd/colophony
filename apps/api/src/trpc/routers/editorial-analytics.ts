import {
  editorialAnalyticsFilterSchema,
  acceptanceByGenreSchema,
  acceptanceByPeriodSchema,
  responseTimeStatsSchema,
  pipelineHealthSchema,
  genreDistributionSchema,
  contributorDiversitySchema,
  readerAlignmentSchema,
} from '@colophony/types';
import { editorProcedure, createRouter, requireScopes } from '../init.js';
import { editorialAnalyticsService } from '../../services/editorial-analytics.service.js';
import { mapServiceError } from '../error-mapper.js';

export const editorialAnalyticsRouter = createRouter({
  /** Acceptance rate broken down by primary genre. */
  acceptanceByGenre: editorProcedure
    .use(requireScopes('submissions:read'))
    .input(editorialAnalyticsFilterSchema)
    .output(acceptanceByGenreSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await editorialAnalyticsService.getAcceptanceByGenre(
          ctx.dbTx,
          ctx.authContext.orgId,
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Acceptance rate broken down by submission period. */
  acceptanceByPeriod: editorProcedure
    .use(requireScopes('submissions:read'))
    .input(editorialAnalyticsFilterSchema)
    .output(acceptanceByPeriodSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await editorialAnalyticsService.getAcceptanceByPeriod(
          ctx.dbTx,
          ctx.authContext.orgId,
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Response time stats: avg, median, p90, monthly trend. */
  responseTimeStats: editorProcedure
    .use(requireScopes('submissions:read'))
    .input(editorialAnalyticsFilterSchema)
    .output(responseTimeStatsSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await editorialAnalyticsService.getResponseTimeStats(
          ctx.dbTx,
          ctx.authContext.orgId,
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Pipeline health: items per stage, avg days, stuck count. */
  pipelineHealth: editorProcedure
    .use(requireScopes('submissions:read'))
    .input(editorialAnalyticsFilterSchema)
    .output(pipelineHealthSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await editorialAnalyticsService.getPipelineHealth(
          ctx.dbTx,
          ctx.authContext.orgId,
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Genre distribution of non-draft submissions. */
  genreDistribution: editorProcedure
    .use(requireScopes('submissions:read'))
    .input(editorialAnalyticsFilterSchema)
    .output(genreDistributionSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await editorialAnalyticsService.getGenreDistribution(
          ctx.dbTx,
          ctx.authContext.orgId,
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** New vs returning submitters per period + genre spread. */
  contributorDiversity: editorProcedure
    .use(requireScopes('submissions:read'))
    .input(editorialAnalyticsFilterSchema)
    .output(contributorDiversitySchema)
    .query(async ({ ctx, input }) => {
      try {
        return await editorialAnalyticsService.getContributorDiversity(
          ctx.dbTx,
          ctx.authContext.orgId,
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Reader alignment: vote consensus rate vs final decisions. */
  readerAlignment: editorProcedure
    .use(requireScopes('submissions:read'))
    .input(editorialAnalyticsFilterSchema)
    .output(readerAlignmentSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await editorialAnalyticsService.getReaderAlignment(
          ctx.dbTx,
          ctx.authContext.orgId,
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),
});
