import { z } from 'zod';

import { router, orgEditorProcedure } from '../trpc.service';
import { trpcRegistry } from '../trpc.registry';

/**
 * Audit router provides access to audit logs for organization admins.
 *
 * GDPR Article 30: Records of processing activities
 * Organizations must maintain records of their data processing activities.
 */
export const auditRouter = router({
  /**
   * List audit events for the organization
   *
   * Only accessible by editors and admins.
   * RLS ensures only the organization's events are visible.
   */
  list: orgEditorProcedure
    .input(
      z.object({
        actorId: z.string().uuid().optional(),
        resource: z.string().optional(),
        resourceId: z.string().uuid().optional(),
        action: z.string().optional(),
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { page, limit, ...filters } = input;

      const result = await trpcRegistry.auditService.query({
        organizationId: ctx.org.id,
        ...filters,
        limit,
        offset: (page - 1) * limit,
      });

      return {
        events: result.events.map((e: (typeof result.events)[number]) => ({
          id: e.id,
          action: e.action,
          resource: e.resource,
          resourceId: e.resourceId,
          actorId: e.actorId,
          actorEmail: e.actor?.email ?? null,
          createdAt: e.createdAt,
          ipAddress: e.ipAddress,
          userAgent: e.userAgent,
        })),
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      };
    }),

  /**
   * Get a specific audit event
   */
  getById: orgEditorProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      // Find the specific event and verify it belongs to this org
      const events = await ctx.prisma.auditEvent.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.org.id,
        },
        include: {
          actor: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      if (!events) {
        return null;
      }

      return {
        id: events.id,
        action: events.action,
        resource: events.resource,
        resourceId: events.resourceId,
        actorId: events.actorId,
        actorEmail: events.actor?.email ?? null,
        oldValue: events.oldValue as Record<string, unknown> | null,
        newValue: events.newValue as Record<string, unknown> | null,
        createdAt: events.createdAt,
        ipAddress: events.ipAddress,
        userAgent: events.userAgent,
      };
    }),

  /**
   * Get audit history for a specific resource
   *
   * Useful for viewing the complete history of a submission, payment, etc.
   */
  getResourceHistory: orgEditorProcedure
    .input(
      z.object({
        resource: z.string(),
        resourceId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ input }) => {
      const events = await trpcRegistry.auditService.getResourceHistory(
        input.resource,
        input.resourceId,
        input.limit,
      );

      return events.map((e: (typeof events)[number]) => ({
        id: e.id,
        action: e.action,
        actorId: e.actorId,
        actorEmail: e.actor?.email ?? null,
        oldValue: e.oldValue as Record<string, unknown> | null,
        newValue: e.newValue as Record<string, unknown> | null,
        createdAt: e.createdAt,
      }));
    }),

  /**
   * Export audit logs as CSV
   *
   * Returns CSV content for download.
   */
  exportCsv: orgEditorProcedure
    .input(
      z.object({
        actorId: z.string().uuid().optional(),
        resource: z.string().optional(),
        action: z.string().optional(),
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const csv = await trpcRegistry.auditService.exportAsCsv({
        organizationId: ctx.org.id,
        ...input,
      });

      const filename = `audit-log-${ctx.org.id}-${new Date().toISOString().split('T')[0]}.csv`;

      return {
        filename,
        contentType: 'text/csv',
        data: csv,
      };
    }),

  /**
   * Get audit statistics
   *
   * Returns summary of audit activity for the organization.
   */
  getStats: orgEditorProcedure
    .input(
      z.object({
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const where: Record<string, unknown> = {
        organizationId: ctx.org.id,
      };

      if (input.dateFrom || input.dateTo) {
        where.createdAt = {};
        if (input.dateFrom) {
          (where.createdAt as Record<string, Date>).gte = input.dateFrom;
        }
        if (input.dateTo) {
          (where.createdAt as Record<string, Date>).lte = input.dateTo;
        }
      }

      // Get counts by action type
      const actionCounts = await ctx.prisma.auditEvent.groupBy({
        by: ['action'],
        where,
        _count: { _all: true },
        orderBy: { _count: { action: 'desc' } },
        take: 20,
      });

      // Get counts by resource type
      const resourceCounts = await ctx.prisma.auditEvent.groupBy({
        by: ['resource'],
        where,
        _count: { _all: true },
        orderBy: { _count: { resource: 'desc' } },
      });

      // Get total count
      const totalCount = await ctx.prisma.auditEvent.count({ where });

      // Get unique actors
      const uniqueActors = await ctx.prisma.auditEvent.groupBy({
        by: ['actorId'],
        where: {
          ...where,
          actorId: { not: null },
        },
      });

      return {
        totalEvents: totalCount,
        uniqueActors: uniqueActors.length,
        byAction: actionCounts.map((c: (typeof actionCounts)[number]) => ({
          action: c.action,
          count: c._count._all,
        })),
        byResource: resourceCounts.map(
          (c: (typeof resourceCounts)[number]) => ({
            resource: c.resource,
            count: c._count._all,
          }),
        ),
      };
    }),
});

export type AuditRouter = typeof auditRouter;
