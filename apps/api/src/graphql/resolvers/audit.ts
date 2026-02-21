import { GraphQLError } from 'graphql';
import {
  listAuditEventsSchema,
  idParamSchema,
  AuditActions,
  AuditResources,
} from '@colophony/types';
import { builder } from '../builder.js';
import { requireAdmin, requireScopes } from '../guards.js';
import { auditService } from '../../services/audit.service.js';
import { AuditEventType } from '../types/index.js';

// ---------------------------------------------------------------------------
// Paginated response type
// ---------------------------------------------------------------------------

const PaginatedAuditEvents = builder
  .objectRef<{
    items: {
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
    }[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>('PaginatedAuditEvents')
  .implement({
    fields: (t) => ({
      items: t.field({
        type: [AuditEventType],
        resolve: (r) => r.items,
      }),
      total: t.exposeInt('total'),
      page: t.exposeInt('page'),
      limit: t.exposeInt('limit'),
      totalPages: t.exposeInt('totalPages'),
    }),
  });

// ---------------------------------------------------------------------------
// Query fields
// ---------------------------------------------------------------------------

builder.queryFields((t) => ({
  /**
   * List audit events (admin only).
   */
  auditEvents: t.field({
    type: PaginatedAuditEvents,
    description:
      'List audit events for the current organization. Requires ADMIN role.',
    args: {
      action: t.arg.string({
        required: false,
        description: 'Filter by audit action (e.g. ORG_CREATED).',
      }),
      resource: t.arg.string({
        required: false,
        description: 'Filter by resource type (e.g. organization).',
      }),
      actorId: t.arg.string({
        required: false,
        description: 'Filter by the user who performed the action.',
      }),
      resourceId: t.arg.string({
        required: false,
        description: 'Filter by the affected resource ID.',
      }),
      from: t.arg({
        type: 'DateTime',
        required: false,
        description: 'Start of date range.',
      }),
      to: t.arg({
        type: 'DateTime',
        required: false,
        description: 'End of date range.',
      }),
      page: t.arg.int({
        required: false,
        defaultValue: 1,
        description: 'Page number (1-based).',
      }),
      limit: t.arg.int({
        required: false,
        defaultValue: 20,
        description: 'Items per page (1-100).',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const adminCtx = requireAdmin(ctx);
      await requireScopes(ctx, 'audit:read');
      const input = listAuditEventsSchema.parse({
        action: args.action ?? undefined,
        resource: args.resource ?? undefined,
        actorId: args.actorId ?? undefined,
        resourceId: args.resourceId ?? undefined,
        from: args.from ?? undefined,
        to: args.to ?? undefined,
        page: args.page,
        limit: args.limit,
      });
      const result = await auditService.list(adminCtx.dbTx, input);
      await adminCtx.audit({
        action: AuditActions.AUDIT_ACCESSED,
        resource: AuditResources.AUDIT,
      });
      return result;
    },
  }),

  /**
   * Get a single audit event by ID (admin only).
   */
  auditEvent: t.field({
    type: AuditEventType,
    nullable: true,
    description: 'Get a single audit event by ID. Requires ADMIN role.',
    args: {
      id: t.arg.string({ required: true, description: 'Audit event ID.' }),
    },
    resolve: async (_root, args, ctx) => {
      const adminCtx = requireAdmin(ctx);
      await requireScopes(ctx, 'audit:read');
      const { id } = idParamSchema.parse({ id: args.id });
      const event = await auditService.getById(adminCtx.dbTx, id);
      if (!event) {
        throw new GraphQLError('Audit event not found', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      await adminCtx.audit({
        action: AuditActions.AUDIT_ACCESSED,
        resource: AuditResources.AUDIT,
        resourceId: event.id,
      });
      return event;
    },
  }),
}));
