import { Test, TestingModule } from '@nestjs/testing';
import {
  AuditService,
  AuditActions,
  AuditResources,
} from '../../src/modules/audit';

// Mock Prisma
jest.mock('@prospector/db', () => ({
  prisma: {
    auditEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

import { prisma } from '@prospector/db';

describe('AuditService', () => {
  let service: AuditService;
  const mockPrisma = prisma as jest.Mocked<typeof prisma>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  describe('log', () => {
    it('should create an audit event with all required fields', async () => {
      const mockEvent = {
        id: 'audit-123',
        organizationId: 'org-456',
        actorId: 'user-789',
        action: AuditActions.USER_LOGIN,
        resource: AuditResources.USER,
        resourceId: 'user-789',
        oldValue: null,
        newValue: { loggedInAt: '2024-01-15T10:00:00Z' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        createdAt: new Date(),
      };

      (mockPrisma.auditEvent.create as jest.Mock).mockResolvedValue(mockEvent);

      const result = await service.log({
        organizationId: 'org-456',
        actorId: 'user-789',
        action: AuditActions.USER_LOGIN,
        resource: AuditResources.USER,
        resourceId: 'user-789',
        newValue: { loggedInAt: '2024-01-15T10:00:00Z' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(result).toBe('audit-123');
      expect(mockPrisma.auditEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-456',
          actorId: 'user-789',
          action: 'user.login',
          resource: 'user',
        }),
      });
    });

    it('should handle events without optional fields', async () => {
      const mockEvent = {
        id: 'audit-123',
        action: AuditActions.SUBMISSION_CREATED,
        resource: AuditResources.SUBMISSION,
        createdAt: new Date(),
      };

      (mockPrisma.auditEvent.create as jest.Mock).mockResolvedValue(mockEvent);

      const result = await service.log({
        action: AuditActions.SUBMISSION_CREATED,
        resource: AuditResources.SUBMISSION,
      });

      expect(result).toBe('audit-123');
    });

    it('should throw error when audit logging fails', async () => {
      (mockPrisma.auditEvent.create as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.log({
          action: AuditActions.USER_LOGIN,
          resource: AuditResources.USER,
        }),
      ).rejects.toThrow('Database error');
    });
  });

  describe('logSafe', () => {
    it('should return event ID on success', async () => {
      const mockEvent = { id: 'audit-123' };
      (mockPrisma.auditEvent.create as jest.Mock).mockResolvedValue(mockEvent);

      const result = await service.logSafe({
        action: AuditActions.USER_LOGIN,
        resource: AuditResources.USER,
      });

      expect(result).toBe('audit-123');
    });

    it('should return null on error without throwing', async () => {
      (mockPrisma.auditEvent.create as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.logSafe({
        action: AuditActions.USER_LOGIN,
        resource: AuditResources.USER,
      });

      expect(result).toBeNull();
    });
  });

  describe('query', () => {
    it('should query audit events with filters', async () => {
      const mockEvents = [
        {
          id: 'audit-1',
          action: AuditActions.SUBMISSION_CREATED,
          resource: AuditResources.SUBMISSION,
          createdAt: new Date(),
          actor: { id: 'user-1', email: 'user@example.com' },
        },
      ];

      (mockPrisma.auditEvent.findMany as jest.Mock).mockResolvedValue(
        mockEvents,
      );
      (mockPrisma.auditEvent.count as jest.Mock).mockResolvedValue(1);

      const result = await service.query({
        organizationId: 'org-123',
        actorId: 'user-1',
        limit: 50,
        offset: 0,
      });

      expect(result.events).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrisma.auditEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-123',
            actorId: 'user-1',
          }),
        }),
      );
    });

    it('should apply date filters correctly', async () => {
      (mockPrisma.auditEvent.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.auditEvent.count as jest.Mock).mockResolvedValue(0);

      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-01-31');

      await service.query({
        dateFrom,
        dateTo,
      });

      expect(mockPrisma.auditEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: dateFrom,
              lte: dateTo,
            },
          }),
        }),
      );
    });
  });

  describe('getResourceHistory', () => {
    it('should return audit history for a specific resource', async () => {
      const mockEvents = [
        {
          id: 'audit-1',
          action: AuditActions.SUBMISSION_UPDATED,
          resource: AuditResources.SUBMISSION,
          resourceId: 'sub-123',
          createdAt: new Date(),
          actor: { id: 'user-1', email: 'user@example.com' },
        },
      ];

      (mockPrisma.auditEvent.findMany as jest.Mock).mockResolvedValue(
        mockEvents,
      );

      const result = await service.getResourceHistory(
        AuditResources.SUBMISSION,
        'sub-123',
      );

      expect(result).toHaveLength(1);
      expect(mockPrisma.auditEvent.findMany).toHaveBeenCalledWith({
        where: {
          resource: 'submission',
          resourceId: 'sub-123',
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          actor: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });
    });
  });

  describe('getUserActivity', () => {
    it('should return user activity log for GDPR export', async () => {
      const mockEvents = [
        {
          id: 'audit-1',
          action: AuditActions.SUBMISSION_CREATED,
          resource: AuditResources.SUBMISSION,
          resourceId: 'sub-123',
          createdAt: new Date(),
          ipAddress: '192.168.1.1',
        },
      ];

      (mockPrisma.auditEvent.findMany as jest.Mock).mockResolvedValue(
        mockEvents,
      );

      const result = await service.getUserActivity('user-123');

      expect(result).toHaveLength(1);
      expect(mockPrisma.auditEvent.findMany).toHaveBeenCalledWith({
        where: { actorId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        take: 1000,
        select: expect.objectContaining({
          id: true,
          action: true,
          resource: true,
          // oldValue and newValue should NOT be included for privacy
        }),
      });
    });
  });

  describe('exportAsCsv', () => {
    it('should export audit events as CSV format', async () => {
      const mockEvents = [
        {
          id: 'audit-1',
          action: AuditActions.USER_LOGIN,
          resource: AuditResources.USER,
          resourceId: 'user-123',
          actorId: 'user-123',
          actor: { email: 'user@example.com' },
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          createdAt: new Date('2024-01-15T10:00:00Z'),
        },
      ];

      (mockPrisma.auditEvent.findMany as jest.Mock).mockResolvedValue(
        mockEvents,
      );
      (mockPrisma.auditEvent.count as jest.Mock).mockResolvedValue(1);

      const result = await service.exportAsCsv({ organizationId: 'org-123' });

      expect(result).toContain('id,created_at,action,resource');
      expect(result).toContain('audit-1');
      expect(result).toContain('user.login');
      expect(result).toContain('user@example.com');
    });

    it('should escape quotes in CSV values', async () => {
      const mockEvents = [
        {
          id: 'audit-1',
          action: 'custom.action',
          resource: 'resource',
          userAgent: 'Agent with "quotes"',
          createdAt: new Date('2024-01-15T10:00:00Z'),
        },
      ];

      (mockPrisma.auditEvent.findMany as jest.Mock).mockResolvedValue(
        mockEvents,
      );
      (mockPrisma.auditEvent.count as jest.Mock).mockResolvedValue(1);

      const result = await service.exportAsCsv({});

      // Double quotes should be escaped
      expect(result).toContain('""quotes""');
    });
  });
});

