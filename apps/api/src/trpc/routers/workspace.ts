import { createRouter, userProcedure, requireScopes } from '../init.js';
import { workspaceStatsService } from '../../services/workspace-stats.service.js';
import { portfolioService } from '../../services/portfolio.service.js';
import { writerAnalyticsService } from '../../services/writer-analytics.service.js';
import { mapServiceError } from '../error-mapper.js';
import {
  listPortfolioSchema,
  writerAnalyticsFilterSchema,
  writerTimeSeriesFilterSchema,
} from '@colophony/types';

export const workspaceRouter = createRouter({
  stats: userProcedure
    .use(requireScopes('external-submissions:read'))
    .query(async ({ ctx }) => {
      try {
        return await workspaceStatsService.getStats(
          ctx.dbTx,
          ctx.authContext.userId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  portfolio: userProcedure
    .use(requireScopes('external-submissions:read'))
    .input(listPortfolioSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await portfolioService.list(
          ctx.dbTx,
          ctx.authContext.userId,
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  analyticsOverview: userProcedure
    .use(requireScopes('external-submissions:read'))
    .input(writerAnalyticsFilterSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await writerAnalyticsService.getOverview(
          ctx.dbTx,
          ctx.authContext.userId,
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  analyticsStatusBreakdown: userProcedure
    .use(requireScopes('external-submissions:read'))
    .input(writerAnalyticsFilterSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await writerAnalyticsService.getStatusBreakdown(
          ctx.dbTx,
          ctx.authContext.userId,
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  analyticsTimeSeries: userProcedure
    .use(requireScopes('external-submissions:read'))
    .input(writerTimeSeriesFilterSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await writerAnalyticsService.getTimeSeries(
          ctx.dbTx,
          ctx.authContext.userId,
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  analyticsResponseTime: userProcedure
    .use(requireScopes('external-submissions:read'))
    .input(writerAnalyticsFilterSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await writerAnalyticsService.getResponseTime(
          ctx.dbTx,
          ctx.authContext.userId,
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),
});
