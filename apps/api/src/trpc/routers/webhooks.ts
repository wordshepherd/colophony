import { z } from 'zod';
import {
  createWebhookEndpointSchema,
  updateWebhookEndpointSchema,
  listWebhookDeliveriesSchema,
  AuditActions,
  AuditResources,
} from '@colophony/types';
import { webhookEndpoints, eq } from '@colophony/db';
import { adminProcedure, orgProcedure, createRouter } from '../init.js';
import { webhookService } from '../../services/webhook.service.js';
import { enqueueWebhook } from '../../queues/webhook.queue.js';
import { validateEnv } from '../../config/env.js';

export const webhooksRouter = createRouter({
  create: adminProcedure
    .input(createWebhookEndpointSchema)
    .mutation(async ({ ctx, input }) => {
      const row = await webhookService.createEndpoint(ctx.dbTx, {
        organizationId: ctx.authContext.orgId,
        url: input.url,
        description: input.description,
        eventTypes: input.eventTypes,
      });
      await ctx.audit({
        action: AuditActions.WEBHOOK_ENDPOINT_CREATED,
        resource: AuditResources.WEBHOOK_ENDPOINT,
        resourceId: row.id,
        newValue: { url: input.url, eventTypes: input.eventTypes },
      });
      return row;
    }),

  update: adminProcedure
    .input(
      z.object({ id: z.string().uuid() }).merge(updateWebhookEndpointSchema),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...params } = input;
      const row = await webhookService.updateEndpoint(ctx.dbTx, id, params);
      await ctx.audit({
        action: AuditActions.WEBHOOK_ENDPOINT_UPDATED,
        resource: AuditResources.WEBHOOK_ENDPOINT,
        resourceId: id,
        newValue: params,
      });
      return row;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await webhookService.deleteEndpoint(ctx.dbTx, input.id);
      await ctx.audit({
        action: AuditActions.WEBHOOK_ENDPOINT_DELETED,
        resource: AuditResources.WEBHOOK_ENDPOINT,
        resourceId: input.id,
      });
      return { success: true };
    }),

  getById: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return webhookService.getEndpoint(ctx.dbTx, input.id);
    }),

  list: orgProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      return webhookService.listEndpoints(ctx.dbTx, input);
    }),

  rotateSecret: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const row = await webhookService.rotateSecret(ctx.dbTx, input.id);
      await ctx.audit({
        action: AuditActions.WEBHOOK_ENDPOINT_SECRET_ROTATED,
        resource: AuditResources.WEBHOOK_ENDPOINT,
        resourceId: input.id,
      });
      return row;
    }),

  test: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const env = validateEnv();
      const orgId = ctx.authContext.orgId;

      // Get the endpoint (including secret for delivery)
      const [endpoint] = await ctx.dbTx
        .select()
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.id, input.id))
        .limit(1);

      if (!endpoint) {
        throw new Error('Webhook endpoint not found');
      }

      const delivery = await webhookService.createDelivery(ctx.dbTx, {
        organizationId: orgId,
        webhookEndpointId: input.id,
        eventType: 'webhook.test',
        eventId: crypto.randomUUID(),
        payload: {
          event: 'webhook.test',
          data: { message: 'Test webhook from Colophony' },
        },
      });

      const payload = {
        id: delivery.id,
        event: 'webhook.test',
        timestamp: new Date().toISOString(),
        organizationId: orgId,
        data: { message: 'Test webhook from Colophony' } as Record<
          string,
          unknown
        >,
      };

      await enqueueWebhook(env, {
        deliveryId: delivery.id,
        orgId,
        endpointUrl: endpoint.url,
        secret: endpoint.secret,
        payload,
      });

      return { deliveryId: delivery.id };
    }),

  deliveries: orgProcedure
    .input(listWebhookDeliveriesSchema)
    .query(async ({ ctx, input }) => {
      return webhookService.listDeliveries(ctx.dbTx, {
        ...input,
        organizationId: ctx.authContext.orgId,
      });
    }),

  retryDelivery: adminProcedure
    .input(z.object({ deliveryId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const env = validateEnv();
      const orgId = ctx.authContext.orgId;

      const delivery = await webhookService.retryDelivery(
        ctx.dbTx,
        input.deliveryId,
      );

      if (!delivery) {
        throw new Error('Delivery not found');
      }

      if (delivery.organizationId !== orgId) {
        throw new Error('Delivery not found');
      }

      // Get the endpoint for the delivery
      const [endpoint] = await ctx.dbTx
        .select()
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.id, delivery.webhookEndpointId))
        .limit(1);

      if (!endpoint) {
        throw new Error('Webhook endpoint not found');
      }

      const payload = {
        id: delivery.id,
        event: delivery.eventType,
        timestamp: new Date().toISOString(),
        organizationId: orgId,
        data: delivery.payload as Record<string, unknown>,
      };

      await enqueueWebhook(env, {
        deliveryId: delivery.id,
        orgId,
        endpointUrl: endpoint.url,
        secret: endpoint.secret,
        payload,
      });

      await ctx.audit({
        action: AuditActions.WEBHOOK_DELIVERY_RETRIED,
        resource: AuditResources.WEBHOOK_DELIVERY,
        resourceId: input.deliveryId,
      });

      return delivery;
    }),
});
