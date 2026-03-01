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

interface ListDeliveriesParams {
  organizationId?: string;
  endpointId?: string;
  eventType?: string;
  status?: 'QUEUED' | 'DELIVERING' | 'DELIVERED' | 'FAILED';
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
        throw new WebhookUrlValidationError(err.message);
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
  ) {
    if (params.url !== undefined) {
      const devMode =
        process.env.NODE_ENV === 'development' ||
        process.env.NODE_ENV === 'test';
      try {
        await validateOutboundUrl(params.url, { devMode });
      } catch (err) {
        if (err instanceof SsrfValidationError) {
          throw new WebhookUrlValidationError(err.message);
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
      .where(eq(webhookEndpoints.id, id))
      .returning();
    return row ? redactSecret(row) : null;
  },

  async deleteEndpoint(tx: DrizzleDb, id: string) {
    await tx.delete(webhookEndpoints).where(eq(webhookEndpoints.id, id));
  },

  async getEndpoint(tx: DrizzleDb, id: string) {
    const [row] = await tx
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, id))
      .limit(1);
    return row ? redactSecret(row) : null;
  },

  async listEndpoints(tx: DrizzleDb, params: { page: number; limit: number }) {
    const { page, limit } = params;
    const offset = (page - 1) * limit;

    const [items, countResult] = await Promise.all([
      tx
        .select()
        .from(webhookEndpoints)
        .orderBy(desc(webhookEndpoints.createdAt))
        .limit(limit)
        .offset(offset),
      tx.select({ count: count() }).from(webhookEndpoints),
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

  async rotateSecret(tx: DrizzleDb, id: string) {
    const secret = crypto.randomBytes(32).toString('hex');
    const [row] = await tx
      .update(webhookEndpoints)
      .set({ secret, updatedAt: new Date() })
      .where(eq(webhookEndpoints.id, id))
      .returning();
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

  async updateDeliveryStatus(
    tx: DrizzleDb,
    id: string,
    status: 'QUEUED' | 'DELIVERING' | 'DELIVERED' | 'FAILED',
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
      .where(eq(webhookDeliveries.id, id));
  },

  async listDeliveries(tx: DrizzleDb, params: ListDeliveriesParams) {
    const { page, limit, organizationId, endpointId, eventType, status } =
      params;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (organizationId)
      conditions.push(eq(webhookDeliveries.organizationId, organizationId));
    if (endpointId)
      conditions.push(eq(webhookDeliveries.webhookEndpointId, endpointId));
    if (eventType) conditions.push(eq(webhookDeliveries.eventType, eventType));
    if (status) conditions.push(eq(webhookDeliveries.status, status));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

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

  async retryDelivery(tx: DrizzleDb, deliveryId: string) {
    const [row] = await tx
      .update(webhookDeliveries)
      .set({
        status: 'QUEUED',
        httpStatusCode: null,
        responseBody: null,
        errorMessage: null,
        nextRetryAt: null,
      })
      .where(eq(webhookDeliveries.id, deliveryId))
      .returning();
    return row;
  },

  async countRecentFailures(tx: DrizzleDb, endpointId: string) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h window
    const [result] = await tx
      .select({ count: count() })
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.webhookEndpointId, endpointId),
          eq(webhookDeliveries.status, 'FAILED'),
          sql`${webhookDeliveries.createdAt} >= ${since.toISOString()}`,
        ),
      );
    return result?.count ?? 0;
  },
};
