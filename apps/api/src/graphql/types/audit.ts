import { builder } from '../builder.js';

/**
 * Audit event type. Uses the shape returned by auditService.list/getById
 * (parseAuditRow strips organizationId from the response).
 */
export const AuditEventType = builder
  .objectRef<{
    id: string;
    actorId: string | null;
    action: string;
    resource: string;
    resourceId: string | null;
    oldValue: unknown;
    newValue: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    requestId: string | null;
    method: string | null;
    route: string | null;
    createdAt: Date;
  }>('AuditEvent')
  .implement({
    fields: (t) => ({
      id: t.exposeString('id'),
      actorId: t.exposeString('actorId', { nullable: true }),
      action: t.exposeString('action'),
      resource: t.exposeString('resource'),
      resourceId: t.exposeString('resourceId', { nullable: true }),
      oldValue: t.expose('oldValue', { type: 'JSON', nullable: true }),
      newValue: t.expose('newValue', { type: 'JSON', nullable: true }),
      ipAddress: t.exposeString('ipAddress', { nullable: true }),
      userAgent: t.exposeString('userAgent', { nullable: true }),
      requestId: t.exposeString('requestId', { nullable: true }),
      method: t.exposeString('method', { nullable: true }),
      route: t.exposeString('route', { nullable: true }),
      createdAt: t.expose('createdAt', { type: 'DateTime' }),
    }),
  });
