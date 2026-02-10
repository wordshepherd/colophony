import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TrpcController } from './trpc.controller';
import { AuthService } from '../modules/auth';
import { StorageService } from '../modules/storage';
import { AuditService } from '../modules/audit';
import { GdprService } from '../modules/gdpr';
import { trpcRegistry } from './trpc.registry';

/**
 * tRPC Module
 *
 * This module exposes tRPC endpoints through a NestJS controller.
 * The controller handles HTTP requests and routes them to tRPC procedures.
 *
 * On initialization, it registers NestJS services with the tRPC registry
 * so they can be accessed from tRPC procedures.
 */
@Module({
  controllers: [TrpcController],
  providers: [],
  exports: [],
})
export class TrpcModule implements OnModuleInit {
  constructor(
    private readonly authService: AuthService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly gdprService: GdprService,
  ) {}

  onModuleInit() {
    // Register services with tRPC registry
    trpcRegistry.registerAuthService(this.authService);
    trpcRegistry.registerStorageService(this.storageService);
    trpcRegistry.registerConfigService(this.configService);
    trpcRegistry.registerAuditService(this.auditService);
    trpcRegistry.registerGdprService(this.gdprService);
  }
}
