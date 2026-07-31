import { z } from 'zod';
import {
  AuditActions,
  AuditResources,
  idParamSchema,
  successResponseSchema,
  paginatedResponseSchema,
  createWebhookEndpointSchema,
  updateWebhookEndpointSchema,
  listWebhookDeliveriesSchema,
  webhookEndpointResponseSchema,
  webhookEndpointCreatedResponseSchema,
  webhookDeliveryResponseSchema,
} from '@colophony/types';
import { restPaginationQuery } from '@colophony/api-contracts';
import {
  webhookService,
  WebhookEndpointNotFoundError,
  WebhookEndpointDisabledError,
} from '../../services/webhook.service.js';
import {
  enqueueWebhook,
  enqueueWebhookRetry,
} from '../../queues/webhook.queue.js';
import { validateEnv } from '../../config/env.js';
import { orgProcedure, adminProcedure, requireScopes } from '../context.js';
import { mapServiceError } from '../error-mapper.js';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const paginatedEndpointsSchema = paginatedResponseSchema(
  webhookEndpointResponseSchema,
);

const paginatedDeliveriesSchema = paginatedResponseSchema(
  webhookDeliveryResponseSchema,
);

const deliveryIdParamSchema = z.object({
  deliveryId: z.string().uuid().describe('Webhook delivery UUID'),
});

const testResponseSchema = z.object({
  deliveryId: z
    .string()
    .uuid()
    .describe('The queued test delivery — poll it via GET /webhook-deliveries'),
});

/**
 * Only page/limit need REST treatment; the other three filters are already
 * string-shaped. Both this and `restPaginationQuery` cap `limit` at 100, so
 * unlike the notifications contract nothing has to be restated to avoid
 * silently widening the surface against its tRPC twin.
 */
const restListWebhookDeliveriesQuery = listWebhookDeliveriesSchema
  .omit({ page: true, limit: true })
  .merge(restPaginationQuery);

/**
 * Why two response shapes.
 *
 * `redactSecret` strips `secret` in `getEndpoint`/`listEndpoints`/
 * `updateEndpoint` but deliberately not in `createEndpoint`/`rotateSecret` —
 * those two exist to hand the caller a signing secret it can never retrieve
 * again. So exactly two routes below declare
 * `webhookEndpointCreatedResponseSchema`, and every other endpoint route
 * declares the redacted one. Zod strips unknown keys, so the schema is a second
 * line of defence, but the spec asserts on the response rather than relying on
 * it.
 */
const SECRET_NOTE =
  ' The signing secret is returned **only** by this operation and by ' +
  'endpoint creation — it cannot be read back afterwards. Store it before ' +
  'discarding the response.';

// ---------------------------------------------------------------------------
// Endpoint routes
// ---------------------------------------------------------------------------

const list = orgProcedure
  .use(requireScopes('webhooks:read'))
  .route({
    method: 'GET',
    path: '/webhooks',
    summary: 'List webhook endpoints',
    description:
      'Returns the organization’s registered webhook endpoints, newest first. ' +
      'Signing secrets are never included.',
    operationId: 'listWebhookEndpoints',
    tags: ['Webhooks'],
  })
  .input(restPaginationQuery)
  .output(paginatedEndpointsSchema)
  .handler(async ({ input, context }) => {
    return webhookService.listEndpoints(
      context.dbTx,
      input,
      context.authContext.orgId,
    );
  });

const create = adminProcedure
  .use(requireScopes('webhooks:manage'))
  .route({
    method: 'POST',
    path: '/webhooks',
    successStatus: 201,
    summary: 'Register a webhook endpoint',
    description:
      'Registers an HTTPS endpoint to receive the selected events. The URL is ' +
      'validated against SSRF rules — it must be a public HTTPS address.' +
      SECRET_NOTE,
    operationId: 'createWebhookEndpoint',
    tags: ['Webhooks'],
  })
  .input(createWebhookEndpointSchema)
  .output(webhookEndpointCreatedResponseSchema)
  .handler(async ({ input, context }) => {
    const row = await webhookService
      .createEndpoint(context.dbTx, {
        // Never from input — tenancy is server-supplied on this surface.
        organizationId: context.authContext.orgId,
        url: input.url,
        description: input.description,
        eventTypes: input.eventTypes,
      })
      .catch(mapServiceError);
    await context.audit({
      action: AuditActions.WEBHOOK_ENDPOINT_CREATED,
      resource: AuditResources.WEBHOOK_ENDPOINT,
      resourceId: row.id,
      newValue: { url: input.url, eventTypes: input.eventTypes },
    });
    return row;
  });

