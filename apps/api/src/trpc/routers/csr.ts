import {
  AuditActions,
  AuditResources,
  csrExportEnvelopeSchema,
  csrImportInputSchema,
  csrImportResultSchema,
} from '@colophony/types';
import { createRouter, userProcedure, requireScopes } from '../init.js';
import { csrService } from '../../services/csr.service.js';
import { mapServiceError } from '../error-mapper.js';

export const csrRouter = createRouter({
  export: userProcedure
    .use(requireScopes('csr:read'))
    .output(csrExportEnvelopeSchema)
    .query(async ({ ctx }) => {
      const result = await csrService.assembleExport({
        userId: ctx.authContext.userId,
      });
      await ctx.audit({
        action: AuditActions.CSR_EXPORTED,
        resource: AuditResources.CSR,
        newValue: {
          nativeCount: result.nativeSubmissions.length,
          externalCount: result.externalSubmissions.length,
        },
      });
      return result;
    }),

  import: userProcedure
    .use(requireScopes('csr:write'))
    .input(csrImportInputSchema)
    .output(csrImportResultSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await csrService.importRecords(ctx.dbTx, {
          userId: ctx.authContext.userId,
          input,
        });
        await ctx.audit({
          action: AuditActions.CSR_IMPORTED,
          resource: AuditResources.CSR,
          newValue: {
            submissionsCreated: result.submissionsCreated,
            correspondenceCreated: result.correspondenceCreated,
            importedFrom: input.importedFrom,
          },
        });
        return result;
      } catch (e) {
        mapServiceError(e);
      }
    }),
});
