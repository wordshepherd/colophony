import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OutboxService, OutboxEventPayload } from '../services/outbox.service';
import { EmailService } from '../../email/email.service';
import { EmailTemplateService } from '../../email/email-template.service';
import { OUTBOX_QUEUE } from '../constants';
import { prisma } from '@prospector/db';

export interface ProcessOutboxEventData {
  eventId: string;
}

export interface PollOutboxData {
  scheduledAt: string;
}

/**
 * Processor for the transactional outbox pattern.
 *
 * This processor handles two types of jobs:
 * 1. poll-outbox: Periodically polls for pending events and queues them
 * 2. process-outbox-event: Processes individual outbox events (sends emails)
 */
@Injectable()
@Processor(OUTBOX_QUEUE)
export class OutboxProcessor extends WorkerHost {
  private readonly logger = new Logger(OutboxProcessor.name);

  constructor(
    private readonly outboxService: OutboxService,
    private readonly emailService: EmailService,
    private readonly emailTemplateService: EmailTemplateService,
  ) {
    super();
  }

  async process(
    job: Job<ProcessOutboxEventData | PollOutboxData>,
  ): Promise<unknown> {
    if (job.name === 'poll-outbox') {
      return this.handlePollOutbox();
    }

    if (job.name === 'process-outbox-event') {
      const data = job.data as ProcessOutboxEventData;
      return this.handleProcessEvent(data.eventId);
    }

    this.logger.warn(`Unknown job name: ${job.name}`);
    return null;
  }

  /**
   * Poll for pending events and queue them for processing
   */
  private async handlePollOutbox(): Promise<number> {
    const count = await this.outboxService.queuePendingEvents();
    if (count > 0) {
      this.logger.debug(`Queued ${count} outbox events for processing`);
    }
    return count;
  }

  /**
   * Process a single outbox event
   */
  private async handleProcessEvent(eventId: string): Promise<void> {
    const event = await prisma.outboxEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      this.logger.warn(`Outbox event not found: ${eventId}`);
      return;
    }

    if (event.processedAt) {
      this.logger.debug(`Outbox event already processed: ${eventId}`);
      return;
    }

    const payload = event.payload as unknown as OutboxEventPayload;

    try {
      await this.sendNotification(payload);
      await this.outboxService.markProcessed(eventId);
      this.logger.log(
        `Outbox event processed: ${eventId} (${payload.eventType})`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await this.outboxService.markFailed(eventId, errorMessage);
      throw error; // Re-throw to trigger BullMQ retry
    }
  }

  /**
   * Send notification based on event type
   */
  private async sendNotification(payload: OutboxEventPayload): Promise<void> {
    const { recipientEmail, recipientUserId, templateName, templateData } =
      payload;

    // Get recipient email
    let email = recipientEmail;
    if (!email && recipientUserId) {
      const user = await prisma.user.findUnique({
        where: { id: recipientUserId },
        select: { email: true },
      });
      email = user?.email;
    }

    if (!email) {
      throw new Error('No recipient email available');
    }

    // Generate email content from template
    const emailContent = this.getEmailContent(templateName, templateData);

    // Send email
    await this.emailService.sendEmail({
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });
  }

  /**
   * Get email content from template
   */
  private getEmailContent(
    templateName: string,
    templateData: Record<string, unknown>,
  ): { subject: string; html: string; text: string } {
    switch (templateName) {
      case 'submission_submitted':
        return this.emailTemplateService.submissionConfirmationEmail({
          userName: templateData.userName as string,
          submissionTitle: templateData.submissionTitle as string,
          submissionId: templateData.submissionId as string,
          organizationName: templateData.organizationName as string,
        });

      case 'submission_accepted':
        return this.emailTemplateService.submissionStatusChangeEmail({
          userName: templateData.userName as string,
          submissionTitle: templateData.submissionTitle as string,
          submissionId: templateData.submissionId as string,
          previousStatus: templateData.previousStatus as string,
          newStatus: 'ACCEPTED',
          organizationName: templateData.organizationName as string,
          comment: templateData.message as string | undefined,
        });

      case 'submission_rejected':
        return this.emailTemplateService.submissionStatusChangeEmail({
          userName: templateData.userName as string,
          submissionTitle: templateData.submissionTitle as string,
          submissionId: templateData.submissionId as string,
          previousStatus: templateData.previousStatus as string,
          newStatus: 'REJECTED',
          organizationName: templateData.organizationName as string,
          comment: templateData.message as string | undefined,
        });

      case 'payment_completed':
        return this.emailTemplateService.paymentConfirmationEmail({
          userName: templateData.userName as string,
          amount: templateData.amount as string,
          currency: templateData.currency as string,
          submissionTitle: templateData.submissionTitle as string,
          organizationName: templateData.organizationName as string,
        });

      case 'file_infected':
        return this.emailTemplateService.infectedFileAlertEmail({
          userName: templateData.userName as string,
          fileName: templateData.filename as string,
          submissionTitle: templateData.submissionTitle as string,
          virusName: templateData.virusName as string,
        });

      case 'gdpr_export_ready':
        return {
          subject: 'Your data export is ready',
          html: `
            <p>Hello ${templateData.userName},</p>
            <p>Your data export is ready for download.</p>
            <p>You can download it from your account settings within the next 7 days.</p>
            <p>Best regards,<br>The Team</p>
          `,
          text: `Hello ${templateData.userName},\n\nYour data export is ready for download.\n\nYou can download it from your account settings within the next 7 days.\n\nBest regards,\nThe Team`,
        };

      case 'gdpr_erasure_completed':
        return {
          subject: 'Your account has been deleted',
          html: `
            <p>Hello,</p>
            <p>As requested, your account and all associated data has been permanently deleted.</p>
            <p>If you did not request this deletion, please contact support immediately.</p>
            <p>Best regards,<br>The Team</p>
          `,
          text: `Hello,\n\nAs requested, your account and all associated data has been permanently deleted.\n\nIf you did not request this deletion, please contact support immediately.\n\nBest regards,\nThe Team`,
        };

      default:
        // Generic notification
        return {
          subject: (templateData.subject as string) || 'Notification',
          html: `
            <p>Hello ${templateData.userName || ''},</p>
            <p>${templateData.message || 'You have a new notification.'}</p>
            <p>Best regards,<br>The Team</p>
          `,
          text: `Hello ${templateData.userName || ''},\n\n${templateData.message || 'You have a new notification.'}\n\nBest regards,\nThe Team`,
        };
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    if (job.name !== 'poll-outbox') {
      this.logger.debug(`Outbox job ${job.id} completed`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Outbox job ${job.id} failed: ${error.message}`);
  }
}
