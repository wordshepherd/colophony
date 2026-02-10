import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@prospector/db';
import { AuditService, AuditResources } from '../../audit';
import { StorageService } from '../../storage';

export interface RetentionPolicyResult {
  policyId: string;
  resource: string;
  recordsDeleted: number;
  filesDeleted: number;
  errors: string[];
}

export interface RetentionRunResult {
  runAt: Date;
  policies: RetentionPolicyResult[];
  totalRecordsDeleted: number;
  totalFilesDeleted: number;
  hasErrors: boolean;
}

/**
 * Service for enforcing data retention policies.
 *
 * GDPR Article 5(1)(e): Storage limitation
 * Data should be kept for no longer than necessary for the purposes
 * for which the data is processed.
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Run all active retention policies
   *
   * This should be called by a scheduled job (e.g., daily at 3 AM)
   */
  async runRetentionPolicies(): Promise<RetentionRunResult> {
    this.logger.log('Starting retention policy enforcement');

    const policies = await prisma.retentionPolicy.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    const results: RetentionPolicyResult[] = [];
    let totalRecordsDeleted = 0;
    let totalFilesDeleted = 0;
    let hasErrors = false;

    for (const policy of policies) {
      try {
        const result = await this.enforcePolicy(policy);
        results.push(result);
        totalRecordsDeleted += result.recordsDeleted;
        totalFilesDeleted += result.filesDeleted;
        if (result.errors.length > 0) {
          hasErrors = true;
        }
      } catch (error) {
        this.logger.error(`Failed to enforce policy ${policy.id}: ${error}`);
        results.push({
          policyId: policy.id,
          resource: policy.resource,
          recordsDeleted: 0,
          filesDeleted: 0,
          errors: [error instanceof Error ? error.message : String(error)],
        });
        hasErrors = true;
      }
    }

    this.logger.log(
      `Retention run complete: ${totalRecordsDeleted} records, ${totalFilesDeleted} files deleted`,
    );

    return {
      runAt: new Date(),
      policies: results,
      totalRecordsDeleted,
      totalFilesDeleted,
      hasErrors,
    };
  }

  /**
   * Enforce a single retention policy
   */
  private async enforcePolicy(policy: {
    id: string;
    organizationId: string | null;
    resource: string;
    retentionDays: number;
    condition: string | null;
  }): Promise<RetentionPolicyResult> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

    this.logger.debug(
      `Enforcing policy ${policy.id}: ${policy.resource} older than ${policy.retentionDays} days`,
    );

    const errors: string[] = [];
    let recordsDeleted = 0;
    let filesDeleted = 0;

    switch (policy.resource.toLowerCase()) {
      case 'submission':
        const submissionResult = await this.deleteOldSubmissions(
          cutoffDate,
          policy.organizationId,
          policy.condition,
        );
        recordsDeleted = submissionResult.recordsDeleted;
        filesDeleted = submissionResult.filesDeleted;
        errors.push(...submissionResult.errors);
        break;

      case 'audit_event':
        recordsDeleted = await this.deleteOldAuditEvents(
          cutoffDate,
          policy.organizationId,
        );
        break;

      case 'payment':
        // Don't delete payments automatically - legal/accounting requirements
        this.logger.warn(
          'Payment retention policies are not automatically enforced. Manual review required.',
        );
        break;

      case 'dsar_request':
        recordsDeleted = await this.deleteOldDsarRequests(cutoffDate);
        break;

      case 'outbox_event':
        recordsDeleted = await this.deleteOldOutboxEvents(cutoffDate);
        break;

      case 'stripe_webhook_event':
        recordsDeleted = await this.deleteOldWebhookEvents(cutoffDate);
        break;

      default:
        this.logger.warn(
          `Unknown resource type in retention policy: ${policy.resource}`,
        );
        errors.push(`Unknown resource type: ${policy.resource}`);
    }

    // Log the retention action
    await this.auditService.logSafe({
      organizationId: policy.organizationId,
      action: 'retention_policy.executed',
      resource: AuditResources.RETENTION_POLICY,
      resourceId: policy.id,
      newValue: {
        recordsDeleted,
        filesDeleted,
        cutoffDate: cutoffDate.toISOString(),
        errors: errors.length > 0 ? errors : undefined,
      },
    });

    return {
      policyId: policy.id,
      resource: policy.resource,
      recordsDeleted,
      filesDeleted,
      errors,
    };
  }

  /**
   * Delete old submissions based on retention policy
   */
  private async deleteOldSubmissions(
    cutoffDate: Date,
    organizationId: string | null,
    condition: string | null,
  ): Promise<{
    recordsDeleted: number;
    filesDeleted: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let filesDeleted = 0;

    // Build the where clause
    const where: Record<string, unknown> = {
      createdAt: { lt: cutoffDate },
    };

    if (organizationId) {
      where.organizationId = organizationId;
    }

    // Parse condition (e.g., "status = 'REJECTED'")
    if (condition) {
      const statusMatch = condition.match(/status\s*=\s*'(\w+)'/i);
      if (statusMatch) {
        where.status = statusMatch[1];
      }
    }

    // Find submissions to delete
    const submissions = await prisma.submission.findMany({
      where,
      include: {
        files: true,
      },
      take: 1000, // Process in batches
    });

    // Delete files from storage
    for (const submission of submissions) {
      for (const file of submission.files) {
        try {
          await this.storageService.deleteFile(file.storageKey);
          filesDeleted++;
        } catch (error) {
          errors.push(`Failed to delete file ${file.storageKey}: ${error}`);
          this.logger.warn(`Failed to delete file ${file.storageKey}`, error);
        }
      }
    }

    // Delete submissions (cascade deletes files and history)
    const result = await prisma.submission.deleteMany({ where });

    return {
      recordsDeleted: result.count,
      filesDeleted,
      errors,
    };
  }

  /**
   * Delete old audit events
   */
  private async deleteOldAuditEvents(
    cutoffDate: Date,
    organizationId: string | null,
  ): Promise<number> {
    const where: Record<string, unknown> = {
      createdAt: { lt: cutoffDate },
    };

    if (organizationId) {
      where.organizationId = organizationId;
    }

    const result = await prisma.auditEvent.deleteMany({ where });
    return result.count;
  }

  /**
   * Delete old DSAR requests (completed ones only)
   */
  private async deleteOldDsarRequests(cutoffDate: Date): Promise<number> {
    const result = await prisma.dsarRequest.deleteMany({
      where: {
        status: 'COMPLETED',
        completedAt: { lt: cutoffDate },
      },
    });
    return result.count;
  }

  /**
   * Delete old processed outbox events
   */
  private async deleteOldOutboxEvents(cutoffDate: Date): Promise<number> {
    const result = await prisma.outboxEvent.deleteMany({
      where: {
        processedAt: { lt: cutoffDate },
        NOT: { processedAt: null },
      },
    });
    return result.count;
  }

  /**
   * Delete old processed webhook events
   */
  private async deleteOldWebhookEvents(cutoffDate: Date): Promise<number> {
    const result = await prisma.stripeWebhookEvent.deleteMany({
      where: {
        processed: true,
        receivedAt: { lt: cutoffDate },
      },
    });
    return result.count;
  }

  /**
   * Get default retention policies
   *
   * These are the recommended defaults per GDPR best practices
   */
  getDefaultPolicies(): Array<{
    resource: string;
    retentionDays: number;
    condition?: string;
    description: string;
  }> {
    return [
      {
        resource: 'submission',
        retentionDays: 365, // 12 months
        condition: "status = 'REJECTED'",
        description: 'Delete rejected submissions after 12 months',
      },
      {
        resource: 'submission',
        retentionDays: 730, // 24 months
        condition: "status = 'WITHDRAWN'",
        description: 'Delete withdrawn submissions after 24 months',
      },
      {
        resource: 'audit_event',
        retentionDays: 730, // 24 months
        description:
          'Delete audit events after 24 months (GDPR Article 30 minimum)',
      },
      {
        resource: 'outbox_event',
        retentionDays: 30, // 1 month
        description: 'Delete processed outbox events after 30 days',
      },
      {
        resource: 'stripe_webhook_event',
        retentionDays: 90, // 3 months
        description: 'Delete processed Stripe webhook events after 90 days',
      },
      {
        resource: 'dsar_request',
        retentionDays: 365, // 12 months
        description: 'Delete completed DSAR requests after 12 months',
      },
    ];
  }
}
