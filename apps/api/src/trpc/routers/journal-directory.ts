import {
  journalDirectorySearchSchema,
  journalDirectoryBatchMatchSchema,
} from '@colophony/types';
import { createRouter, userProcedure, requireScopes } from '../init.js';
import { journalDirectoryService } from '../../services/journal-directory.service.js';
import { mapServiceError } from '../error-mapper.js';

export const journalDirectoryRouter = createRouter({
  search: userProcedure
    .use(requireScopes('journal-directory:read'))
    .input(journalDirectorySearchSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await journalDirectoryService.search(ctx.dbTx, input);
      } catch (e) {
        mapServiceError(e);
      }
    }),

  batchMatch: userProcedure
    .use(requireScopes('journal-directory:read'))
    .input(journalDirectoryBatchMatchSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await journalDirectoryService.batchMatchByName(ctx.dbTx, input);
      } catch (e) {
        mapServiceError(e);
      }
    }),
});
