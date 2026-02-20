import { ORPCError } from '@orpc/server';
import { AuditActions, AuditResources, idParamSchema } from '@colophony/types';
import { restListAuditEventsQuery } from '@colophony/api-contracts';
import { auditService } from '../../services/audit.service.js';
import { adminProcedure, requireScopes } from '../context.js';

// ---------------------------------------------------------------------------
// Audit event routes
// ---------------------------------------------------------------------------

const list = adminProcedure
  .use(requireScopes('audit:read'))
  .route({
    method: 'GET',
    path: '/audit-events',
    summary: 'List audit events',
    description:
      'Returns a paginated, filterable list of audit events for the current organization. Requires ADMIN role.',
    operationId: 'listAuditEvents',
    tags: ['Audit'],
  })
  .input(restListAuditEventsQuery)
  .handler(async ({ input, context }) => {
    const result = await auditService.list(context.dbTx, input);
    await context.audit({
      action: AuditActions.AUDIT_ACCESSED,
      resource: AuditResources.AUDIT,
    });
    return result;
  });

const getById = adminProcedure
  .use(requireScopes('audit:read'))
  .route({
    method: 'GET',
    path: '/audit-events/{id}',
    summary: 'Get an audit event',
    description:
      'Retrieve a single audit event by its ID. Requires ADMIN role.',
    operationId: 'getAuditEvent',
    tags: ['Audit'],
  })
  .input(idParamSchema)
  .handler(async ({ input, context }) => {
    const event = await auditService.getById(context.dbTx, input.id);
    if (!event) {
      throw new ORPCError('NOT_FOUND', {
        message: 'Audit event not found',
      });
    }
    await context.audit({
      action: AuditActions.AUDIT_ACCESSED,
      resource: AuditResources.AUDIT,
      resourceId: event.id,
    });
    return event;
  });

// ---------------------------------------------------------------------------
// Assembled router
// ---------------------------------------------------------------------------

export const auditRouter = {
  list,
  getById,
};
