import crypto from 'node:crypto';
import {
  webhookEndpoints,
  webhookDeliveries,
  eq,
  and,
  sql,
  type DrizzleDb,
} from '@colophony/db';
import { desc, count } from 'drizzle-orm';
import {
  validateOutboundUrl,
  SsrfValidationError,
} from '../lib/url-validation.js';

export class WebhookUrlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookUrlValidationError';
  }
}

/**
 * An endpoint not available to the caller's organization.
 *
 * Absent and belonging-to-another-tenant are deliberately indistinguishable —
 * a distinct "forbidden" would let a caller probe for the existence of another
 * org's endpoints by id. Same posture as `IssueNotFoundError`.
 */
export class WebhookEndpointNotFoundError extends Error {
  constructor(id: string) {
    super(`Webhook endpoint "${id}" not found`);
    this.name = 'WebhookEndpointNotFoundError';
  }
}

/** Same posture as `WebhookEndpointNotFoundError`, for deliveries. */
export class WebhookDeliveryNotFoundError extends Error {
  constructor(id: string) {
    super(`Webhook delivery "${id}" not found`);
    this.name = 'WebhookDeliveryNotFoundError';
  }
}

/**
 * A test send was requested against a disabled endpoint. A 400, not a 404 —
 * the caller can see the endpoint, it just cannot receive.
 *
 * Keep the word "disabled" in the message: `trpc/routers/webhooks.spec.ts`
 * asserts `/disabled/i` against it.
 */
export class WebhookEndpointDisabledError extends Error {
  constructor(id: string) {
    super(
      `Webhook endpoint "${id}" is disabled — re-enable it before sending a test delivery`,
    );
    this.name = 'WebhookEndpointDisabledError';
  }
}

/**
 * Derived from the schema enum rather than hand-written, so adding a value to
 * `webhookDeliveryStatusEnum` cannot leave this union silently behind.
 */
export type WebhookDeliveryStatus =
  (typeof webhookDeliveries.status.enumValues)[number];

interface CreateEndpointParams {
  organizationId: string;
  url: string;
  description?: string;
  eventTypes: string[];
}

interface UpdateEndpointParams {
  url?: string;
  description?: string;
  eventTypes?: string[];
  status?: 'ACTIVE' | 'DISABLED';
}

interface CreateDeliveryParams {
  organizationId: string;
  webhookEndpointId: string;
  eventType: string;
  eventId: string;
  payload: Record<string, unknown>;
}

/**
 * Note the absence of `organizationId` — it is a separate, required argument.
 *
 * It used to live here as `organizationId?`, applied only under an `if`. A
 * caller that forgot it got every tenant's deliveries with RLS as the only
 * defence, and `endpointId` is caller-supplied, so the filter could be pointed
 * at another org's endpoint. Keep tenancy out of the caller-shaped params bag.
 */
interface ListDeliveriesParams {
  endpointId?: string;
  eventType?: string;
  status?: WebhookDeliveryStatus;
  page: number;
  limit: number;
}

function redactSecret<T extends Record<string, unknown>>(
  row: T,
): Omit<T, 'secret'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { secret, ...rest } = row;
  return rest;
}