const getById = orgProcedure
  .use(requireScopes('webhooks:read'))
  .route({
    method: 'GET',
    path: '/webhooks/{id}',
    summary: 'Get a webhook endpoint',
    description:
      'Returns one webhook endpoint. Responds 404 for an endpoint belonging to ' +
      'another organization, which is indistinguishable from one that does not ' +
      'exist. The signing secret is never included.',
    operationId: 'getWebhookEndpoint',
    tags: ['Webhooks'],
  })
  .input(idParamSchema)
  .output(webhookEndpointResponseSchema)
  .handler(async ({ input, context }) => {
    return webhookService
      .getEndpoint(context.dbTx, input.id, context.authContext.orgId)
      .catch(mapServiceError);
  });

const update = adminProcedure
  .use(requireScopes('webhooks:manage'))
  .route({
    method: 'PATCH',
    path: '/webhooks/{id}',
    summary: 'Update a webhook endpoint',
    description:
      'Updates the URL, description, subscribed events, or status. A changed ' +
      'URL is re-validated against SSRF rules. Signing secrets are never ' +
      'included in the response — rotate the secret to obtain a new one.',
    operationId: 'updateWebhookEndpoint',
    tags: ['Webhooks'],
  })
  .input(idParamSchema.merge(updateWebhookEndpointSchema))
  .output(webhookEndpointResponseSchema)
  .handler(async ({ input, context }) => {
    const { id, ...params } = input;
    const row = await webhookService
      .updateEndpoint(context.dbTx, id, params, context.authContext.orgId)
      .catch(mapServiceError);
    // Reached only on a real update — the service throws on zero rows, so this
    // cannot record a change that did not happen.
    await context.audit({
      action: AuditActions.WEBHOOK_ENDPOINT_UPDATED,
      resource: AuditResources.WEBHOOK_ENDPOINT,
      resourceId: id,
      newValue: params,
    });
    return row;
  });

const deleteEndpoint = adminProcedure
  .use(requireScopes('webhooks:manage'))
  .route({
    method: 'DELETE',
    path: '/webhooks/{id}',
    summary: 'Delete a webhook endpoint',
    description:
      'Deletes the endpoint and its delivery history. Responds 404 rather than ' +
      'reporting success for an endpoint that does not exist.',
    operationId: 'deleteWebhookEndpoint',
    tags: ['Webhooks'],
  })
  .input(idParamSchema)
  .output(successResponseSchema)
  .handler(async ({ input, context }) => {
    await webhookService
      .deleteEndpoint(context.dbTx, input.id, context.authContext.orgId)
      .catch(mapServiceError);
    await context.audit({
      action: AuditActions.WEBHOOK_ENDPOINT_DELETED,
      resource: AuditResources.WEBHOOK_ENDPOINT,
      resourceId: input.id,
    });
    return { success: true };
  });

const rotateSecret = adminProcedure
  .use(requireScopes('webhooks:manage'))
  .route({
    method: 'POST',
    path: '/webhooks/{id}/rotate-secret',
    summary: 'Rotate a webhook signing secret',
    description:
      'Generates a new signing secret and invalidates the previous one. ' +
      'In-flight deliveries are signed with whichever secret is current when ' +
      'they are sent, so rotate during a quiet period if signature continuity ' +
      'matters.' +
      SECRET_NOTE,
    operationId: 'rotateWebhookEndpointSecret',
    tags: ['Webhooks'],
  })
  .input(idParamSchema)
  .output(webhookEndpointCreatedResponseSchema)
  .handler(async ({ input, context }) => {
    const row = await webhookService
      .rotateSecret(context.dbTx, input.id, context.authContext.orgId)
      .catch(mapServiceError);
    await context.audit({
      action: AuditActions.WEBHOOK_ENDPOINT_SECRET_ROTATED,
      resource: AuditResources.WEBHOOK_ENDPOINT,
      resourceId: input.id,
    });
    return row;
  });

