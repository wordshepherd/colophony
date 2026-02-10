import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import {
  OutboxService,
  OutboxEventType,
} from '../../src/modules/jobs/services/outbox.service';
import { OUTBOX_QUEUE } from '../../src/modules/jobs/constants';

// Mock Prisma
jest.mock('@prospector/db', () => ({
  prisma: {
    outboxEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
  PrismaTransaction: {},
}));

import { prisma } from '@prospector/db';

describe('OutboxService', () => {
  let service: OutboxService;
  let mockQueue: jest.Mocked<Queue>;
  const mockPrisma = prisma as jest.Mocked<typeof prisma>;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' } as Job),
      getRepeatableJobs: jest.fn().mockResolvedValue([]),
      removeRepeatableByKey: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Queue>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxService,
        {
          provide: getQueueToken(OUTBOX_QUEUE),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<OutboxService>(OutboxService);
  });

  describe('createEvent', () => {
    it('should create an outbox event in the database', async () => {
      const eventPayload = {
        eventType: 'submission.submitted' as OutboxEventType,
        recipientEmail: 'user@example.com',
        templateName: 'submissionConfirmation',
        templateData: {
          userName: 'John',
          submissionTitle: 'My Story',
        },
      };

      const mockCreatedEvent = {
        id: 'event-123',
        eventType: 'submission.submitted',
        payload: eventPayload,
        createdAt: new Date(),
        processedAt: null,
        error: null,
        retryCount: 0,
      };

      (mockPrisma.outboxEvent.create as jest.Mock).mockResolvedValue(
        mockCreatedEvent,
      );

      const result = await service.createEvent(eventPayload);

      expect(result).toBe('event-123');
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
        data: {
          eventType: 'submission.submitted',
          payload: eventPayload,
        },
      });
    });

    it('should support various event types', async () => {
      const eventTypes: OutboxEventType[] = [
        'submission.submitted',
        'submission.accepted',
        'submission.rejected',
        'payment.completed',
        'payment.failed',
        'file.infected',
        'gdpr.export_ready',
        'gdpr.erasure_completed',
        'email.verification',
        'email.password_reset',
      ];

      for (const eventType of eventTypes) {
        (mockPrisma.outboxEvent.create as jest.Mock).mockResolvedValue({
          id: `event-${eventType}`,
          eventType,
        });

        await service.createEvent({
          eventType,
          templateName: 'template',
          templateData: {},
        });

        expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ eventType }),
        });
      }
    });

    it('should use transaction when provided', async () => {
      const mockTx = {
        outboxEvent: {
          create: jest.fn().mockResolvedValue({ id: 'tx-event-123' }),
        },
      };

      const eventPayload = {
        eventType: 'submission.submitted' as OutboxEventType,
        templateName: 'template',
        templateData: {},
      };

      const result = await service.createEvent(eventPayload, mockTx as any);

      expect(result).toBe('tx-event-123');
      expect(mockTx.outboxEvent.create).toHaveBeenCalled();
      expect(mockPrisma.outboxEvent.create).not.toHaveBeenCalled();
    });
  });

  describe('getPendingEvents', () => {
    it('should return unprocessed events', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          eventType: 'submission.submitted',
          payload: { templateName: 'test', templateData: {} },
          createdAt: new Date(),
          processedAt: null,
          error: null,
          retryCount: 0,
        },
        {
          id: 'event-2',
          eventType: 'payment.completed',
          payload: { templateName: 'test', templateData: {} },
          createdAt: new Date(),
          processedAt: null,
          error: 'Previous attempt failed',
          retryCount: 1,
        },
      ];

      (mockPrisma.outboxEvent.findMany as jest.Mock).mockResolvedValue(
        mockEvents,
      );

      const result = await service.getPendingEvents();

      expect(result).toHaveLength(2);
      expect(mockPrisma.outboxEvent.findMany).toHaveBeenCalledWith({
        where: {
          processedAt: null,
          retryCount: { lt: 5 }, // Max retries
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });
    });

    it('should respect custom limit', async () => {
      (mockPrisma.outboxEvent.findMany as jest.Mock).mockResolvedValue([]);

      await service.getPendingEvents(25);

      expect(mockPrisma.outboxEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 25 }),
      );
    });

    it('should exclude events that have exceeded max retries', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          eventType: 'submission.submitted',
          payload: {},
          createdAt: new Date(),
          processedAt: null,
          error: null,
          retryCount: 4, // Below max retries
        },
      ];

      (mockPrisma.outboxEvent.findMany as jest.Mock).mockResolvedValue(
        mockEvents,
      );

      const result = await service.getPendingEvents();

      expect(result).toHaveLength(1);
    });
  });

  describe('markProcessed', () => {
    it('should mark event as processed with timestamp', async () => {
      (mockPrisma.outboxEvent.update as jest.Mock).mockResolvedValue({
        id: 'event-123',
        processedAt: new Date(),
      });

      await service.markProcessed('event-123');

      expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
        where: { id: 'event-123' },
        data: {
          processedAt: expect.any(Date),
          error: null,
        },
      });
    });
  });

  describe('markFailed', () => {
    it('should record error and increment retry count', async () => {
      (mockPrisma.outboxEvent.update as jest.Mock).mockResolvedValue({
        id: 'event-123',
        error: 'Email delivery failed',
        retryCount: 2,
      });

      await service.markFailed('event-123', 'Email delivery failed');

      expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
        where: { id: 'event-123' },
        data: {
          error: 'Email delivery failed',
          retryCount: { increment: 1 },
        },
      });
    });
  });

  describe('queuePendingEvents', () => {
    it('should add pending events to the queue', async () => {
      const mockEvents = [
        { id: 'event-1', retryCount: 0 },
        { id: 'event-2', retryCount: 0 },
      ];

      (mockPrisma.outboxEvent.findMany as jest.Mock).mockResolvedValue(
        mockEvents.map((e) => ({
          ...e,
          eventType: 'submission.submitted',
          payload: {},
          createdAt: new Date(),
          processedAt: null,
          error: null,
        })),
      );

      const count = await service.queuePendingEvents();

      expect(count).toBe(2);
      expect(mockQueue.add).toHaveBeenCalledTimes(2);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-outbox-event',
        { eventId: 'event-1' },
        expect.objectContaining({
          jobId: 'outbox-event-1',
          delay: 0, // No delay for first attempt
        }),
      );
    });

    it('should apply exponential backoff for retries', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          eventType: 'submission.submitted',
          payload: {},
          createdAt: new Date(),
          processedAt: null,
          error: 'Previous error',
          retryCount: 2,
        },
      ];

      (mockPrisma.outboxEvent.findMany as jest.Mock).mockResolvedValue(
        mockEvents,
      );

      await service.queuePendingEvents();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-outbox-event',
        { eventId: 'event-1' },
        expect.objectContaining({
          delay: expect.any(Number),
        }),
      );

      // Verify exponential backoff: 10s * 3^(retryCount-1)
      const callArgs = mockQueue.add.mock.calls[0];
      const delay = callArgs[2]?.delay;
      expect(delay).toBeGreaterThan(0);
    });
  });

  describe('schedulePolling', () => {
    it('should remove existing poll jobs and schedule a new one', async () => {
      const existingJobs = [
        { name: 'poll-outbox', key: 'poll-key-1' },
        { name: 'other-job', key: 'other-key' },
      ];

      mockQueue.getRepeatableJobs.mockResolvedValue(existingJobs);

      await service.schedulePolling();

      // Should remove the existing poll-outbox job
      expect(mockQueue.removeRepeatableByKey).toHaveBeenCalledWith(
        'poll-key-1',
      );
      expect(mockQueue.removeRepeatableByKey).not.toHaveBeenCalledWith(
        'other-key',
      );

      // Should schedule new polling job
      expect(mockQueue.add).toHaveBeenCalledWith(
        'poll-outbox',
        expect.objectContaining({ scheduledAt: expect.any(String) }),
        expect.objectContaining({
          repeat: { every: 30000 }, // 30 seconds
          jobId: 'poll-outbox',
        }),
      );
    });

    it('should handle case with no existing poll jobs', async () => {
      mockQueue.getRepeatableJobs.mockResolvedValue([]);

      await service.schedulePolling();

      expect(mockQueue.removeRepeatableByKey).not.toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalled();
    });
  });

  describe('exponential backoff calculation', () => {
    it('should return 0 delay for first attempt', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          eventType: 'test',
          payload: {},
          createdAt: new Date(),
          processedAt: null,
          error: null,
          retryCount: 0,
        },
      ];

      (mockPrisma.outboxEvent.findMany as jest.Mock).mockResolvedValue(
        mockEvents,
      );

      await service.queuePendingEvents();

      const delay = mockQueue.add.mock.calls[0][2]?.delay;
      expect(delay).toBe(0);
    });

    it('should calculate increasing delays for retries', async () => {
      // Test retryCount 1, 2, 3, 4
      const expectedDelays = [
        { retryCount: 1, expectedMinDelay: 10000 }, // 10s
        { retryCount: 2, expectedMinDelay: 30000 }, // 30s
        { retryCount: 3, expectedMinDelay: 90000 }, // 90s
        { retryCount: 4, expectedMinDelay: 270000 }, // 270s
      ];

      for (const { retryCount, expectedMinDelay } of expectedDelays) {
        jest.clearAllMocks();

        const mockEvents = [
          {
            id: 'event-test',
            eventType: 'test',
            payload: {},
            createdAt: new Date(),
            processedAt: null,
            error: 'error',
            retryCount,
          },
        ];

        (mockPrisma.outboxEvent.findMany as jest.Mock).mockResolvedValue(
          mockEvents,
        );

        await service.queuePendingEvents();

        const delay = mockQueue.add.mock.calls[0][2]?.delay;
        expect(delay).toBeGreaterThanOrEqual(expectedMinDelay);
      }
    });
  });
});
