import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { prisma, PrismaTransaction } from '@prospector/db';
import { OUTBOX_QUEUE } from '../constants';

export type OutboxEventType =
  | 'submission.submitted'
  | 'submission.accepted'
  | 'submission.rejected'
  | 'payment.completed'
  | 'payment.failed'
  | 'file.infected'
  | 'gdpr.export_ready'
  | 'gdpr.erasure_completed'
  | 'email.verification'
  | 'email.password_reset';

export interface OutboxEventPayload {
  eventType: OutboxEventType;
  recipientEmail?: string;
  recipientUserId?: string;
  subject?: string;
  templateName: string;
  templateData: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface OutboxEvent {
  id: string;
  eventType: string;
  payload: OutboxEventPayload;
  createdAt: Date;
  processedAt: Date | null;
  error: string | null;
  retryCount: number;
}

/**
 * Service for managing the transactional outbox pattern.
 *
 * The outbox pattern ensures reliable delivery of notifications:
 * 1. When an action occurs (e.g., submission accepted), an outbox event
 *    is created in the same transaction as the main action
 * 2. A background job polls for unprocessed events and sends them
 * 3. If sending fails, the event is retried with exponential backoff
 *
 * This guarantees that notifications are sent even if the system crashes
 * after the main action but before the notification is sent.
 */
@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(@InjectQueue(OUTBOX_QUEUE) private readonly outboxQueue: Queue) {}

  /**
   * Create an outbox event within a transaction
   *
   * Call this method within the same transaction as your main operation
   * to ensure atomic persistence.
   */
  async createEvent(
    payload: OutboxEventPayload,
    tx?: PrismaTransaction,
  ): Promise<string> {
    const db = tx ?? prisma;

    const event = await db.outboxEvent.create({
      data: {
        eventType: payload.eventType,
        payload: payload as unknown as Record<string, unknown>,
      },
    });

    this.logger.debug(
      `Outbox event created: ${event.id} (${payload.eventType})`,
    );

    return event.id;
  }

  /**
   * Get pending outbox events
   *
   * Returns events that haven't been processed yet or have failed
   * and are ready for retry.
   */
  async getPendingEvents(limit = 100): Promise<OutboxEvent[]> {
    const maxRetries = 5;

    const events = await prisma.outboxEvent.findMany({
      where: {
        processedAt: null,
        retryCount: { lt: maxRetries },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return events.map((e: (typeof events)[number]) => ({
      id: e.id,
      eventType: e.eventType,
      payload: e.payload as unknown as OutboxEventPayload,
      createdAt: e.createdAt,
      processedAt: e.processedAt,
      error: e.error,
      retryCount: e.retryCount,
    }));
  }

  /**
   * Mark an event as processed
   */
  async markProcessed(eventId: string): Promise<void> {
    await prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        processedAt: new Date(),
        error: null,
      },
    });

    this.logger.debug(`Outbox event processed: ${eventId}`);
  }

  /**
   * Mark an event as failed
   */
  async markFailed(eventId: string, error: string): Promise<void> {
    await prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        error,
        retryCount: { increment: 1 },
      },
    });

    this.logger.warn(`Outbox event failed: ${eventId} - ${error}`);
  }

  /**
   * Queue pending events for processing
   *
   * This is called by the outbox processor to queue events
   */
  async queuePendingEvents(): Promise<number> {
    const events = await this.getPendingEvents();

    for (const event of events) {
      await this.outboxQueue.add(
        'process-outbox-event',
        { eventId: event.id },
        {
          jobId: `outbox-${event.id}`,
          delay: this.calculateDelay(event.retryCount),
        },
      );
    }

    return events.length;
  }

  /**
   * Calculate delay for retry based on retry count (exponential backoff)
   */
  private calculateDelay(retryCount: number): number {
    if (retryCount === 0) return 0;
    // Exponential backoff: 10s, 30s, 90s, 270s, 810s (max ~13 minutes)
    return Math.min(10000 * Math.pow(3, retryCount - 1), 810000);
  }

  /**
   * Schedule polling job
   *
   * Call this on application startup to ensure regular polling
   */
  async schedulePolling(): Promise<void> {
    // Remove any existing repeatable jobs
    const repeatableJobs = await this.outboxQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.name === 'poll-outbox') {
        await this.outboxQueue.removeRepeatableByKey(job.key);
      }
    }

    // Poll every 30 seconds
    await this.outboxQueue.add(
      'poll-outbox',
      { scheduledAt: new Date().toISOString() },
      {
        repeat: {
          every: 30000, // 30 seconds
        },
        jobId: 'poll-outbox',
      },
    );

    this.logger.log('Outbox polling scheduled every 30 seconds');
  }
}
