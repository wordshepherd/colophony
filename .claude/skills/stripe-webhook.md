# /stripe-webhook

Add a new Stripe webhook event handler with proper idempotency.

## What this skill does

1. Adds a new event handler method to the webhook controller
2. Implements idempotent processing pattern
3. Updates the payments service with business logic
4. Creates or updates tests for the new handler

## Usage

```
/stripe-webhook invoice.paid           # Handle invoice.paid event
/stripe-webhook customer.subscription.created
/stripe-webhook <event-type>           # Handle any Stripe event type
```

## Instructions for Claude

When the user invokes `/stripe-webhook <event-type>`:

1. **CRITICAL: Understand the idempotency pattern**

   All Stripe webhook handlers MUST follow this pattern to prevent double-processing:

   ```typescript
   // 1. Check if event already processed
   const existingEvent = await this.prisma.stripeWebhookEvent.findUnique({
     where: { eventId: event.id },
   });

   if (existingEvent?.processed) {
     return { received: true, message: 'Event already processed' };
   }

   // 2. Store event record (if new)
   if (!existingEvent) {
     await this.prisma.stripeWebhookEvent.create({
       data: {
         eventId: event.id,
         type: event.type,
         processed: false,
         receivedAt: new Date(),
       },
     });
   }

   // 3. Process the event
   await this.processEvent(event);

   // 4. Mark as processed
   await this.prisma.stripeWebhookEvent.update({
     where: { eventId: event.id },
     data: { processed: true, processedAt: new Date() },
   });
   ```

2. **Add handler method** to `apps/api/src/modules/payments/stripe-webhook.controller.ts`:

   In the `routeEvent` switch statement, add a new case:

   ```typescript
   case '<event-type>':
     return this.paymentsService.handle<EventName>(event);
   ```

   Where `<EventName>` is the PascalCase version of the event type.
   For example: `invoice.paid` → `handleInvoicePaid`

3. **Add service method** to `apps/api/src/modules/payments/payments.service.ts`:

   ```typescript
   /**
    * Handle <event-type> webhook event.
    * Called when [describe when this event fires].
    */
   async handle<EventName>(event: Stripe.Event): Promise<{ received: boolean }> {
     const data = event.data.object as Stripe.<DataType>;

     this.logger.log(`Processing <event-type> for ${data.id}`);

     // TODO: Implement business logic
     // Example operations:
     // - Update database records
     // - Send notifications
     // - Trigger follow-up jobs

     return { received: true };
   }
   ```

   Common Stripe data types by event:
   - `checkout.session.completed` → `Stripe.Checkout.Session`
   - `invoice.paid` → `Stripe.Invoice`
   - `customer.subscription.*` → `Stripe.Subscription`
   - `payment_intent.*` → `Stripe.PaymentIntent`
   - `charge.*` → `Stripe.Charge`

4. **Add test case** to `apps/api/test/unit/payments.service.spec.ts`:

   ```typescript
   describe('handle<EventName>', () => {
     it('should process <event-type> event', async () => {
       const mockEvent = {
         id: 'evt_test_<event>',
         type: '<event-type>',
         data: {
           object: {
             id: '<object-id>',
             // Add relevant mock data
           },
         },
       } as Stripe.Event;

       const result = await service.handle<EventName>(mockEvent);

       expect(result.received).toBe(true);
       // Add assertions for expected side effects
     });

     it('should handle duplicate events idempotently', async () => {
       const mockEvent = {
         id: 'evt_test_duplicate',
         type: '<event-type>',
         data: { object: { id: 'obj_123' } },
       } as Stripe.Event;

       // First call
       await service.handle<EventName>(mockEvent);

       // Second call should not throw or double-process
       const result = await service.handle<EventName>(mockEvent);
       expect(result.received).toBe(true);
     });
   });
   ```

5. **Update types** if needed in `packages/types/src/index.ts`:

   Add any new types needed for the webhook handler.

6. **Inform the user**:

   ```
   Added handler for <event-type>:
   - Updated: apps/api/src/modules/payments/stripe-webhook.controller.ts
   - Updated: apps/api/src/modules/payments/payments.service.ts
   - Updated: apps/api/test/unit/payments.service.spec.ts

   IMPORTANT - Idempotency:
   The handler follows the idempotent pattern using stripe_webhook_events table.
   This prevents double-processing if Stripe retries the webhook.

   Next steps:
   1. Implement the business logic in handle<EventName>()
   2. Add relevant assertions to the test
   3. Configure the webhook in Stripe Dashboard to listen for '<event-type>'
   4. Test with Stripe CLI: stripe trigger <event-type>
   ```

## Common Stripe Events Reference

| Event Type | When it fires | Data object |
|------------|---------------|-------------|
| `checkout.session.completed` | Customer completes checkout | `Stripe.Checkout.Session` |
| `invoice.paid` | Invoice is paid | `Stripe.Invoice` |
| `invoice.payment_failed` | Invoice payment fails | `Stripe.Invoice` |
| `customer.subscription.created` | New subscription | `Stripe.Subscription` |
| `customer.subscription.updated` | Subscription changes | `Stripe.Subscription` |
| `customer.subscription.deleted` | Subscription cancelled | `Stripe.Subscription` |
| `payment_intent.succeeded` | Payment succeeds | `Stripe.PaymentIntent` |
| `payment_intent.payment_failed` | Payment fails | `Stripe.PaymentIntent` |
| `charge.refunded` | Charge is refunded | `Stripe.Charge` |
| `customer.created` | New customer | `Stripe.Customer` |

## Testing Webhooks Locally

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:4000/webhooks/stripe

# Trigger test events
stripe trigger <event-type>
```
