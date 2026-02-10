import { Module, Global, OnModuleInit } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { VirusScanProcessor } from './processors/virus-scan.processor';
import { VirusScanService } from './services/virus-scan.service';
import { RetentionProcessor } from './processors/retention.processor';
import { RetentionService } from './services/retention.service';
import { OutboxProcessor } from './processors/outbox.processor';
import { OutboxService } from './services/outbox.service';
import { AuditModule } from '../audit';
import { StorageModule } from '../storage';
import { EmailModule } from '../email';
import { VIRUS_SCAN_QUEUE, RETENTION_QUEUE, OUTBOX_QUEUE } from './constants';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          ...(configService.get('REDIS_PASSWORD')
            ? { password: configService.get('REDIS_PASSWORD') }
            : {}),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: VIRUS_SCAN_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 24 * 60 * 60, // Keep completed jobs for 24 hours
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
        },
      },
    }),
    BullModule.registerQueue({
      name: RETENTION_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60000, // 1 minute
        },
        removeOnComplete: {
          age: 7 * 24 * 60 * 60, // Keep completed jobs for 7 days
          count: 100,
        },
        removeOnFail: {
          age: 30 * 24 * 60 * 60, // Keep failed jobs for 30 days
        },
      },
    }),
    BullModule.registerQueue({
      name: OUTBOX_QUEUE,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 10000, // 10 seconds
        },
        removeOnComplete: {
          age: 24 * 60 * 60, // Keep completed jobs for 24 hours
          count: 5000,
        },
        removeOnFail: {
          age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
        },
      },
    }),
    AuditModule,
    StorageModule,
    EmailModule,
  ],
  providers: [
    VirusScanService,
    VirusScanProcessor,
    RetentionService,
    RetentionProcessor,
    OutboxService,
    OutboxProcessor,
  ],
  exports: [BullModule, VirusScanService, RetentionService, OutboxService],
})
export class JobsModule implements OnModuleInit {
  constructor(
    private readonly retentionProcessor: RetentionProcessor,
    private readonly outboxService: OutboxService,
  ) {}

  async onModuleInit() {
    // Schedule the daily retention job on startup
    await this.retentionProcessor.scheduleDaily();

    // Schedule outbox polling on startup
    await this.outboxService.schedulePolling();
  }
}
