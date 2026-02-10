import { Injectable, Logger } from '@nestjs/common';
import archiver from 'archiver';
import { Writable } from 'stream';
import { prisma, PrismaTransaction } from '@prospector/db';
import { AuditService, AuditActions, AuditResources } from '../audit';
import { StorageService } from '../storage';

export interface GdprExportData {
  profile: {
    id: string;
    email: string;
    emailVerified: boolean;
    emailVerifiedAt: Date | null;
    createdAt: Date;
    deletedAt: Date | null;
  };
  submissions: Array<{
    id: string;
    organizationId: string;
    title: string;
    content: string | null;
    coverLetter: string | null;
    status: string;
    submittedAt: Date | null;
    createdAt: Date;
    files: Array<{
      id: string;
      filename: string;
      mimeType: string;
      size: string; // BigInt serialized as string
      uploadedAt: Date;
    }>;
  }>;
  payments: Array<{
    id: string;
    organizationId: string;
    submissionId: string | null;
    amount: string; // Decimal serialized as string
    currency: string;
    status: string;
    createdAt: Date;
  }>;
  consents: Array<{
    id: string;
    organizationId: string | null;
    consentType: string;
    granted: boolean;
    grantedAt: Date;
    revokedAt: Date | null;
  }>;
  auditLog: Array<{
    id: string;
    action: string;
    resource: string;
    resourceId: string | null;
    createdAt: Date;
    ipAddress: string | null;
  }>;
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
    joinedAt: Date;
  }>;
}

export interface DsarRequestInput {
  userId: string;
  type: 'ACCESS' | 'ERASURE' | 'RECTIFICATION' | 'PORTABILITY';
  notes?: string;
}

@Injectable()
export class GdprService {
  private readonly logger = new Logger(GdprService.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Export all user data as a structured JSON object
   *
   * GDPR Article 15: Right of access
   * GDPR Article 20: Right to data portability
   */
  async exportUserData(userId: string): Promise<GdprExportData> {
    this.logger.log(`Exporting data for user ${userId}`);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        submissions: {
          include: {
            files: {
              select: {
                id: true,
                filename: true,
                mimeType: true,
                size: true,
                uploadedAt: true,
              },
            },
          },
        },
        memberships: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get payments for user's submissions
    const submissionIds = user.submissions.map(
      (s: (typeof user.submissions)[number]) => s.id,
    );
    const payments = await prisma.payment.findMany({
      where: {
        submissionId: { in: submissionIds },
      },
      select: {
        id: true,
        organizationId: true,
        submissionId: true,
        amount: true,
        currency: true,
        status: true,
        createdAt: true,
      },
    });

    // Get user consents
    const consents = await prisma.userConsent.findMany({
      where: { userId },
      select: {
        id: true,
        organizationId: true,
        consentType: true,
        granted: true,
        grantedAt: true,
        revokedAt: true,
      },
    });

    // Get audit log for user's actions (limited for privacy)
    const auditLog = await this.auditService.getUserActivity(userId, 1000);

    return {
      profile: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt,
        deletedAt: user.deletedAt,
      },
      submissions: user.submissions.map(
        (s: (typeof user.submissions)[number]) => ({
          id: s.id,
          organizationId: s.organizationId,
          title: s.title,
          content: s.content,
          coverLetter: s.coverLetter,
          status: s.status,
          submittedAt: s.submittedAt,
          createdAt: s.createdAt,
          files: s.files.map((f: (typeof s.files)[number]) => ({
            id: f.id,
            filename: f.filename,
            mimeType: f.mimeType,
            size: f.size.toString(),
            uploadedAt: f.uploadedAt,
          })),
        }),
      ),
      payments: payments.map((p: (typeof payments)[number]) => ({
        id: p.id,
        organizationId: p.organizationId,
        submissionId: p.submissionId,
        amount: p.amount.toString(),
        currency: p.currency,
        status: p.status,
        createdAt: p.createdAt,
      })),
      consents: consents.map((c: (typeof consents)[number]) => ({
        id: c.id,
        organizationId: c.organizationId,
        consentType: c.consentType,
        granted: c.granted,
        grantedAt: c.grantedAt,
        revokedAt: c.revokedAt,
      })),
      auditLog: auditLog.map((a: (typeof auditLog)[number]) => ({
        id: a.id,
        action: a.action,
        resource: a.resource,
        resourceId: a.resourceId,
        createdAt: a.createdAt,
        ipAddress: a.ipAddress,
      })),
      organizations: user.memberships.map(
        (m: (typeof user.memberships)[number]) => ({
          id: m.organization.id,
          name: m.organization.name,
          slug: m.organization.slug,
          role: m.role,
          joinedAt: m.createdAt,
        }),
      ),
    };
  }

