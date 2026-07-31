import { z } from 'zod';
import {
  createWebhookEndpointSchema,
  updateWebhookEndpointSchema,
  listWebhookDeliveriesSchema,
  AuditActions,
  AuditResources,
} from '@colophony/types';
import {
  adminProcedure,
  orgProcedure,
  requireScopes,
  createRouter,
} from '../init.js';
import {
  webhookService,
  WebhookEndpointNotFoundError,
  WebhookEndpointDisabledError,
} from '../../services/webhook.service.js';
import { mapServiceError } from '../error-mapper.js';
import {
  enqueueWebhook,
  enqueueWebhookRetry,
} from '../../queues/webhook.queue.js';
import { validateEnv } from '../../config/env.js';

export const webhooksRouter = createRouter({
  create: adminProcedure
    .use(requireScopes('webhooks:manage'))
    .input(createWebhookEndpointSchema)
    .mutation(async ({ ctx, input }) => {
      const row = await webhookService
        .createEndpoint(ctx.dbTx, {
          organizationId: ctx.authContext.orgId,
          url: input.url,
          description: input.description,
          eventTypes: input.eventTypes,
        })
        .catch(mapServiceError);
      await ctx.audit({
        action: AuditActions.WEBHOOK_ENDPOINT_CREATED,
        resource: AuditResources.WEBHOOK_ENDPOINT,
        resourceId: row.id,
        newValue: { url: input.url, eventTypes: input.eventTypes },
      });
      return row;
    }),

  update: adminProcedure
    .use(requireScopes('webhooks:manage'))
    .input(
      z.object({ id: z.string().uuid() }).merge(updateWebhookEndpointSchema),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...params } = input;
      const row = await webhookService
        .updateEndpoint(ctx.dbTx, id, params, ctx.authContext.orgId)
        .catch(mapServiceError);
      // Reached only on a real update — `updateEndpoint` throws on zero rows.
      await ctx.audit({
        action: AuditActions.WEBHOOK_ENDPOINT_UPDATED,
        resource: AuditResources.WEBHOOK_ENDPOINT,
        resourceId: id,
        newValue: params,
      });
      return row;
    }),

  delete: adminProcedure
    .use(requireScopes('webhooks:manage'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await webhookService
        .deleteEndpoint(ctx.dbTx, input.id, ctx.authContext.orgId)
        .catch(mapServiceError);
      // Reached only on a real delete — `deleteEndpoint` throws on zero rows.
      await ctx.audit({
        action: AuditActions.WEBHOOK_ENDPOINT_DELETED,
        resource: AuditResources.WEBHOOK_ENDPOINT,
        resourceId: input.id,
      });
      return { success: true };
    }),

  getById: orgProcedure
    .use(requireScopes('webhooks:read'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return webhookService
        .getEndpoint(ctx.dbTx, input.id, ctx.authContext.orgId)
        .catch(mapServiceError);
    }),

  list: orgProcedure
    .use(requireScopes('webhooks:read'))
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      return webhookService.listEndpoints(
        ctx.dbTx,
        input,
        ctx.authContext.orgId,
      );
    }),

  rotateSecret: adminProcedure
    .use(requireScopes('webhooks:manage'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const row = await webhookService
        .rotateSecret(ctx.dbTx, input.id, ctx.authContext.orgId)
        .catch(mapServiceError);
      // Reached only on a real rotation — `rotateSecret` throws on zero rows.
      await ctx.audit({
        action: AuditActions.WEBHOOK_ENDPOINT_SECRET_ROTATED,
        resource: AuditResources.WEBHOOK_ENDPOINT,
        resourceId: input.id,
      });
      return row;
    }),

  test: adminProcedure
    .use(requireScopes('webhooks:manage'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const env = validateEnv();
      const orgId = ctx.authContext.orgId;

      // The worker re-reads url/secret at send time, so only existence and status
      // are needed here — the redacted read is sufficient. `getEndpoint` throws
      // `WebhookEndpointNotFoundError` rather than returning null.
      const endpoint = await webhookService
        .getEndpoint(ctx.dbTx, input.id, orgId)
        .catch(mapServiceError);

      // The worker cancels sends to a disabled endpoint, so reject here rather than
      // enqueueing a delivery that is guaranteed to be cancelled without explanation.
      if (endpoint.status === 'DISABLED') {
        mapServiceError(new WebhookEndpointDisabledError(input.id));
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
        payload,
      });

      return { deliveryId: delivery.id };
    }),

  deliveries: orgProcedure
    .use(requireScopes('webhooks:read'))
    .input(listWebhookDeliveriesSchema)
    .query(async ({ ctx, input }) => {
      return webhookService.listDeliveries(
        ctx.dbTx,
        input,
        ctx.authContext.orgId,
      );
    }),

  retryDelivery: adminProcedure
    .use(requireScopes('webhooks:manage'))
    .input(z.object({ deliveryId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const env = validateEnv();
      const orgId = ctx.authContext.orgId;

      // The org predicate lives on the UPDATE itself and throws on zero rows,
      // so ownership is settled before the row is touched. This used to mutate
      // first and compare `delivery.organizationId` afterwards — and because
      // tRPC turns a throw into a normal reply, `db-context` committed that
      // mutation rather than rolling it back.
      const delivery = await webhookService
        .retryDelivery(ctx.dbTx, input.deliveryId, orgId)
        .catch(mapServiceError);

      // Still required, and not subsumed by the predicate above: that one scopes
      // the delivery, this join scopes the *endpoint* it points at. The FK
      // guarantees existence, not org affinity.
      // The worker re-reads url/secret itself, so nothing is taken from here.
      const endpoint = await webhookService.getEndpointForDelivery(
        ctx.dbTx,
        input.deliveryId,
        orgId,
      );

      if (!endpoint) {
        mapServiceError(
          new WebhookEndpointNotFoundError(delivery.webhookEndpointId),
        );
      }

      const payload = {
        id: delivery.id,
        event: delivery.eventType,
        timestamp: new Date().toISOString(),
        organizationId: orgId,
        data: delivery.payload as Record<string, unknown>,
      };

      // Retry, not a fresh enqueue: the previous job is still retained under this
      // delivery id and would dedup a plain add into a no-op.
      await enqueueWebhookRetry(env, {
        deliveryId: delivery.id,
        orgId,
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
