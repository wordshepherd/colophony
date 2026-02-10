import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@prospector/db';

/**
 * Actions that can be logged for audit purposes
 */
export const AuditActions = {
  // Auth actions
  USER_REGISTERED: 'user.registered',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_LOGIN_FAILED: 'user.login_failed',
  EMAIL_VERIFIED: 'user.email_verified',
  PASSWORD_CHANGED: 'user.password_changed',
  PASSWORD_RESET_REQUESTED: 'user.password_reset_requested',

  // Submission actions
  SUBMISSION_CREATED: 'submission.created',
  SUBMISSION_UPDATED: 'submission.updated',
  SUBMISSION_SUBMITTED: 'submission.submitted',
  SUBMISSION_STATUS_CHANGED: 'submission.status_changed',
  SUBMISSION_WITHDRAWN: 'submission.withdrawn',
  SUBMISSION_DELETED: 'submission.deleted',

  // File actions
  FILE_UPLOADED: 'file.uploaded',
  FILE_DELETED: 'file.deleted',
  FILE_INFECTED: 'file.infected',
  FILE_SCAN_FAILED: 'file.scan_failed',

  // Payment actions
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',

  // GDPR actions
  GDPR_EXPORT_REQUESTED: 'gdpr.export_requested',
  GDPR_EXPORT_COMPLETED: 'gdpr.export_completed',
  GDPR_ERASURE_REQUESTED: 'gdpr.erasure_requested',
  GDPR_ERASURE_COMPLETED: 'gdpr.erasure_completed',
  CONSENT_GRANTED: 'consent.granted',
  CONSENT_REVOKED: 'consent.revoked',

  // Admin actions
  MEMBER_ADDED: 'member.added',
  MEMBER_REMOVED: 'member.removed',
  MEMBER_ROLE_CHANGED: 'member.role_changed',
  ORGANIZATION_SETTINGS_CHANGED: 'organization.settings_changed',
  RETENTION_POLICY_CREATED: 'retention_policy.created',
  RETENTION_POLICY_UPDATED: 'retention_policy.updated',
  RETENTION_POLICY_DELETED: 'retention_policy.deleted',
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions];

/**
 * Resources that can be audited
 */
export const AuditResources = {
  USER: 'user',
  SUBMISSION: 'submission',
  SUBMISSION_FILE: 'submission_file',
  PAYMENT: 'payment',
  ORGANIZATION: 'organization',
  ORGANIZATION_MEMBER: 'organization_member',
  DSAR_REQUEST: 'dsar_request',
  RETENTION_POLICY: 'retention_policy',
  CONSENT: 'consent',
} as const;

export type AuditResource =
  (typeof AuditResources)[keyof typeof AuditResources];

export interface AuditLogInput {
  organizationId?: string | null;
  actorId?: string | null;
  action: AuditAction | string;
  resource: AuditResource | string;
  resourceId?: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditQueryInput {
  organizationId?: string;
  actorId?: string;
  resource?: string;
  resourceId?: string;
  action?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  /**
   * Log an audit event
   *
   * This is the primary method for recording audit events. It should be called
   * after the action has been completed successfully, not before.
   */
  async log(input: AuditLogInput): Promise<string> {
    try {
      const auditEvent = await prisma.auditEvent.create({
        data: {
          organizationId: input.organizationId ?? undefined,
          actorId: input.actorId ?? undefined,
          action: input.action,
          resource: input.resource,
          resourceId: input.resourceId ?? undefined,
          oldValue: input.oldValue ?? undefined,
          newValue: input.newValue ?? undefined,
          ipAddress: input.ipAddress ?? undefined,
          userAgent: input.userAgent ?? undefined,
        },
      });

      this.logger.debug(
        `Audit event logged: ${input.action} on ${input.resource}${input.resourceId ? `:${input.resourceId}` : ''} by ${input.actorId ?? 'system'}`,
      );

      return auditEvent.id;
    } catch (error) {
      // Log errors but don't fail the main operation
      this.logger.error('Failed to log audit event', {
        error,
        input,
      });
      throw error;
    }
  }

  /**
   * Log an audit event without throwing on error
   *
   * Use this when audit logging should not fail the main operation
   */
  async logSafe(input: AuditLogInput): Promise<string | null> {
    try {
      return await this.log(input);
    } catch {
      return null;
    }
  }

  /**
   * Query audit events with filters
   *
   * Note: This method respects RLS policies when used within an org context.
   * For global admin queries, use a separate admin-scoped query.
   */
  async query(input: AuditQueryInput) {
    const {
      organizationId,
      actorId,
      resource,
      resourceId,
      action,
      dateFrom,
      dateTo,
      limit = 100,
      offset = 0,
    } = input;

    const where: Record<string, unknown> = {};

    if (organizationId) {
      where.organizationId = organizationId;
    }
    if (actorId) {
      where.actorId = actorId;
    }
    if (resource) {
      where.resource = resource;
    }
    if (resourceId) {
      where.resourceId = resourceId;
    }
    if (action) {
      where.action = action;
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        (where.createdAt as Record<string, Date>).gte = dateFrom;
      }
      if (dateTo) {
        (where.createdAt as Record<string, Date>).lte = dateTo;
      }
    }

    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          actor: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      }),
      prisma.auditEvent.count({ where }),
    ]);

    return {
      events,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get audit events for a specific resource
   *
   * Useful for showing the history of a specific submission, payment, etc.
   */
  async getResourceHistory(
    resource: AuditResource | string,
    resourceId: string,
    limit = 50,
  ) {
    return prisma.auditEvent.findMany({
      where: {
        resource,
        resourceId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Get audit events for a specific user
   *
   * Used for GDPR export to include user's activity log
   */
  async getUserActivity(userId: string, limit = 1000) {
    return prisma.auditEvent.findMany({
      where: {
        actorId: userId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        action: true,
        resource: true,
        resourceId: true,
        createdAt: true,
        ipAddress: true,
        // Exclude oldValue/newValue for privacy in exports
      },
    });
  }

  /**
   * Export audit events as CSV
   *
   * For admin exports of audit logs
   */
  async exportAsCsv(input: AuditQueryInput): Promise<string> {
    const { events } = await this.query({
      ...input,
      limit: 10000, // Higher limit for exports
    });

    const headers = [
      'id',
      'created_at',
      'action',
      'resource',
      'resource_id',
      'actor_id',
      'actor_email',
      'ip_address',
      'user_agent',
    ];

    const rows = events.map((event: (typeof events)[number]) => [
      event.id,
      event.createdAt.toISOString(),
      event.action,
      event.resource,
      event.resourceId ?? '',
      event.actorId ?? '',
      event.actor?.email ?? '',
      event.ipAddress ?? '',
      event.userAgent ?? '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row: (string | Date)[]) =>
        row
          .map((cell: string | Date) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(','),
      ),
    ].join('\n');

    return csvContent;
  }
}
