import { Test, TestingModule } from '@nestjs/testing';
import { GdprService } from '../../src/modules/gdpr/gdpr.service';
import { AuditService } from '../../src/modules/audit';
import { StorageService } from '../../src/modules/storage';

// Mock Prisma
jest.mock('@prospector/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      findMany: jest.fn(),
    },
    userConsent: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    dsarRequest: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    submission: {
      update: jest.fn(),
    },
    submissionFile: {
      deleteMany: jest.fn(),
    },
    organizationMember: {
      deleteMany: jest.fn(),
    },
    userIdentity: {
      deleteMany: jest.fn(),
    },
    auditEvent: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        submissionFile: { deleteMany: jest.fn() },
        submission: { update: jest.fn() },
        organizationMember: { deleteMany: jest.fn() },
        userIdentity: { deleteMany: jest.fn() },
        userConsent: { deleteMany: jest.fn() },
        user: { update: jest.fn() },
        auditEvent: { updateMany: jest.fn() },
      }),
    ),
  },
  PrismaTransaction: {},
}));

import { prisma } from '@prospector/db';

describe('GdprService', () => {
  let service: GdprService;
  let mockAuditService: jest.Mocked<AuditService>;
  let mockStorageService: jest.Mocked<StorageService>;
  const mockPrisma = prisma as jest.Mocked<typeof prisma>;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockAuditService = {
      log: jest.fn().mockResolvedValue('audit-id'),
      logSafe: jest.fn().mockResolvedValue('audit-id'),
      getUserActivity: jest.fn().mockResolvedValue([]),
      query: jest.fn(),
      getResourceHistory: jest.fn(),
      exportAsCsv: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    mockStorageService = {
      deleteFile: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<StorageService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GdprService,
        { provide: AuditService, useValue: mockAuditService },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<GdprService>(GdprService);
  });

  describe('exportUserData', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      createdAt: new Date(),
      deletedAt: null,
      submissions: [
        {
          id: 'sub-1',
          organizationId: 'org-1',
          title: 'My Story',
          content: 'Story content',
          coverLetter: 'Cover letter',
          status: 'SUBMITTED',
          submittedAt: new Date(),
          createdAt: new Date(),
          files: [
            {
              id: 'file-1',
              filename: 'story.pdf',
              mimeType: 'application/pdf',
              size: BigInt(12345),
              uploadedAt: new Date(),
            },
          ],
        },
      ],
      memberships: [
        {
          role: 'READER',
          createdAt: new Date(),
          organization: {
            id: 'org-1',
            name: 'Literary Magazine',
            slug: 'literary-mag',
          },
        },
      ],
    };

    it('should export all user data', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (mockPrisma.payment.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'pay-1',
          organizationId: 'org-1',
          submissionId: 'sub-1',
          amount: 2500,
          currency: 'usd',
          status: 'SUCCEEDED',
          createdAt: new Date(),
        },
      ]);
      (mockPrisma.userConsent.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'consent-1',
          organizationId: 'org-1',
          consentType: 'terms_of_service',
          granted: true,
          grantedAt: new Date(),
          revokedAt: null,
        },
      ]);
      mockAuditService.getUserActivity.mockResolvedValue([
        {
          id: 'audit-1',
          action: 'submission.created',
          resource: 'submission',
          resourceId: 'sub-1',
          createdAt: new Date(),
          ipAddress: '192.168.1.1',
        },
      ]);

      const result = await service.exportUserData('user-123');

      expect(result.profile.id).toBe('user-123');
      expect(result.profile.email).toBe('test@example.com');
      expect(result.submissions).toHaveLength(1);
      expect(result.submissions[0].title).toBe('My Story');
      expect(result.submissions[0].files).toHaveLength(1);
      expect(result.payments).toHaveLength(1);
      expect(result.consents).toHaveLength(1);
      expect(result.auditLog).toHaveLength(1);
      expect(result.organizations).toHaveLength(1);
    });

    it('should throw error when user not found', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.exportUserData('non-existent')).rejects.toThrow(
        'User not found',
      );
    });

    it('should include file sizes as strings', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (mockPrisma.payment.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.userConsent.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.exportUserData('user-123');

      expect(typeof result.submissions[0].files[0].size).toBe('string');
      expect(result.submissions[0].files[0].size).toBe('12345');
    });
  });

  describe('exportUserDataAsZip', () => {
    it('should generate a ZIP file containing JSON files', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        createdAt: new Date(),
        deletedAt: null,
        submissions: [],
        memberships: [],
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (mockPrisma.payment.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.userConsent.findMany as jest.Mock).mockResolvedValue([]);
      mockAuditService.getUserActivity.mockResolvedValue([]);

      const result = await service.exportUserDataAsZip('user-123');

      // Should return a Buffer
      expect(Buffer.isBuffer(result)).toBe(true);
      // Should contain ZIP magic bytes (PK)
      expect(result[0]).toBe(0x50); // 'P'
      expect(result[1]).toBe(0x4b); // 'K'
    });
  });

  describe('deleteUserData', () => {
    const mockUserWithData = {
      id: 'user-123',
      email: 'test@example.com',
      deletedAt: null,
      submissions: [
        {
          id: 'sub-1',
          files: [
            { id: 'file-1', storageKey: 'org/sub/file1' },
            { id: 'file-2', storageKey: 'org/sub/file2' },
          ],
        },
      ],
      memberships: [{ id: 'member-1' }],
    };

    it('should anonymize user data and delete files', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(
        mockUserWithData,
      );

      await service.deleteUserData('user-123');

      // Should have deleted files from storage
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith(
        'org/sub/file1',
      );
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith(
        'org/sub/file2',
      );

      // Should have logged the erasure
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'gdpr.erasure_completed',
          resource: 'user',
          resourceId: 'user-123',
        }),
      );
    });

    it('should throw error when user not found', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.deleteUserData('non-existent')).rejects.toThrow(
        'User not found',
      );
    });

    it('should throw error when user already deleted', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUserWithData,
        deletedAt: new Date(),
      });

      await expect(service.deleteUserData('user-123')).rejects.toThrow(
        'User data has already been deleted',
      );
    });

    it('should continue deletion even if file storage deletion fails', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(
        mockUserWithData,
      );
      mockStorageService.deleteFile.mockRejectedValue(
        new Error('Storage error'),
      );

      // Should not throw
      await expect(service.deleteUserData('user-123')).resolves.not.toThrow();

      // Audit should still be logged
      expect(mockAuditService.log).toHaveBeenCalled();
    });
  });

  describe('createDsarRequest', () => {
    it('should create a DSAR request with 30-day deadline', async () => {
      const mockRequest = {
        id: 'dsar-123',
        userId: 'user-123',
        type: 'ACCESS',
        status: 'PENDING',
        dueAt: new Date(),
        notes: null,
      };

      (mockPrisma.dsarRequest.create as jest.Mock).mockResolvedValue(
        mockRequest,
      );

      const result = await service.createDsarRequest({
        userId: 'user-123',
        type: 'ACCESS',
      });

      expect(result.id).toBe('dsar-123');
      expect(result.dueAt).toBeInstanceOf(Date);

      // Verify due date is ~30 days in the future
      const daysDifference = Math.round(
        (result.dueAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      expect(daysDifference).toBeGreaterThanOrEqual(29);
      expect(daysDifference).toBeLessThanOrEqual(31);
    });

    it('should create erasure DSAR request', async () => {
      const mockRequest = {
        id: 'dsar-456',
        userId: 'user-123',
        type: 'ERASURE',
        status: 'PENDING',
        dueAt: new Date(),
        notes: 'User requested account deletion',
      };

      (mockPrisma.dsarRequest.create as jest.Mock).mockResolvedValue(
        mockRequest,
      );

      const result = await service.createDsarRequest({
        userId: 'user-123',
        type: 'ERASURE',
        notes: 'User requested account deletion',
      });

      expect(result.id).toBe('dsar-456');
      expect(mockPrisma.dsarRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          type: 'ERASURE',
          status: 'PENDING',
          notes: 'User requested account deletion',
        }),
      });
    });

    it('should log audit event for DSAR creation', async () => {
      const mockRequest = {
        id: 'dsar-789',
        userId: 'user-123',
        type: 'ACCESS',
        status: 'PENDING',
        dueAt: new Date(),
      };

      (mockPrisma.dsarRequest.create as jest.Mock).mockResolvedValue(
        mockRequest,
      );

      await service.createDsarRequest({
        userId: 'user-123',
        type: 'ACCESS',
      });

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'user-123',
          action: 'gdpr.export_requested',
          resource: 'dsar_request',
          resourceId: 'dsar-789',
        }),
      );
    });
  });

  describe('getUserDsarRequests', () => {
    it('should return all DSAR requests for a user', async () => {
      const mockRequests = [
        {
          id: 'dsar-1',
          type: 'ACCESS',
          status: 'COMPLETED',
          requestedAt: new Date(),
        },
        {
          id: 'dsar-2',
          type: 'ERASURE',
          status: 'PENDING',
          requestedAt: new Date(),
        },
      ];

      (mockPrisma.dsarRequest.findMany as jest.Mock).mockResolvedValue(
        mockRequests,
      );

      const result = await service.getUserDsarRequests('user-123');

      expect(result).toHaveLength(2);
      expect(mockPrisma.dsarRequest.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { requestedAt: 'desc' },
      });
    });
  });

  describe('getDsarRequest', () => {
    it('should return DSAR request if it belongs to user', async () => {
      const mockRequest = {
        id: 'dsar-123',
        userId: 'user-123',
        type: 'ACCESS',
        status: 'PENDING',
      };

      (mockPrisma.dsarRequest.findUnique as jest.Mock).mockResolvedValue(
        mockRequest,
      );

      const result = await service.getDsarRequest('dsar-123', 'user-123');

      expect(result).toEqual(mockRequest);
    });

    it('should return null if DSAR belongs to different user', async () => {
      const mockRequest = {
        id: 'dsar-123',
        userId: 'other-user',
        type: 'ACCESS',
        status: 'PENDING',
      };

      (mockPrisma.dsarRequest.findUnique as jest.Mock).mockResolvedValue(
        mockRequest,
      );

      const result = await service.getDsarRequest('dsar-123', 'user-123');

      expect(result).toBeNull();
    });
  });

  describe('completeDsarRequest', () => {
    it('should complete an erasure DSAR by deleting user data', async () => {
      const mockRequest = {
        id: 'dsar-123',
        userId: 'user-123',
        type: 'ERASURE',
        status: 'PENDING',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        deletedAt: null,
        submissions: [],
        memberships: [],
      };

      (mockPrisma.dsarRequest.findUnique as jest.Mock).mockResolvedValue(
        mockRequest,
      );
      (mockPrisma.dsarRequest.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await service.completeDsarRequest('dsar-123');

      // Should have updated status to IN_PROGRESS then COMPLETED
      expect(mockPrisma.dsarRequest.update).toHaveBeenCalledWith({
        where: { id: 'dsar-123' },
        data: { status: 'IN_PROGRESS' },
      });

      // Should have logged completion
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'gdpr.export_completed',
          resource: 'dsar_request',
          resourceId: 'dsar-123',
        }),
      );
    });

    it('should throw error for already completed DSAR', async () => {
      const mockRequest = {
        id: 'dsar-123',
        userId: 'user-123',
        type: 'ACCESS',
        status: 'COMPLETED',
      };

      (mockPrisma.dsarRequest.findUnique as jest.Mock).mockResolvedValue(
        mockRequest,
      );

      await expect(service.completeDsarRequest('dsar-123')).rejects.toThrow(
        'DSAR request already completed',
      );
    });
  });

  describe('getPendingDsarRequests', () => {
    it('should return pending DSARs approaching their due date', async () => {
      const mockRequests = [
        {
          id: 'dsar-1',
          userId: 'user-1',
          type: 'ACCESS',
          status: 'PENDING',
          dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
          user: { id: 'user-1', email: 'user1@example.com' },
        },
      ];

      (mockPrisma.dsarRequest.findMany as jest.Mock).mockResolvedValue(
        mockRequests,
      );

      const result = await service.getPendingDsarRequests(7);

      expect(result).toHaveLength(1);
      expect(mockPrisma.dsarRequest.findMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          dueAt: { lte: expect.any(Date) },
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
    });
  });
});
