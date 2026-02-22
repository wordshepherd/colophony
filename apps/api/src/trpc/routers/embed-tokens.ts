import { TRPCError } from '@trpc/server';
import {
  createEmbedTokenSchema,
  revokeEmbedTokenSchema,
  listEmbedTokensByPeriodSchema,
  createEmbedTokenResponseSchema,
  embedTokenResponseSchema,
  AuditActions,
  AuditResources,
  type EmbedTokenResponse,
  type CreateEmbedTokenResponse,
} from '@colophony/types';
import { z } from 'zod';
import {
  orgProcedure,
  adminProcedure,
  createRouter,
  requireScopes,
} from '../init.js';
import { embedTokenService } from '../../services/embed-token.service.js';

export const embedTokensRouter = createRouter({
  create: adminProcedure
    .input(createEmbedTokenSchema)
    .output(createEmbedTokenResponseSchema)
    .mutation(async ({ ctx, input }) => {
      let result;
      try {
        result = await embedTokenService.create(
          ctx.dbTx,
          ctx.authContext.orgId,
          ctx.authContext.userId,
          input,
        );
      } catch (err) {
        if (
          err instanceof Error &&
          err.message === 'Submission period not found'
        ) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Submission period not found',
          });
        }
        throw err;
      }
      await ctx.audit({
        action: AuditActions.EMBED_TOKEN_CREATED,
        resource: AuditResources.EMBED_TOKEN,
        resourceId: result.id,
        newValue: {
          submissionPeriodId: input.submissionPeriodId,
          allowedOrigins: input.allowedOrigins,
        },
      });
      return result as CreateEmbedTokenResponse;
    }),

  listByPeriod: orgProcedure
    .use(requireScopes('periods:read'))
    .input(listEmbedTokensByPeriodSchema)
    .output(z.array(embedTokenResponseSchema))
    .query(async ({ ctx, input }) => {
      return embedTokenService.list(
        ctx.dbTx,
        input.submissionPeriodId,
      ) as Promise<EmbedTokenResponse[]>;
    }),

  revoke: adminProcedure
    .input(revokeEmbedTokenSchema)
    .output(z.object({ id: z.string().uuid(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const revoked = await embedTokenService.revoke(ctx.dbTx, input.tokenId);
      if (!revoked) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Embed token not found',
        });
      }
      await ctx.audit({
        action: AuditActions.EMBED_TOKEN_REVOKED,
        resource: AuditResources.EMBED_TOKEN,
        resourceId: revoked.id,
      });
      return revoked;
    }),
});
