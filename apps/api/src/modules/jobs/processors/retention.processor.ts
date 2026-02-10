import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import {
  RetentionService,
  RetentionRunResult,
} from '../services/retention.service';
import { RETENTION_QUEUE } from '../constants';

export interface RetentionJobData {
  scheduledAt: string;
  manual?: boolean;
}

/**
 * Processor for retention policy enforcement.
 *
 * This processor runs retention policies on a schedule (daily).
 * It ensures data is deleted according to configured retention policies,
 * maintaining GDPR compliance.
 */
@Injectable()
@Processor(RETENTION_QUEUE)
export class RetentionProcessor extends WorkerHost {
  private readonly logger = new Logger(RetentionProcessor.name);

  constructor(
    private readonly retentionService: RetentionService,
    @InjectQueue(RETENTION_QUEUE) private readonly retentionQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<RetentionJobData>): Promise<RetentionRunResult> {
    const { scheduledAt, manual } = job.data;

    this.logger.log(
      `Processing retention job ${job.id}, scheduled: ${scheduledAt}, manual: ${manual ?? false}`,
    );

    try {
      const result = await this.retentionService.runRetentionPolicies();

      if (result.hasErrors) {
        this.logger.warn(
          `Retention run completed with errors: ${JSON.stringify(result)}`,
        );
      } else {
        this.logger.log(
          `Retention run completed: ${result.totalRecordsDeleted} records, ${result.totalFilesDeleted} files deleted`,
        );
      }

      return result;
    } catch (error) {
      this.logger.error(`Retention job ${job.id} failed: ${error}`);
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<RetentionJobData>, result: RetentionRunResult) {
    this.logger.log(
      `Retention job ${job.id} completed: ${result.totalRecordsDeleted} records deleted`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<RetentionJobData>, error: Error) {
    this.logger.error(`Retention job ${job.id} failed: ${error.message}`);
  }

  /**
   * Schedule a retention job to run immediately (for manual triggers)
   */
  async triggerManualRun(): Promise<string> {
    const job = await this.retentionQueue.add(
      'manual-retention',
      {
        scheduledAt: new Date().toISOString(),
        manual: true,
      },
      {
        jobId: `manual-${Date.now()}`,
      },
    );

    this.logger.log(`Manual retention job queued: ${job.id}`);
    return job.id ?? 'unknown';
  }

  /**
   * Schedule daily retention job
   *
   * Call this on application startup to ensure the daily job is scheduled.
   */
  async scheduleDaily(): Promise<void> {
    // Remove any existing repeatable jobs to avoid duplicates
    const repeatableJobs = await this.retentionQueue.getRepeatableJobs();
    for (const repeatableJob of repeatableJobs) {
      if (repeatableJob.name === 'daily-retention') {
        await this.retentionQueue.removeRepeatableByKey(repeatableJob.key);
      }
    }

    // Schedule daily at 3 AM UTC
    await this.retentionQueue.add(
      'daily-retention',
      {
        scheduledAt: new Date().toISOString(),
        manual: false,
      },
      {
        repeat: {
          pattern: '0 3 * * *', // 3 AM UTC daily
        },
        jobId: 'daily-retention',
      },
    );

    this.logger.log('Daily retention job scheduled for 3 AM UTC');
  }
}
