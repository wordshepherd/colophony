import { Module, Global } from '@nestjs/common';
import { StorageService } from './storage.service';
import { TusdWebhookController } from './tusd-webhook.controller';

@Global()
@Module({
  controllers: [TusdWebhookController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
