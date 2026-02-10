import { Test, TestingModule } from '@nestjs/testing';
import { RetentionService } from '../../src/modules/jobs/services/retention.service';
import { AuditService } from '../../src/modules/audit';
import { StorageService } from '../../src/modules/storage';

// Mock Prisma
jest.mock('@prospector/db', () => ({
  prisma: {
    retentionPolicy: {
      findMany: jest.fn(),
    },
    submission: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    auditEvent: {
      deleteMany: jest.fn(),
    },
    dsarRequest: {
      deleteMany: jest.fn(),
    },
    outboxEvent: {
      deleteMany: jest.fn(),
    },
    stripeWebhookEvent: {
      deleteMany: jest.fn(),
    },
  },
}));

import { prisma } from '@prospector/db';

describe('RetentionService', () => {
  let service: RetentionService;
  let mockAuditService: jest.Mocked<AuditService>;
  let mockStorageService: jest.Mocked<StorageService>;
  const mockPrisma = prisma as jest.Mocked<typeof prisma>;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockAuditService = {
      logSafe: jest.fn().mockResolvedValue('audit-id'),
    } as unknown as jest.Mocked<AuditService>;

    mockStorageService = {
      deleteFile: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<StorageService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetentionService,
        { provide: AuditService, useValue: mockAuditService },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<RetentionService>(RetentionService);
  });

  describe('runRetentionPolicies', () => {
    it('should process all active retention policies', async () => {
      const mockPolicies = [
        {
          id: 'policy-1',
          organizationId: null,
          resource: 'submission',
          retentionDays: 365,
          condition: "status = 'REJECTED'",
          isActive: true,
        },
        {
          id: 'policy-2',
          organizationId: 'org-123',
          resource: 'audit_event',
          retentionDays: 730,
          condition: null,
          isActive: true,
        },
      ];

      (mockPrisma.retentionPolicy.findMany as jest.Mock).mockResolvedValue(
        mockPolicies,
      );
      (mockPrisma.submission.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.submission.deleteMany as jest.Mock).mockResolvedValue({
        count: 5,
      });
      (mockPrisma.auditEvent.deleteMany as jest.Mock).mockResolvedValue({
        count: 100,
      });

      const result = await service.runRetentionPolicies();

      expect(result.policies).toHaveLength(2);
      expect(result.runAt).toBeInstanceOf(Date);
      expect(mockPrisma.retentionPolicy.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should calculate total records and files deleted', async () => {
      const mockPolicies = [
        {
          id: 'policy-1',
          organizationId: null,
          resource: 'submission',
          retentionDays: 365,
          condition: null,
          isActive: true,
        },
      ];

      const mockSubmissions = [
        {
          id: 'sub-1',
          files: [
            { storageKey: 'org/sub/file1' },
            { storageKey: 'org/sub/file2' },
          ],
        },
        {
          id: 'sub-2',
          files: [{ storageKey: 'org/sub/file3' }],
        },
      ];

      (mockPrisma.retentionPolicy.findMany as jest.Mock).mockResolvedValue(
        mockPolicies,
      );
      (mockPrisma.submission.findMany as jest.Mock).mockResolvedValue(
        mockSubmissions,
      );
      (mockPrisma.submission.deleteMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      const result = await service.runRetentionPolicies();

      expect(result.totalRecordsDeleted).toBe(2);
      expect(result.totalFilesDeleted).toBe(3);
      expect(mockStorageService.deleteFile).toHaveBeenCalledTimes(3);
    });

    it('should handle policy enforcement errors gracefully', async () => {
      const mockPolicies = [
        {
          id: 'policy-1',
          organizationId: null,
          resource: 'submission',
          retentionDays: 365,
          condition: null,
          isActive: true,
        },
      ];

      (mockPrisma.retentionPolicy.findMany as jest.Mock).mockResolvedValue(
        mockPolicies,
      );
      (mockPrisma.submission.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.runRetentionPolicies();

      expect(result.hasErrors).toBe(true);
      expect(result.policies[0].errors).toContain('Database error');
    });

    it('should continue processing after file deletion errors', async () => {
      const mockPolicies = [
        {
          id: 'policy-1',
          organizationId: null,
          resource: 'submission',
          retentionDays: 365,
          condition: null,
          isActive: true,
        },
      ];

      const mockSubmissions = [
        {
          id: 'sub-1',
          files: [
            { storageKey: 'org/sub/file1' },
            { storageKey: 'org/sub/file2' },
          ],
        },
      ];

      (mockPrisma.retentionPolicy.findMany as jest.Mock).mockResolvedValue(
        mockPolicies,
      );
      (mockPrisma.submission.findMany as jest.Mock).mockResolvedValue(
        mockSubmissions,
      );
      (mockPrisma.submission.deleteMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      // First file deletion fails, second succeeds
      mockStorageService.deleteFile
        .mockRejectedValueOnce(new Error('Storage error'))
        .mockResolvedValueOnce(undefined);

      const result = await service.runRetentionPolicies();

      expect(result.totalFilesDeleted).toBe(1); // Only one successful deletion
      expect(result.policies[0].errors[0]).toContain('Failed to delete file');
      expect(mockStorageService.deleteFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('submission retention', () => {
    it('should delete old submissions based on cutoff date', async () => {
      const mockPolicies = [
        {
          id: 'policy-1',
          organizationId: null,
          resource: 'submission',
          retentionDays: 365,
          condition: null,
          isActive: true,
        },
      ];

      (mockPrisma.retentionPolicy.findMany as jest.Mock).mockResolvedValue(
        mockPolicies,
      );
      (mockPrisma.submission.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.submission.deleteMany as jest.Mock).mockResolvedValue({
        count: 10,
      });

      await service.runRetentionPolicies();

      expect(mockPrisma.submission.deleteMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          createdAt: { lt: expect.any(Date) },
        }),
      });
    });

    it('should apply status condition from policy', async () => {
      const mockPolicies = [
        {
          id: 'policy-1',
          organizationId: null,
          resource: 'submission',
          retentionDays: 365,
          condition: "status = 'REJECTED'",
          isActive: true,
        },
      ];

      (mockPrisma.retentionPolicy.findMany as jest.Mock).mockResolvedValue(
        mockPolicies,
      );
      (mockPrisma.submission.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.submission.deleteMany as jest.Mock).mockResolvedValue({
        count: 5,
      });

      await service.runRetentionPolicies();

      expect(mockPrisma.submission.deleteMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: 'REJECTED',
        }),
      });
    });

    it('should scope to organization when organizationId is set', async () => {
      const mockPolicies = [
        {
          id: 'policy-1',
          organizationId: 'org-123',
          resource: 'submission',
          retentionDays: 365,
          condition: null,
          isActive: true,
        },
      ];

      (mockPrisma.retentionPolicy.findMany as jest.Mock).mockResolvedValue(
        mockPolicies,
      );
      (mockPrisma.submission.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.submission.deleteMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      await service.runRetentionPolicies();

      expect(mockPrisma.submission.deleteMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          organizationId: 'org-123',
        }),
      });
    });
  });

  describe('audit event retention', () => {
    it('should delete old audit events', async () => {
      const mockPolicies = [
        {
          id: 'policy-1',
          organizationId: null,
          resource: 'audit_event',
          retentionDays: 730,
          condition: null,
          isActive: true,
        },
      ];

      (mockPrisma.retentionPolicy.findMany as jest.Mock).mockResolvedValue(
        mockPolicies,
      );
      (mockPrisma.auditEvent.deleteMany as jest.Mock).mockResolvedValue({
        count: 1000,
      });

      const result = await service.runRetentionPolicies();

      expect(result.policies[0].recordsDeleted).toBe(1000);
      expect(mockPrisma.auditEvent.deleteMany).toHaveBeenCalled();
    });
  });

  describe('DSAR request retention', () => {
    it('should only delete completed DSAR requests', async () => {
      const mockPolicies = [
        {
          id: 'policy-1',
          organizationId: null,
          resource: 'dsar_request',
          retentionDays: 365,
          condition: null,
          isActive: true,
        },
      ];

      (mockPrisma.retentionPolicy.findMany as jest.Mock).mockResolvedValue(
        mockPolicies,
      );
      (mockPrisma.dsarRequest.deleteMany as jest.Mock).mockResolvedValue({
        count: 50,
      });

      await service.runRetentionPolicies();

      expect(mockPrisma.dsarRequest.deleteMany).toHaveBeenCalledWith({
        where: {
          status: 'COMPLETED',
          completedAt: { lt: expect.any(Date) },
        },
      });
    });
  });

  describe('outbox event retention', () => {
    it('should only delete processed outbox events', async () => {
      const mockPolicies = [
        {
          id: 'policy-1',
          organizationId: null,
          resource: 'outbox_event',
          retentionDays: 30,
          condition: null,
          isActive: true,
        },
      ];

      (mockPrisma.retentionPolicy.findMany as jest.Mock).mockResolvedValue(
        mockPolicies,
      );
      (mockPrisma.outboxEvent.deleteMany as jest.Mock).mockResolvedValue({
        count: 200,
      });

      await service.runRetentionPolicies();

      expect(mockPrisma.outboxEvent.deleteMany).toHaveBeenCalledWith({
        where: {
          processedAt: { lt: expect.any(Date) },
          NOT: { processedAt: null },
        },
      });
    });
  });

  describe('webhook event retention', () => {
    it('should only delete processed webhook events', async () => {
      const mockPolicies = [
        {
          id: 'policy-1',
          organizationId: null,
          resource: 'stripe_webhook_event',
          retentionDays: 90,
          condition: null,
          isActive: true,
        },
      ];

      (mockPrisma.retentionPolicy.findMany as jest.Mock).mockResolvedValue(
        mockPolicies,
      );
      (mockPrisma.stripeWebhookEvent.deleteMany as jest.Mock).mockResolvedValue(
        { count: 150 },
      );

      await service.runRetentionPolicies();

      expect(mockPrisma.stripeWebhookEvent.deleteMany).toHaveBeenCalledWith({
        where: {
          processed: true,
          receivedAt: { lt: expect.any(Date) },
        },
      });
    });
  });

  describe('payment retention', () => {
    it('should NOT automatically delete payments', async () => {
      const mockPolicies = [
        {
          id: 'policy-1',
          organizationId: null,
          resource: 'payment',
          retentionDays: 365,
          condition: null,
          isActive: true,
        },
      ];

      (mockPrisma.retentionPolicy.findMany as jest.Mock).mockResolvedValue(
        mockPolicies,
      );

      const result = await service.runRetentionPolicies();

      // Should not delete any records for payments (legal/accounting requirement)
      expect(result.policies[0].recordsDeleted).toBe(0);
    });
  });

  describe('audit logging', () => {
    it('should log retention policy execution', async () => {
      const mockPolicies = [
        {
          id: 'policy-1',
          organizationId: null,
          resource: 'audit_event',
          retentionDays: 730,
          condition: null,
          isActive: true,
        },
      ];

      (mockPrisma.retentionPolicy.findMany as jest.Mock).mockResolvedValue(
        mockPolicies,
      );
      (mockPrisma.auditEvent.deleteMany as jest.Mock).mockResolvedValue({
        count: 100,
      });

      await service.runRetentionPolicies();

      expect(mockAuditService.logSafe).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'retention_policy.executed',
          resource: 'retention_policy',
          resourceId: 'policy-1',
          newValue: expect.objectContaining({
            recordsDeleted: 100,
            filesDeleted: 0,
          }),
        }),
      );
    });
  });

  describe('getDefaultPolicies', () => {
    it('should return recommended GDPR-compliant policies', () => {
      const defaults = service.getDefaultPolicies();

      expect(defaults).toContainEqual(
        expect.objectContaining({
          resource: 'submission',
          retentionDays: 365,
          condition: "status = 'REJECTED'",
        }),
      );

      expect(defaults).toContainEqual(
        expect.objectContaining({
          resource: 'audit_event',
          retentionDays: 730, // 24 months per GDPR Article 30
        }),
      );

      expect(defaults).toContainEqual(
        expect.objectContaining({
          resource: 'outbox_event',
          retentionDays: 30,
        }),
      );
    });
  });
});
