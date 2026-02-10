import { Module, Global } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { PaymentsService } from './payments.service';
import { StripeWebhookController } from './stripe-webhook.controller';

@Global()
@Module({
  controllers: [StripeWebhookController],
  providers: [StripeService, PaymentsService],
  exports: [StripeService, PaymentsService],
})
export class PaymentsModule {}
