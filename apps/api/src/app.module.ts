import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TrpcModule } from './trpc/trpc.module';
import { RedisModule } from './modules/redis';
import { AuthModule } from './modules/auth';
import { SecurityModule } from './modules/security';
import { StorageModule } from './modules/storage';
import { JobsModule } from './modules/jobs';
import { PaymentsModule } from './modules/payments';
import { EmailModule } from './modules/email';
import { AuditModule } from './modules/audit';
import { GdprModule } from './modules/gdpr';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    RedisModule,
    SecurityModule,
    EmailModule,
    AuditModule,
    GdprModule,
    JobsModule,
    StorageModule,
    PaymentsModule,
    AuthModule,
    TrpcModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
