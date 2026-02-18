import { TRPCError } from '@trpc/server';
import {
  listAuditEventsSchema,
  idParamSchema,
  AuditActions,
  AuditResources,
} from '@colophony/types';
import { adminProcedure, createRouter, requireScopes } from '../init.js';
import { auditService } from '../../services/audit.service.js';

export const auditRouter = createRouter({
  list: adminProcedure
    .use(requireScopes('audit:read'))
    .input(listAuditEventsSchema)
    .query(async ({ ctx, input }) => {
      const result = await auditService.list(ctx.dbTx, input);
      await ctx.audit({
        action: AuditActions.AUDIT_ACCESSED,
        resource: AuditResources.AUDIT,
      });
      return result;
    }),

  getById: adminProcedure
    .use(requireScopes('audit:read'))
    .input(idParamSchema)
    .query(async ({ ctx, input }) => {
      const event = await auditService.getById(ctx.dbTx, input.id);
      if (!event) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Audit event not found',
        });
      }
      await ctx.audit({
        action: AuditActions.AUDIT_ACCESSED,
        resource: AuditResources.AUDIT,
        resourceId: event.id,
      });
      return event;
    }),
});
