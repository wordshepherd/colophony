import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { router, orgAdminProcedure } from '../trpc.service';
import { trpcRegistry } from '../trpc.registry';
import { AuditActions, AuditResources } from '../../modules/audit';

/**
 * Extract IP address from request
 */
function getIpAddress(req: Express.Request): string | undefined {
  const forwarded = (
    req as unknown as { headers: Record<string, string | string[]> }
  ).headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return (req as unknown as { ip?: string }).ip ?? undefined;
}

/**
 * Extract user agent from request
 */
function getUserAgent(req: Express.Request): string | undefined {
  return (req as unknown as { headers: Record<string, string | string[]> })
    .headers['user-agent'] as string | undefined;
}

/**
 * Retention policies router for organization admins.
 *
 * GDPR Article 5(1)(e): Storage limitation
 * Data should be kept for no longer than necessary.
 */
export const retentionRouter = router({
  /**
   * List retention policies for the organization
   */
  list: orgAdminProcedure.query(async ({ ctx }) => {
    const policies = await ctx.prisma.retentionPolicy.findMany({
      where: {
        OR: [
          { organizationId: ctx.org.id },
          { organizationId: null }, // Global policies
        ],
      },
      orderBy: [{ organizationId: 'asc' }, { resource: 'asc' }],
    });

    return policies.map((p: (typeof policies)[number]) => ({
      id: p.id,
      resource: p.resource,
      retentionDays: p.retentionDays,
      condition: p.condition,
      isActive: p.isActive,
      isGlobal: p.organizationId === null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }),

  /**
   * Get a specific retention policy
   */
  getById: orgAdminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const policy = await ctx.prisma.retentionPolicy.findFirst({
        where: {
          id: input.id,
          OR: [{ organizationId: ctx.org.id }, { organizationId: null }],
        },
      });

      if (!policy) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Retention policy not found',
        });
      }

      return {
        id: policy.id,
        resource: policy.resource,
        retentionDays: policy.retentionDays,
        condition: policy.condition,
        isActive: policy.isActive,
        isGlobal: policy.organizationId === null,
        createdAt: policy.createdAt,
        updatedAt: policy.updatedAt,
      };
    }),

  /**
   * Create a retention policy for the organization
   */
  create: orgAdminProcedure
    .input(
      z.object({
        resource: z.enum([
          'submission',
          'audit_event',
          'payment',
          'dsar_request',
          'outbox_event',
          'stripe_webhook_event',
        ]),
        retentionDays: z.number().int().min(30).max(3650), // 30 days to 10 years
        condition: z.string().max(255).optional(),
        isActive: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Check if policy already exists for this resource
      const existing = await ctx.prisma.retentionPolicy.findFirst({
        where: {
          organizationId: ctx.org.id,
          resource: input.resource,
          condition: input.condition ?? null,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A retention policy for this resource already exists',
        });
      }

      const policy = await ctx.prisma.retentionPolicy.create({
        data: {
          organizationId: ctx.org.id,
          resource: input.resource,
          retentionDays: input.retentionDays,
          condition: input.condition,
          isActive: input.isActive,
        },
      });

      // Audit log
      await trpcRegistry.auditService.logSafe({
        organizationId: ctx.org.id,
        actorId: ctx.user.userId,
        action: AuditActions.RETENTION_POLICY_CREATED,
        resource: AuditResources.RETENTION_POLICY,
        resourceId: policy.id,
        newValue: {
          resource: input.resource,
          retentionDays: input.retentionDays,
          condition: input.condition,
        },
        ipAddress: getIpAddress(ctx.req),
        userAgent: getUserAgent(ctx.req),
      });

      return {
        id: policy.id,
        resource: policy.resource,
        retentionDays: policy.retentionDays,
        condition: policy.condition,
        isActive: policy.isActive,
        createdAt: policy.createdAt,
      };
    }),

  /**
   * Update a retention policy
   */
  update: orgAdminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        retentionDays: z.number().int().min(30).max(3650).optional(),
        condition: z.string().max(255).optional().nullable(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.prisma.retentionPolicy.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.org.id, // Only org-specific policies can be updated
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Retention policy not found or cannot be modified',
        });
      }

      const updateData: Record<string, unknown> = {};
      if (input.retentionDays !== undefined) {
        updateData.retentionDays = input.retentionDays;
      }
      if (input.condition !== undefined) {
        updateData.condition = input.condition;
      }
      if (input.isActive !== undefined) {
        updateData.isActive = input.isActive;
      }

      const policy = await ctx.prisma.retentionPolicy.update({
        where: { id: input.id },
        data: updateData,
      });

      // Audit log
      await trpcRegistry.auditService.logSafe({
        organizationId: ctx.org.id,
        actorId: ctx.user.userId,
        action: AuditActions.RETENTION_POLICY_UPDATED,
        resource: AuditResources.RETENTION_POLICY,
        resourceId: policy.id,
        oldValue: {
          retentionDays: existing.retentionDays,
          condition: existing.condition,
          isActive: existing.isActive,
        },
        newValue: updateData,
        ipAddress: getIpAddress(ctx.req),
        userAgent: getUserAgent(ctx.req),
      });

      return {
        id: policy.id,
        resource: policy.resource,
        retentionDays: policy.retentionDays,
        condition: policy.condition,
        isActive: policy.isActive,
        updatedAt: policy.updatedAt,
      };
    }),

  /**
   * Delete a retention policy
   */
  delete: orgAdminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.prisma.retentionPolicy.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.org.id, // Only org-specific policies can be deleted
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Retention policy not found or cannot be deleted',
        });
      }

      await ctx.prisma.retentionPolicy.delete({
        where: { id: input.id },
      });

      // Audit log
      await trpcRegistry.auditService.logSafe({
        organizationId: ctx.org.id,
        actorId: ctx.user.userId,
        action: AuditActions.RETENTION_POLICY_DELETED,
        resource: AuditResources.RETENTION_POLICY,
        resourceId: input.id,
        oldValue: {
          resource: existing.resource,
          retentionDays: existing.retentionDays,
          condition: existing.condition,
        },
        ipAddress: getIpAddress(ctx.req),
        userAgent: getUserAgent(ctx.req),
      });

      return { success: true };
    }),

  /**
   * Toggle a retention policy active status
   */
  toggleActive: orgAdminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.prisma.retentionPolicy.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.org.id,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Retention policy not found or cannot be modified',
        });
      }

      const policy = await ctx.prisma.retentionPolicy.update({
        where: { id: input.id },
        data: { isActive: !existing.isActive },
      });

      // Audit log
      await trpcRegistry.auditService.logSafe({
        organizationId: ctx.org.id,
        actorId: ctx.user.userId,
        action: AuditActions.RETENTION_POLICY_UPDATED,
        resource: AuditResources.RETENTION_POLICY,
        resourceId: policy.id,
        oldValue: { isActive: existing.isActive },
        newValue: { isActive: policy.isActive },
        ipAddress: getIpAddress(ctx.req),
        userAgent: getUserAgent(ctx.req),
      });

      return {
        id: policy.id,
        isActive: policy.isActive,
      };
    }),

  /**
   * Get recommended default policies
   */
  getDefaults: orgAdminProcedure.query(async () => {
    // These are recommended defaults based on GDPR best practices
    return [
      {
        resource: 'submission',
        retentionDays: 365,
        condition: "status = 'REJECTED'",
        description: 'Delete rejected submissions after 12 months',
      },
      {
        resource: 'submission',
        retentionDays: 730,
        condition: "status = 'WITHDRAWN'",
        description: 'Delete withdrawn submissions after 24 months',
      },
      {
        resource: 'audit_event',
        retentionDays: 730,
        description:
          'Delete audit events after 24 months (GDPR Article 30 minimum)',
      },
      {
        resource: 'outbox_event',
        retentionDays: 30,
        description: 'Delete processed outbox events after 30 days',
      },
      {
        resource: 'stripe_webhook_event',
        retentionDays: 90,
        description: 'Delete processed Stripe webhook events after 90 days',
      },
      {
        resource: 'dsar_request',
        retentionDays: 365,
        description: 'Delete completed DSAR requests after 12 months',
      },
    ];
  }),
});

export type RetentionRouter = typeof retentionRouter;
