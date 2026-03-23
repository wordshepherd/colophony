import type { InngestFunction } from 'inngest';
import { withRls } from '@colophony/db';
import { inngest } from '../client.js';
import { webhookService } from '../../services/webhook.service.js';
import { enqueueWebhook } from '../../queues/webhook.queue.js';
import { validateEnv } from '../../config/env.js';

export const webhookDelivery: InngestFunction.Any = inngest.createFunction(
  {
    id: 'webhook-delivery',
    name: 'Webhook Delivery',
    retries: 3,
    triggers: [
      { event: 'hopper/submission.submitted' },
      { event: 'hopper/submission.accepted' },
      { event: 'hopper/submission.rejected' },
      { event: 'hopper/submission.withdrawn' },
      { event: 'slate/pipeline.copyeditor-assigned' },
      { event: 'slate/pipeline.copyedit-completed' },
      { event: 'slate/pipeline.author-review-completed' },
      { event: 'slate/pipeline.proofread-completed' },
      { event: 'slate/contract.generated' },
      { event: 'slate/issue.published' },
    ],
  },
  async ({ event, step }) => {
    const orgId = (event.data as { orgId: string }).orgId;

    // Step 1: Find active endpoints subscribed to this event
    const endpoints = await step.run('get-endpoints', async () =>
      withRls({ orgId }, async (tx) =>
        webhookService.getActiveEndpointsForEvent(tx, orgId, event.name),
      ),
    );

    if (endpoints.length === 0) {
      return { skipped: true, reason: 'no-endpoints' };
    }

    // Step 2: Create delivery records and enqueue jobs
    await step.run('enqueue-deliveries', async () => {
      const env = validateEnv();

      for (const endpoint of endpoints) {
        const delivery = await withRls({ orgId }, async (tx) =>
          webhookService.createDelivery(tx, {
            organizationId: orgId,
            webhookEndpointId: endpoint.id,
            eventType: event.name,
            eventId: event.id ?? crypto.randomUUID(),
            payload: event.data as Record<string, unknown>,
          }),
        );

        const payload = {
          id: delivery.id,
          event: event.name,
          timestamp: new Date().toISOString(),
          organizationId: orgId,
          data: event.data as Record<string, unknown>,
        };

        await enqueueWebhook(env, {
          deliveryId: delivery.id,
          orgId,
          endpointUrl: endpoint.url,
          secret: endpoint.secret,
          payload,
        });
      }
    });

    return { delivered: endpoints.length };
  },
);