describe('AuditActions', () => {
  it('should have all required audit actions', () => {
    expect(AuditActions.USER_REGISTERED).toBe('user.registered');
    expect(AuditActions.USER_LOGIN).toBe('user.login');
    expect(AuditActions.SUBMISSION_CREATED).toBe('submission.created');
    expect(AuditActions.PAYMENT_COMPLETED).toBe('payment.completed');
    expect(AuditActions.GDPR_EXPORT_REQUESTED).toBe('gdpr.export_requested');
    expect(AuditActions.GDPR_ERASURE_COMPLETED).toBe('gdpr.erasure_completed');
    expect(AuditActions.CONSENT_GRANTED).toBe('consent.granted');
    expect(AuditActions.CONSENT_REVOKED).toBe('consent.revoked');
    expect(AuditActions.RETENTION_POLICY_CREATED).toBe(
      'retention_policy.created',
    );
  });
});

describe('AuditResources', () => {
  it('should have all required audit resources', () => {
    expect(AuditResources.USER).toBe('user');
    expect(AuditResources.SUBMISSION).toBe('submission');
    expect(AuditResources.PAYMENT).toBe('payment');
    expect(AuditResources.DSAR_REQUEST).toBe('dsar_request');
    expect(AuditResources.RETENTION_POLICY).toBe('retention_policy');
    expect(AuditResources.CONSENT).toBe('consent');
  });
});
