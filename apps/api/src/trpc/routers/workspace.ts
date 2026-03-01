import { createRouter, userProcedure, requireScopes } from '../init.js';
import { workspaceStatsService } from '../../services/workspace-stats.service.js';
import { mapServiceError } from '../error-mapper.js';

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
});