export const webhookService = {
  async createEndpoint(tx: DrizzleDb, params: CreateEndpointParams) {
    const devMode =
      process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    try {
      await validateOutboundUrl(params.url, { devMode });
    } catch (err) {
      if (err instanceof SsrfValidationError) {
        // Sanitize: don't expose internal network details to API consumers
        throw new WebhookUrlValidationError(
          'URL is not allowed: must be a public HTTPS endpoint',
        );
      }
      throw err;
    }

    const secret = crypto.randomBytes(32).toString('hex');
    const [row] = await tx
      .insert(webhookEndpoints)
      .values({
        organizationId: params.organizationId,
        url: params.url,
        secret,
        description: params.description ?? null,
        eventTypes: params.eventTypes,
        status: 'ACTIVE',
      })
      .returning();
    return row;
  },

  async updateEndpoint(
    tx: DrizzleDb,
    id: string,
    params: UpdateEndpointParams,
    organizationId: string,
  ) {
    if (params.url !== undefined) {
      const devMode =
        process.env.NODE_ENV === 'development' ||
        process.env.NODE_ENV === 'test';
      try {
        await validateOutboundUrl(params.url, { devMode });
      } catch (err) {
        if (err instanceof SsrfValidationError) {
          throw new WebhookUrlValidationError(
            'URL is not allowed: must be a public HTTPS endpoint',
          );
        }
        throw err;
      }
    }

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (params.url !== undefined) update.url = params.url;
    if (params.description !== undefined)
      update.description = params.description;
    if (params.eventTypes !== undefined) update.eventTypes = params.eventTypes;
    if (params.status !== undefined) update.status = params.status;

    const [row] = await tx
      .update(webhookEndpoints)
      .set(update)
      .where(
        and(
          eq(webhookEndpoints.id, id),
          eq(webhookEndpoints.organizationId, organizationId),
        ),
      )
      .returning();
    // Throwing rather than returning null is what makes the callers' audit
    // writes structurally unable to fire on a zero-row update. Both routers
    // audited WEBHOOK_ENDPOINT_UPDATED unconditionally before this.
    if (!row) throw new WebhookEndpointNotFoundError(id);
    return redactSecret(row);
  },

  /**
   * Best-effort disable for the delivery worker's auto-disable path.
   *
   * Returns null where `updateEndpoint` throws, deliberately. Its only caller
   * is `webhook.worker.ts`'s `onFailed` tail, which runs inside a `withRls`
   * transaction that has *already* written the delivery's FAILED status and its
   * audit row. A throw there rolls both back (`packages/db/src/context.ts`) —
   * losing the record of the failure in order to report a race in which the
   * endpoint is already gone. Do not unify this with `updateEndpoint`.
   */
  async disableEndpoint(tx: DrizzleDb, id: string, organizationId: string) {
    const [row] = await tx
      .update(webhookEndpoints)
      .set({ status: 'DISABLED', updatedAt: new Date() })
      .where(
        and(
          eq(webhookEndpoints.id, id),
          eq(webhookEndpoints.organizationId, organizationId),
        ),
      )
      .returning();
    return row ? redactSecret(row) : null;
  },

  async deleteEndpoint(tx: DrizzleDb, id: string, organizationId: string) {
    // `.returning({ id })` rather than a bare `.returning()`: the DELETE never
    // needs to read the secret back. Safe under RLS because the policy is
    // `for: "all"` with one USING clause, so SELECT and DELETE share it.
    const [row] = await tx
      .delete(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, id),
          eq(webhookEndpoints.organizationId, organizationId),
        ),
      )
      .returning({ id: webhookEndpoints.id });
    if (!row) throw new WebhookEndpointNotFoundError(id);
    return row;
  },

  async getEndpoint(tx: DrizzleDb, id: string, organizationId: string) {
    const [row] = await tx
      .select()
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, id),
          eq(webhookEndpoints.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (!row) throw new WebhookEndpointNotFoundError(id);
    return redactSecret(row);
  },

  async listEndpoints(
    tx: DrizzleDb,
    params: { page: number; limit: number },
    organizationId: string,
  ) {
    const { page, limit } = params;
    const offset = (page - 1) * limit;

    const orgFilter = eq(webhookEndpoints.organizationId, organizationId);

    const [items, countResult] = await Promise.all([
      tx
        .select()
        .from(webhookEndpoints)
        .where(orgFilter)
        .orderBy(desc(webhookEndpoints.createdAt))
        .limit(limit)
        .offset(offset),
      tx.select({ count: count() }).from(webhookEndpoints).where(orgFilter),
    ]);

    const total = countResult[0]?.count ?? 0;
    return {
      items: items.map(redactSecret),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Returns the row **unredacted** — this and `createEndpoint` are the only two
   * paths that hand the plaintext signing secret to a caller, which is the
   * whole point of the operation. Do not add `redactSecret` here.
   */
  async rotateSecret(tx: DrizzleDb, id: string, organizationId: string) {
    const secret = crypto.randomBytes(32).toString('hex');
    const [row] = await tx
      .update(webhookEndpoints)
      .set({ secret, updatedAt: new Date() })
      .where(
        and(
          eq(webhookEndpoints.id, id),
          eq(webhookEndpoints.organizationId, organizationId),
        ),
      )
      .returning();
    if (!row) throw new WebhookEndpointNotFoundError(id);
    return row;
  },

  async getActiveEndpointsForEvent(
    tx: DrizzleDb,
    orgId: string,
    eventType: string,
  ) {
    return tx
      .select()
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.organizationId, orgId),
          eq(webhookEndpoints.status, 'ACTIVE'),
          sql`${webhookEndpoints.eventTypes}::jsonb @> ${JSON.stringify([eventType])}::jsonb`,
        ),
      );
  },

  /**
   * Resolve the endpoint a queued delivery belongs to, for re-validation at send time.
   *
   * Deliberately NOT redacted — the worker needs the current signing secret, so this
   * cannot reuse `getEndpoint`, which strips `secret` from both the value and the type.
   * Same posture as `rotateSecret` and `getActiveEndpointsForEvent`.
   *
   * Filters `organizationId` on BOTH tables. The FK guarantees the endpoint exists, not
   * that it shares the delivery's org, so this join is the only explicit org-affinity
   * check between the two.
   *
   * Returns null when the endpoint has been deleted: the delivery row is removed with it
   * via ON DELETE CASCADE, so there is nothing left to mark.
   */
  async getEndpointForDelivery(
    tx: DrizzleDb,
    deliveryId: string,
    organizationId: string,
  ) {
    const [row] = await tx
      .select({
        endpointId: webhookEndpoints.id,
        url: webhookEndpoints.url,
        secret: webhookEndpoints.secret,
        status: webhookEndpoints.status,
        eventTypes: webhookEndpoints.eventTypes,
      })
      .from(webhookDeliveries)
      .innerJoin(
        webhookEndpoints,
        eq(webhookDeliveries.webhookEndpointId, webhookEndpoints.id),
      )
      .where(
        and(
          eq(webhookDeliveries.id, deliveryId),
          eq(webhookDeliveries.organizationId, organizationId),
          eq(webhookEndpoints.organizationId, organizationId),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  async createDelivery(tx: DrizzleDb, params: CreateDeliveryParams) {
    const [row] = await tx
      .insert(webhookDeliveries)
      .values({
        organizationId: params.organizationId,
        webhookEndpointId: params.webhookEndpointId,
        eventType: params.eventType,
        eventId: params.eventId,
        payload: params.payload,
        status: 'QUEUED',
      })
      .returning();
    return row;
  },

  /**
   * `organizationId` is defence-in-depth, not a live fix.
   *
   * Every caller is the delivery worker, which has already resolved this
   * delivery through the org-scoped `getEndpointForDelivery` join and returned
   * early when it found nothing — so the id reaching here is known to belong to
   * `organizationId`. The predicate exists because that guard is a property of
   * one call site rather than of this statement, and a second caller would not
   * inherit it. Contrast `retryDelivery`, which had no guard at all.
   */
  async updateDeliveryStatus(
    tx: DrizzleDb,
    id: string,
    status: WebhookDeliveryStatus,
    organizationId: string,
    params?: {
      httpStatusCode?: number;
      responseBody?: string;
      errorMessage?: string;
      attempts?: number;
      nextRetryAt?: Date | null;
      deliveredAt?: Date;
    },
  ) {
    const update: Record<string, unknown> = { status };
    if (params?.httpStatusCode !== undefined)
      update.httpStatusCode = params.httpStatusCode;
    if (params?.responseBody !== undefined)
      update.responseBody = params.responseBody?.slice(0, 4096);
    if (params?.errorMessage !== undefined)
      update.errorMessage = params.errorMessage?.slice(0, 2048);
    if (params?.attempts !== undefined) update.attempts = params.attempts;
    if (params?.nextRetryAt !== undefined)
      update.nextRetryAt = params.nextRetryAt;
    if (params?.deliveredAt !== undefined)
      update.deliveredAt = params.deliveredAt;

    await tx
      .update(webhookDeliveries)
      .set(update)
      .where(
        and(
          eq(webhookDeliveries.id, id),
          eq(webhookDeliveries.organizationId, organizationId),
        ),
      );
  },

  async listDeliveries(
    tx: DrizzleDb,
    params: ListDeliveriesParams,
    organizationId: string,
  ) {
    const { page, limit, endpointId, eventType, status } = params;
    const offset = (page - 1) * limit;

    // Seeded, not appended under an `if`. `endpointId` below is caller-supplied
    // and carries no tenancy of its own, so without this the filter could be
    // pointed at another org's endpoint. `where` is shared with the count query
    // further down, so page and total cannot drift apart.
    const conditions = [eq(webhookDeliveries.organizationId, organizationId)];
    if (endpointId)
      conditions.push(eq(webhookDeliveries.webhookEndpointId, endpointId));
    if (eventType) conditions.push(eq(webhookDeliveries.eventType, eventType));
    if (status) conditions.push(eq(webhookDeliveries.status, status));

    // Never undefined — `conditions` is seeded with the org predicate above.
    const where = and(...conditions);

    const [items, countResult] = await Promise.all([
      tx
        .select()
        .from(webhookDeliveries)
        .where(where)
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(limit)
        .offset(offset),
      tx.select({ count: count() }).from(webhookDeliveries).where(where),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  /**
   * The one genuinely live gap this change closes.
   *
   * This ran `UPDATE … WHERE id = $1` with no org term, and its caller compared
   * `delivery.organizationId !== orgId` *afterwards* — so the row was already
   * mutated by the time ownership was checked. Worse, tRPC turns a thrown error
   * into a normal HTTP reply, so `db-context` commits on `onResponse` rather
   * than rolling back: another org's delivery was left permanently QUEUED with
   * its failure fields nulled, and no job enqueued. RLS was the only defence.
   *
   * Both halves below are load-bearing. The predicate stops the write; the
   * throw stops the caller proceeding to audit and enqueue against a row it
   * does not own. Unlike `updateStage` they are *not* independently sufficient
   * — with the predicate alone nothing on the REST surface would catch it.
   */
  async retryDelivery(
    tx: DrizzleDb,
    deliveryId: string,
    organizationId: string,
  ) {
    const [row] = await tx
      .update(webhookDeliveries)
      .set({
        status: 'QUEUED',
        httpStatusCode: null,
        responseBody: null,
        errorMessage: null,
        nextRetryAt: null,
      })
      .where(
        and(
          eq(webhookDeliveries.id, deliveryId),
          eq(webhookDeliveries.organizationId, organizationId),
        ),
      )
      .returning();
    if (!row) throw new WebhookDeliveryNotFoundError(deliveryId);
    return row;
  },

  /**
   * `organizationId` is defence-in-depth for the same reason as
   * `updateDeliveryStatus` — the endpoint id arrives from the org-scoped join.
   * It matters more here than the isolation framing suggests: this count feeds
   * the auto-disable threshold, so an unscoped one lets another tenant's
   * failures contribute to disabling this org's endpoint.
   */
  async countRecentFailures(
    tx: DrizzleDb,
    endpointId: string,
    organizationId: string,
  ) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h window
    const [result] = await tx
      .select({ count: count() })
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.webhookEndpointId, endpointId),
          eq(webhookDeliveries.organizationId, organizationId),
          eq(webhookDeliveries.status, 'FAILED'),
          sql`${webhookDeliveries.createdAt} >= ${since.toISOString()}`,
        ),
      );
    return result?.count ?? 0;
  },
};