  /**
   * Export user data as a ZIP file containing JSON files
   *
   * Returns a Buffer containing the ZIP archive
   */
  async exportUserDataAsZip(userId: string): Promise<Buffer> {
    const data = await this.exportUserData(userId);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const archive = archiver('zip', { zlib: { level: 9 } });

      // Collect chunks
      const writable = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });

      writable.on('finish', () => {
        resolve(Buffer.concat(chunks));
      });

      archive.on('error', reject);
      archive.pipe(writable);

      // Add JSON files to archive
      archive.append(JSON.stringify(data.profile, null, 2), {
        name: 'profile.json',
      });
      archive.append(JSON.stringify(data.submissions, null, 2), {
        name: 'submissions.json',
      });
      archive.append(JSON.stringify(data.payments, null, 2), {
        name: 'payments.json',
      });
      archive.append(JSON.stringify(data.auditLog, null, 2), {
        name: 'audit-log.json',
      });
      archive.append(JSON.stringify(data.consents, null, 2), {
        name: 'consents.json',
      });
      archive.append(JSON.stringify(data.organizations, null, 2), {
        name: 'organizations.json',
      });

      // Add metadata
      archive.append(
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            userId: userId,
            version: '1.0',
            format: 'GDPR Data Export',
          },
          null,
          2,
        ),
        { name: 'metadata.json' },
      );

      void archive.finalize();
    });
  }

  /**
   * Delete (anonymize) user data
   *
   * GDPR Article 17: Right to erasure ("right to be forgotten")
   *
   * Note: We don't fully delete data to maintain audit trail and legal compliance.
   * Instead, we:
   * 1. Anonymize personal data in submissions
   * 2. Soft-delete the user account
   * 3. Delete associated files from storage
   * 4. Keep anonymized audit trail for legal compliance
   */
  async deleteUserData(userId: string): Promise<void> {
    this.logger.log(`Processing data deletion for user ${userId}`);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        submissions: {
          include: { files: true },
        },
        memberships: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.deletedAt) {
      throw new Error('User data has already been deleted');
    }

    // Start transaction
    await prisma.$transaction(async (tx: PrismaTransaction) => {
      // 1. Anonymize submissions (keep for magazine records, but remove PII)
      for (const submission of user.submissions) {
        // Delete files from storage
        for (const file of submission.files) {
          try {
            await this.storageService.deleteFile(file.storageKey);
          } catch (error) {
            this.logger.warn(
              `Failed to delete file ${file.storageKey}: ${error}`,
            );
          }
        }

        // Delete file records
        await tx.submissionFile.deleteMany({
          where: { submissionId: submission.id },
        });

        // Anonymize submission content
        await tx.submission.update({
          where: { id: submission.id },
          data: {
            title: '[Deleted]',
            content: null,
            coverLetter: null,
          },
        });
      }

      // 2. Delete organization memberships
      await tx.organizationMember.deleteMany({
        where: { userId },
      });

      // 3. Delete user identities (OAuth tokens, etc.)
      await tx.userIdentity.deleteMany({
        where: { userId },
      });

      // 4. Delete user consents
      await tx.userConsent.deleteMany({
        where: { userId },
      });

      // 5. Soft-delete user and anonymize email
      const anonymizedEmail = `deleted_${userId}@deleted.invalid`;
      await tx.user.update({
        where: { id: userId },
        data: {
          email: anonymizedEmail,
          passwordHash: null,
          emailVerified: false,
          emailVerifiedAt: null,
          deletedAt: new Date(),
        },
      });

      // 6. Anonymize audit events (keep for compliance, remove user association)
      await tx.auditEvent.updateMany({
        where: { actorId: userId },
        data: {
          actorId: null,
          ipAddress: null,
          userAgent: null,
        },
      });
    });

    // Log the erasure action (outside transaction for reliability)
    await this.auditService.log({
      action: AuditActions.GDPR_ERASURE_COMPLETED,
      resource: AuditResources.USER,
      resourceId: userId,
      newValue: { erasedAt: new Date().toISOString() },
    });

    this.logger.log(`Data deletion completed for user ${userId}`);
  }

  /**
   * Create a DSAR (Data Subject Access Request)
   *
   * GDPR requires response within 30 days
   */
  async createDsarRequest(
    input: DsarRequestInput,
  ): Promise<{ id: string; dueAt: Date }> {
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + 30); // 30-day deadline per GDPR

    const request = await prisma.dsarRequest.create({
      data: {
        userId: input.userId,
        type: input.type,
        status: 'PENDING',
        dueAt,
        notes: input.notes,
      },
    });

    // Log the request
    await this.auditService.log({
      actorId: input.userId,
      action: AuditActions.GDPR_EXPORT_REQUESTED,
      resource: AuditResources.DSAR_REQUEST,
      resourceId: request.id,
      newValue: { type: input.type, dueAt: dueAt.toISOString() },
    });

    return {
      id: request.id,
      dueAt,
    };
  }

  /**
   * Get DSAR requests for a user
   */
  async getUserDsarRequests(userId: string) {
    return prisma.dsarRequest.findMany({
      where: { userId },
      orderBy: { requestedAt: 'desc' },
    });
  }

  /**
   * Get a specific DSAR request
   */
  async getDsarRequest(requestId: string, userId: string) {
    const request = await prisma.dsarRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.userId !== userId) {
      return null;
    }

    return request;
  }

  /**
   * Complete a DSAR request
   *
   * For ACCESS requests: Generate and return export data
   * For ERASURE requests: Delete user data
   */
  async completeDsarRequest(requestId: string): Promise<void> {
    const request = await prisma.dsarRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error('DSAR request not found');
    }

    if (request.status === 'COMPLETED') {
      throw new Error('DSAR request already completed');
    }

    // Update status to in-progress
    await prisma.dsarRequest.update({
      where: { id: requestId },
      data: { status: 'IN_PROGRESS' },
    });

    try {
      if (request.type === 'ERASURE') {
        await this.deleteUserData(request.userId);
      }

      // For ACCESS/PORTABILITY, the export is generated on-demand via exportUserData

      // Mark as completed
      await prisma.dsarRequest.update({
        where: { id: requestId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // Log completion
      await this.auditService.log({
        action: AuditActions.GDPR_EXPORT_COMPLETED,
        resource: AuditResources.DSAR_REQUEST,
        resourceId: requestId,
        newValue: { type: request.type, completedAt: new Date().toISOString() },
      });
    } catch (error) {
      // Mark as pending on failure (will need manual intervention)
      await prisma.dsarRequest.update({
        where: { id: requestId },
        data: {
          status: 'PENDING',
          notes: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      });
      throw error;
    }
  }

  /**
   * Get pending DSAR requests that are approaching their due date
   *
   * Used by admins to monitor compliance deadlines
   */
  async getPendingDsarRequests(daysUntilDue = 7) {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + daysUntilDue);

    return prisma.dsarRequest.findMany({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        dueAt: { lte: threshold },
      },
      orderBy: { dueAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }
}
