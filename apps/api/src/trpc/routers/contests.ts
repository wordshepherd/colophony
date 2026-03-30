import { z } from 'zod';
import {
  contestGroupSchema,
  createContestGroupSchema,
  updateContestGroupSchema,
  listContestGroupsSchema,
  contestJudgeSchema,
  assignContestJudgeSchema,
  updateContestJudgeSchema,
  listContestJudgesSchema,
  contestResultSchema,
  createContestResultSchema,
  updateContestResultSchema,
  listContestResultsSchema,
  contestLeaderboardEntrySchema,
  contestLeaderboardSchema,
  announceWinnersSchema,
  disbursePrizeSchema,
  idParamSchema,
  successResponseSchema,
  paginatedResponseSchema,
  submissionPeriodSchema,
  paymentTransactionSchema,
} from '@colophony/types';
import {
  editorProcedure,
  orgProcedure,
  businessOpsProcedure,
  createRouter,
  requireScopes,
} from '../init.js';
import { contestService } from '../../services/contest.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';

export const contestsRouter = createRouter({
  // =========================================================================
  // Contest Groups
  // =========================================================================

  listGroups: editorProcedure
    .use(requireScopes('contests:read'))
    .input(listContestGroupsSchema)
    .output(paginatedResponseSchema(contestGroupSchema))
    .query(async ({ ctx, input }) => {
      return contestService.listGroups(ctx.dbTx, ctx.authContext.orgId, input);
    }),

  getGroup: editorProcedure
    .use(requireScopes('contests:read'))
    .input(idParamSchema)
    .output(contestGroupSchema.nullable())
    .query(async ({ ctx, input }) => {
      return contestService.getGroupById(
        ctx.dbTx,
        input.id,
        ctx.authContext.orgId,
      );
    }),

  createGroup: editorProcedure
    .use(requireScopes('contests:write'))
    .input(createContestGroupSchema)
    .output(contestGroupSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await contestService.createGroupWithAudit(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  updateGroup: editorProcedure
    .use(requireScopes('contests:write'))
    .input(idParamSchema.merge(updateContestGroupSchema))
    .output(contestGroupSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      try {
        return await contestService.updateGroupWithAudit(
          toServiceContext(ctx),
          id,
          rest,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  deleteGroup: editorProcedure
    .use(requireScopes('contests:write'))
    .input(idParamSchema)
    .output(successResponseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await contestService.deleteGroupWithAudit(
          toServiceContext(ctx),
          input.id,
        );
        return { success: true as const };
      } catch (e) {
        mapServiceError(e);
      }
    }),

  listGroupRounds: editorProcedure
    .use(requireScopes('contests:read'))
    .input(idParamSchema)
    .output(z.array(submissionPeriodSchema))
    .query(async ({ ctx, input }) => {
      const rows = await contestService.listGroupRounds(
        ctx.dbTx,
        input.id,
        ctx.authContext.orgId,
      );
      // Coerce fee from string to number (numeric column) and
      // cast JSONB fields to match Zod schema types
      return rows.map((r) => ({
        ...r,
        fee: r.fee != null ? Number(r.fee) : null,
      })) as z.infer<typeof submissionPeriodSchema>[];
    }),

  // =========================================================================
  // Contest Judges
  // =========================================================================

  listJudges: editorProcedure
    .use(requireScopes('contests:read'))
    .input(listContestJudgesSchema)
    .output(z.array(contestJudgeSchema))
    .query(async ({ ctx, input }) => {
      return contestService.listJudgesWithAccess(
        toServiceContext(ctx),
        input.submissionPeriodId,
      );
    }),

  assignJudge: editorProcedure
    .use(requireScopes('contests:write'))
    .input(assignContestJudgeSchema)
    .output(contestJudgeSchema.omit({ userEmail: true }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await contestService.assignJudgeWithAudit(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  updateJudge: editorProcedure
    .use(requireScopes('contests:write'))
    .input(updateContestJudgeSchema)
    .output(contestJudgeSchema.omit({ userEmail: true }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await contestService.updateJudgeWithAudit(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  removeJudge: editorProcedure
    .use(requireScopes('contests:write'))
    .input(idParamSchema)
    .output(successResponseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await contestService.removeJudgeWithAudit(
          toServiceContext(ctx),
          input.id,
        );
        return { success: true as const };
      } catch (e) {
        mapServiceError(e);
      }
    }),

  // =========================================================================
  // Contest Results
  // =========================================================================

  listResults: orgProcedure
    .use(requireScopes('contests:read'))
    .input(listContestResultsSchema)
    .output(
      paginatedResponseSchema(contestResultSchema.omit({ averageScore: true })),
    )
    .query(async ({ ctx, input }) => {
      return contestService.listResultsWithAccess(
        toServiceContext(ctx),
        input.submissionPeriodId,
        input,
      );
    }),

  createResult: editorProcedure
    .use(requireScopes('contests:write'))
    .input(createContestResultSchema)
    .output(
      contestResultSchema.omit({
        submissionTitle: true,
        submitterEmail: true,
        disbursementStatus: true,
        averageScore: true,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await contestService.createResultWithAudit(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  updateResult: editorProcedure
    .use(requireScopes('contests:write'))
    .input(updateContestResultSchema)
    .output(
      contestResultSchema.omit({
        submissionTitle: true,
        submitterEmail: true,
        disbursementStatus: true,
        averageScore: true,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await contestService.updateResultWithAudit(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  deleteResult: editorProcedure
    .use(requireScopes('contests:write'))
    .input(idParamSchema)
    .output(successResponseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await contestService.deleteResultWithAudit(
          toServiceContext(ctx),
          input.id,
        );
        return { success: true as const };
      } catch (e) {
        mapServiceError(e);
      }
    }),

  // =========================================================================
  // Leaderboard
  // =========================================================================

  leaderboard: orgProcedure
    .use(requireScopes('contests:read'))
    .input(contestLeaderboardSchema)
    .output(z.array(contestLeaderboardEntrySchema))
    .query(async ({ ctx, input }) => {
      return contestService.getLeaderboardWithAccess(
        toServiceContext(ctx),
        input.submissionPeriodId,
      );
    }),

  // =========================================================================
  // Actions
  // =========================================================================

  announceWinners: editorProcedure
    .use(requireScopes('contests:write'))
    .input(announceWinnersSchema)
    .output(successResponseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await contestService.announceWinnersWithAudit(
          toServiceContext(ctx),
          input.submissionPeriodId,
        );
        return { success: true as const };
      } catch (e) {
        mapServiceError(e);
      }
    }),

  disbursePrize: businessOpsProcedure
    .use(requireScopes('payment-transactions:write'))
    .input(disbursePrizeSchema)
    .output(
      z.object({
        result: contestResultSchema.omit({
          submissionTitle: true,
          submitterEmail: true,
          disbursementStatus: true,
          averageScore: true,
        }),
        transaction: paymentTransactionSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await contestService.disbursePrizeWithAudit(
          toServiceContext(ctx),
          input.contestResultId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),
});
