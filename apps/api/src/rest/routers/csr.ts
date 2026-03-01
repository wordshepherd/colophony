import {
  AuditActions,
  AuditResources,
  csrExportEnvelopeSchema,
  csrImportInputSchema,
  csrImportResultSchema,
} from '@colophony/types';
import { csrService } from '../../services/csr.service.js';
import { mapServiceError } from '../error-mapper.js';
import { userProcedure, requireScopes } from '../context.js';

// ---------------------------------------------------------------------------
// CSR routes (user-scoped, no org required)
// ---------------------------------------------------------------------------

const exportCsr = userProcedure
  .use(requireScopes('csr:read'))
  .route({
    method: 'GET',
    path: '/csr/export',
    summary: 'Export CSR',
    description:
      'Exports the full Colophony Submission Record for the authenticated user as JSON.',
    operationId: 'exportCsr',
    tags: ['CSR'],
  })
  .output(csrExportEnvelopeSchema)
  .handler(async ({ context }) => {
    const result = await csrService.assembleExport({
      userId: context.authContext.userId,
    });
    await context.audit({
      action: AuditActions.CSR_EXPORTED,
      resource: AuditResources.CSR,
      newValue: {
        nativeCount: result.nativeSubmissions.length,
        externalCount: result.externalSubmissions.length,
      },
    });
    return result;
  });

const importCsr = userProcedure
  .use(requireScopes('csr:write'))
  .route({
    method: 'POST',
    path: '/csr/import',
    summary: 'Import CSR',
    description:
      'Imports external submission records and correspondence from a JSON payload.',
    operationId: 'importCsr',
    tags: ['CSR'],
  })
  .input(csrImportInputSchema)
  .output(csrImportResultSchema)
  .handler(async ({ input, context }) => {
    try {
      const result = await csrService.importRecords(context.dbTx, {
        userId: context.authContext.userId,
        input,
      });
      await context.audit({
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
  });

// ---------------------------------------------------------------------------
// Assembled router
// ---------------------------------------------------------------------------

export const csrRouter = {
  exportCsr,
  importCsr,
};
