import { z } from 'zod';
import { prisma } from '@prospector/db';

import { router, authedProcedure, orgProcedure } from '../trpc.service';
import { trpcRegistry } from '../trpc.registry';
import { AuditActions, AuditResources } from '../../modules/audit';

/**
 * Common consent types
 */
export const ConsentTypes = {
  TERMS_OF_SERVICE: 'terms_of_service',
  PRIVACY_POLICY: 'privacy_policy',
  MARKETING_EMAILS: 'marketing_emails',
  DATA_PROCESSING: 'data_processing',
  THIRD_PARTY_SHARING: 'third_party_sharing',
  ANALYTICS: 'analytics',
} as const;

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
 * Consent router handles user consent preferences.
 *
 * GDPR Article 7: Conditions for consent
 * - Consent must be freely given, specific, informed, and unambiguous
 * - Consent can be withdrawn at any time
 * - Evidence of consent must be kept
 */
export const consentRouter = router({
  /**
   * Get all consents for the current user
   */
  list: authedProcedure.query(async ({ ctx }) => {
    const consents = await prisma.userConsent.findMany({
      where: { userId: ctx.user.userId },
      orderBy: [{ organizationId: 'asc' }, { consentType: 'asc' }],
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return consents.map((c: (typeof consents)[number]) => ({
      id: c.id,
      consentType: c.consentType,
      granted: c.granted && !c.revokedAt,
      grantedAt: c.grantedAt,
      revokedAt: c.revokedAt,
      organization: c.organization
        ? { id: c.organization.id, name: c.organization.name }
        : null,
    }));
  }),

  /**
   * Get consents for a specific organization
   */
  listForOrg: orgProcedure.query(async ({ ctx }) => {
    const consents = await ctx.prisma.userConsent.findMany({
      where: {
        userId: ctx.user.userId,
        organizationId: ctx.org.id,
      },
      orderBy: { consentType: 'asc' },
    });

    return consents.map((c: (typeof consents)[number]) => ({
      id: c.id,
      consentType: c.consentType,
      granted: c.granted && !c.revokedAt,
      grantedAt: c.grantedAt,
      revokedAt: c.revokedAt,
    }));
  }),

  /**
   * Grant consent
   *
   * Creates or updates a consent record
   */
  grant: authedProcedure
    .input(
      z.object({
        consentType: z.string().min(1).max(100),
        organizationId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const ipAddress = getIpAddress(ctx.req);

      // Check if consent already exists
      const existing = await prisma.userConsent.findFirst({
        where: {
          userId: ctx.user.userId,
          consentType: input.consentType,
          organizationId: input.organizationId ?? null,
        },
      });

      let consent;

      if (existing) {
        // Update existing consent
        consent = await prisma.userConsent.update({
          where: { id: existing.id },
          data: {
            granted: true,
            grantedAt: new Date(),
            revokedAt: null,
            ipAddress,
          },
        });
      } else {
        // Create new consent
        consent = await prisma.userConsent.create({
          data: {
            userId: ctx.user.userId,
            consentType: input.consentType,
            organizationId: input.organizationId,
            granted: true,
            ipAddress,
          },
        });
      }

      // Audit log
      await trpcRegistry.auditService.logSafe({
        organizationId: input.organizationId,
        actorId: ctx.user.userId,
        action: AuditActions.CONSENT_GRANTED,
        resource: AuditResources.CONSENT,
        resourceId: consent.id,
        newValue: { consentType: input.consentType },
        ipAddress,
      });

      return {
        id: consent.id,
        consentType: consent.consentType,
        granted: true,
        grantedAt: consent.grantedAt,
      };
    }),

  /**
   * Revoke consent
   */
  revoke: authedProcedure
    .input(
      z.object({
        consentType: z.string().min(1).max(100),
        organizationId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const ipAddress = getIpAddress(ctx.req);

      const existing = await prisma.userConsent.findFirst({
        where: {
          userId: ctx.user.userId,
          consentType: input.consentType,
          organizationId: input.organizationId ?? null,
        },
      });

      if (!existing) {
        // No existing consent, nothing to revoke
        return {
          success: true,
          message: 'No consent found to revoke',
        };
      }

      if (existing.revokedAt) {
        return {
          success: true,
          message: 'Consent already revoked',
        };
      }

      const consent = await prisma.userConsent.update({
        where: { id: existing.id },
        data: {
          revokedAt: new Date(),
        },
      });

      // Audit log
      await trpcRegistry.auditService.logSafe({
        organizationId: input.organizationId,
        actorId: ctx.user.userId,
        action: AuditActions.CONSENT_REVOKED,
        resource: AuditResources.CONSENT,
        resourceId: consent.id,
        oldValue: { granted: true },
        newValue: { granted: false, revokedAt: consent.revokedAt },
        ipAddress,
      });

      return {
        success: true,
        message: 'Consent revoked',
      };
    }),

  /**
   * Check if user has granted specific consent
   */
  check: authedProcedure
    .input(
      z.object({
        consentType: z.string().min(1).max(100),
        organizationId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const consent = await prisma.userConsent.findFirst({
        where: {
          userId: ctx.user.userId,
          consentType: input.consentType,
          organizationId: input.organizationId ?? null,
        },
      });

      const granted = consent?.granted && !consent?.revokedAt;

      return {
        consentType: input.consentType,
        granted: !!granted,
        grantedAt: granted ? consent?.grantedAt : null,
      };
    }),

  /**
   * Get consent history for audit purposes
   */
  history: authedProcedure
    .input(
      z.object({
        consentType: z.string().min(1).max(100).optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ input, ctx }) => {
      // Get consent-related audit events for the user
      const events = await trpcRegistry.auditService.query({
        actorId: ctx.user.userId,
        resource: AuditResources.CONSENT,
        limit: input.limit,
      });

      return events.events.map((e: (typeof events.events)[number]) => ({
        id: e.id,
        action: e.action,
        createdAt: e.createdAt,
        details: e.newValue as Record<string, unknown> | null,
      }));
    }),

  /**
   * Bulk grant consents (useful for initial registration/onboarding)
   */
  bulkGrant: authedProcedure
    .input(
      z.object({
        consents: z.array(
          z.object({
            consentType: z.string().min(1).max(100),
            organizationId: z.string().uuid().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const ipAddress = getIpAddress(ctx.req);
      const results: { consentType: string; granted: boolean }[] = [];

      for (const consent of input.consents) {
        const existing = await prisma.userConsent.findFirst({
          where: {
            userId: ctx.user.userId,
            consentType: consent.consentType,
            organizationId: consent.organizationId ?? null,
          },
        });

        if (existing) {
          await prisma.userConsent.update({
            where: { id: existing.id },
            data: {
              granted: true,
              grantedAt: new Date(),
              revokedAt: null,
              ipAddress,
            },
          });
        } else {
          await prisma.userConsent.create({
            data: {
              userId: ctx.user.userId,
              consentType: consent.consentType,
              organizationId: consent.organizationId,
              granted: true,
              ipAddress,
            },
          });
        }

        results.push({ consentType: consent.consentType, granted: true });
      }

      // Single audit log for bulk action
      await trpcRegistry.auditService.logSafe({
        actorId: ctx.user.userId,
        action: 'consent.bulk_granted',
        resource: AuditResources.CONSENT,
        newValue: { consents: results },
        ipAddress,
      });

      return results;
    }),
});

export type ConsentRouter = typeof consentRouter;
