import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { AuditActions, AuditResources } from '@colophony/types';
import { restListAuditEventsQuery } from '@colophony/api-contracts';
import { auditService } from '../../services/audit.service.js';
import { adminProcedure, requireScopes } from '../context.js';

// ---------------------------------------------------------------------------
// Path param schemas
// ---------------------------------------------------------------------------

const eventIdParam = z.object({ id: z.string().uuid() });

// ---------------------------------------------------------------------------
// Audit event routes
// ---------------------------------------------------------------------------

const list = adminProcedure
  .use(requireScopes('audit:read'))
  .route({ method: 'GET', path: '/audit-events' })
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
  .route({ method: 'GET', path: '/audit-events/{id}' })
  .input(eventIdParam)
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