const test = adminProcedure
  .use(requireScopes('webhooks:manage'))
  .route({
    method: 'POST',
    path: '/webhooks/{id}/test',
    successStatus: 201,
    summary: 'Send a test delivery',
    description:
      'Queues a `webhook.test` delivery to the endpoint and returns its id. ' +
      'Delivery is asynchronous — poll `GET /webhook-deliveries` for the ' +
      'outcome. Rejected with 400 if the endpoint is disabled.',
    operationId: 'testWebhookEndpoint',
    tags: ['Webhooks'],
  })
  .input(idParamSchema)
  .output(testResponseSchema)
  .handler(async ({ input, context }) => {
    const env = validateEnv();
    const orgId = context.authContext.orgId;

    // The worker re-reads url/secret at send time, so only existence and status
    // are needed here — the redacted read is sufficient.
    const endpoint = await webhookService
      .getEndpoint(context.dbTx, input.id, orgId)
      .catch(mapServiceError);

    // The worker cancels sends to a disabled endpoint, so reject here rather
    // than queueing a delivery guaranteed to be cancelled without explanation.
    if (endpoint.status === 'DISABLED') {
      mapServiceError(new WebhookEndpointDisabledError(input.id));
    }

    const delivery = await webhookService.createDelivery(context.dbTx, {
      organizationId: orgId,
      webhookEndpointId: input.id,
      eventType: 'webhook.test',
      eventId: crypto.randomUUID(),
      payload: {
        event: 'webhook.test',
        data: { message: 'Test webhook from Colophony' },
      },
    });

    await enqueueWebhook(env, {
      deliveryId: delivery.id,
      orgId,
      payload: {
        id: delivery.id,
        event: 'webhook.test',
        timestamp: new Date().toISOString(),
        organizationId: orgId,
        data: { message: 'Test webhook from Colophony' },
      },
    });

    // No audit event, matching the tRPC twin. There is no
    // `WEBHOOK_ENDPOINT_TESTED` action and the typed detail union closes
    // `WEBHOOK_ENDPOINT` to five — adding one is a `@colophony/types` change
    // that must land on both surfaces at once. Filed as a follow-up.
    return { deliveryId: delivery.id };
  });

// ---------------------------------------------------------------------------
// Delivery routes
// ---------------------------------------------------------------------------

const deliveries = orgProcedure
  .use(requireScopes('webhooks:read'))
  .route({
    method: 'GET',
    path: '/webhook-deliveries',
    summary: 'List webhook deliveries',
    description:
      'Returns delivery attempts across the organization’s endpoints, newest ' +
      'first. Filter by endpoint, event type, or status to narrow it.',
    operationId: 'listWebhookDeliveries',
    tags: ['Webhooks'],
  })
  .input(restListWebhookDeliveriesQuery)
  .output(paginatedDeliveriesSchema)
  .handler(async ({ input, context }) => {
    return webhookService.listDeliveries(
      context.dbTx,
      input,
      context.authContext.orgId,
    );
  });

const retryDelivery = adminProcedure
  .use(requireScopes('webhooks:manage'))
  .route({
    method: 'POST',
    path: '/webhook-deliveries/{deliveryId}/retry',
    summary: 'Retry a webhook delivery',
    description:
      'Requeues a delivery, clearing the previous attempt’s status and error. ' +
      'Responds 404 if the delivery or its endpoint is not in this ' +
      'organization.',
    operationId: 'retryWebhookDelivery',
    tags: ['Webhooks'],
  })
  .input(deliveryIdParamSchema)
  .output(webhookDeliveryResponseSchema)
  .handler(async ({ input, context }) => {
    const env = validateEnv();
    const orgId = context.authContext.orgId;

    const delivery = await webhookService
      .retryDelivery(context.dbTx, input.deliveryId, orgId)
      .catch(mapServiceError);

    // Not subsumed by the predicate above: that scopes the delivery, this join
    // scopes the endpoint it points at. The FK guarantees existence, not org
    // affinity. The worker re-reads url/secret, so nothing is taken from here.
    const endpoint = await webhookService.getEndpointForDelivery(
      context.dbTx,
      input.deliveryId,
      orgId,
    );
    if (!endpoint) {
      mapServiceError(
        new WebhookEndpointNotFoundError(delivery.webhookEndpointId),
      );
    }

    // Retry, not a fresh enqueue: the previous job is still retained under this
    // delivery id and would dedup a plain add into a no-op.
    await enqueueWebhookRetry(env, {
      deliveryId: delivery.id,
      orgId,
      payload: {
        id: delivery.id,
        event: delivery.eventType,
        timestamp: new Date().toISOString(),
        organizationId: orgId,
        data: delivery.payload as Record<string, unknown>,
      },
    });

    await context.audit({
      action: AuditActions.WEBHOOK_DELIVERY_RETRIED,
      resource: AuditResources.WEBHOOK_DELIVERY,
      resourceId: input.deliveryId,
    });

    return delivery;
  });

// ---------------------------------------------------------------------------
// Assembled router
// ---------------------------------------------------------------------------

export const webhooksRouter = {
  list,
  create,
  getById,
  update,
  delete: deleteEndpoint,
  rotateSecret,
  test,
  deliveries,
  retryDelivery,
};
