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
    description: 'An immutable record of a security-relevant action.',
    fields: (t) => ({
      id: t.exposeString('id', { description: 'Unique identifier.' }),
      actorId: t.exposeString('actorId', {
        nullable: true,
        description: 'ID of the user who performed the action.',
      }),
      action: t.exposeString('action', {
        description: 'Action that was performed (e.g. ORG_CREATED).',
      }),
      resource: t.exposeString('resource', {
        description: 'Resource type affected (e.g. organization).',
      }),
      resourceId: t.exposeString('resourceId', {
        nullable: true,
        description: 'ID of the affected resource.',
      }),
      oldValue: t.expose('oldValue', {
        type: 'JSON',
        nullable: true,
        description: 'Previous state before the change.',
      }),
      newValue: t.expose('newValue', {
        type: 'JSON',
        nullable: true,
        description: 'New state after the change.',
      }),
      ipAddress: t.exposeString('ipAddress', {
        nullable: true,
        description: 'IP address of the request.',
      }),
      userAgent: t.exposeString('userAgent', {
        nullable: true,
        description: 'User-Agent header from the request.',
      }),
      requestId: t.exposeString('requestId', {
        nullable: true,
        description: 'Correlation ID for the request.',
      }),
      method: t.exposeString('method', {
        nullable: true,
        description: 'HTTP method of the request.',
      }),
      route: t.exposeString('route', {
        nullable: true,
        description: 'API route that was called.',
      }),
      createdAt: t.expose('createdAt', {
        type: 'DateTime',
        description: 'When the event was recorded.',
      }),
    }),
  });
