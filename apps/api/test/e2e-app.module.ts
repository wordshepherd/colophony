import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { TrpcModule } from '../src/trpc/trpc.module';
import { RedisModule } from '../src/modules/redis';
import { AuthModule } from '../src/modules/auth';
import { SecurityModule } from '../src/modules/security';
import { StorageModule } from '../src/modules/storage';
import { EmailModule } from '../src/modules/email';
import { AuditModule } from '../src/modules/audit';
import { GdprModule } from '../src/modules/gdpr';
import { PaymentsModule } from '../src/modules/payments';
import { VirusScanService } from '../src/modules/jobs';

/**
 * Provides a mock VirusScanService globally.
 *
 * StorageModule's TusdWebhookController depends on VirusScanService (from JobsModule).
 * Since E2E tests exclude JobsModule (to avoid BullMQ queue connections),
 * we provide a no-op mock here.
 */
@Global()
@Module({
  providers: [
    {
      provide: VirusScanService,
      useValue: {
        queueScan: async () => 'mock-job-id',
        isEnabled: () => false,
        ping: async () => false,
      },
    },
  ],
  exports: [VirusScanService],
})
class MockJobsModule {}

/**
 * E2E Test Application Module
 *
 * Same as AppModule but excludes JobsModule (BullMQ background processing).
 * E2E tests don't need virus scanning, retention jobs, or outbox processing.
 * This also avoids requiring BullMQ Redis queue connections during tests.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    MockJobsModule,
    RedisModule,
    SecurityModule,
    EmailModule,
    AuditModule,
    GdprModule,
    StorageModule,
    PaymentsModule,
    AuthModule,
    TrpcModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class E2eAppModule {}
