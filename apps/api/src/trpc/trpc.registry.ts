import { ConfigService } from '@nestjs/config';
import { AuthService } from '../modules/auth';
import { StorageService } from '../modules/storage';
import { AuditService } from '../modules/audit';
import { GdprService } from '../modules/gdpr';

/**
 * Service registry for tRPC routers.
 *
 * tRPC routers are pure functions that don't have direct access to NestJS DI.
 * This registry provides a way to access NestJS services from tRPC procedures.
 *
 * Services are registered during app bootstrap and accessed via getters.
 */
class TrpcServiceRegistry {
  private _authService: AuthService | null = null;
  private _storageService: StorageService | null = null;
  private _configService: ConfigService | null = null;
  private _auditService: AuditService | null = null;
  private _gdprService: GdprService | null = null;

  registerAuthService(service: AuthService): void {
    this._authService = service;
  }

  registerStorageService(service: StorageService): void {
    this._storageService = service;
  }

  registerConfigService(service: ConfigService): void {
    this._configService = service;
  }

  registerAuditService(service: AuditService): void {
    this._auditService = service;
  }

  registerGdprService(service: GdprService): void {
    this._gdprService = service;
  }

  get authService(): AuthService {
    if (!this._authService) {
      throw new Error(
        'AuthService not registered. Ensure TrpcModule is properly initialized.',
      );
    }
    return this._authService;
  }

  get storageService(): StorageService {
    if (!this._storageService) {
      throw new Error(
        'StorageService not registered. Ensure TrpcModule is properly initialized.',
      );
    }
    return this._storageService;
  }

  get configService(): ConfigService {
    if (!this._configService) {
      throw new Error(
        'ConfigService not registered. Ensure TrpcModule is properly initialized.',
      );
    }
    return this._configService;
  }

  get auditService(): AuditService {
    if (!this._auditService) {
      throw new Error(
        'AuditService not registered. Ensure TrpcModule is properly initialized.',
      );
    }
    return this._auditService;
  }

  get gdprService(): GdprService {
    if (!this._gdprService) {
      throw new Error(
        'GdprService not registered. Ensure TrpcModule is properly initialized.',
      );
    }
    return this._gdprService;
  }
}

export const trpcRegistry = new TrpcServiceRegistry();
