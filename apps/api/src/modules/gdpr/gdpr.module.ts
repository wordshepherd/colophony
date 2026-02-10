import { Module, Global } from '@nestjs/common';
import { GdprService } from './gdpr.service';
import { AuditModule } from '../audit';
import { StorageModule } from '../storage';

@Global()
@Module({
  imports: [AuditModule, StorageModule],
  providers: [GdprService],
  exports: [GdprService],
})
export class GdprModule {}
