import { faker } from '@faker-js/faker';
import { drizzle } from 'drizzle-orm/node-postgres';
import { getAdminPool } from '../../rls/helpers/db-setup';
import {
  emailSends,
  webhookEndpoints,
  webhookDeliveries,
  outboxEvents,
  trustedPeers,
} from '@colophony/db';

type EmailSend = typeof emailSends.$inferSelect;
type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
type OutboxEvent = typeof outboxEvents.$inferSelect;
type TrustedPeer = typeof trustedPeers.$inferSelect;

function adminDb(): any {
  return drizzle(getAdminPool());
}

export async function createEmailSend(
  orgId: string,
  overrides?: Partial<EmailSend>,
): Promise<EmailSend> {
  const db = adminDb();
  const [row] = await db
    .insert(emailSends)
    .values({
      organizationId: orgId,
      recipientEmail: faker.internet.email(),
      templateName: 'submission-confirmation',
      eventType: 'submission.created',
      subject: faker.lorem.sentence(),
      status: 'QUEUED',
      ...overrides,
    })
    .returning();
  return row;
}

export async function createWebhookEndpoint(
  orgId: string,
  overrides?: Partial<WebhookEndpoint>,
): Promise<WebhookEndpoint> {
  const db = adminDb();
  const [row] = await db
    .insert(webhookEndpoints)
    .values({
      organizationId: orgId,
      url: `https://hooks.example.com/${faker.string.alphanumeric(10)}`,
      secret: faker.string.alphanumeric(32),
      eventTypes: ['submission.created', 'submission.updated'],
      status: 'ACTIVE',
      ...overrides,
    })
    .returning();
  return row;
}

export async function createWebhookDelivery(
  orgId: string,
  endpointId: string,
  overrides?: Partial<WebhookDelivery>,
): Promise<WebhookDelivery> {
  const db = adminDb();
  const [row] = await db
    .insert(webhookDeliveries)
    .values({
      organizationId: orgId,
      webhookEndpointId: endpointId,
      eventType: 'submission.created',
      eventId: faker.string.uuid(),
      payload: {
        id: faker.string.uuid(),
        event: 'submission.created',
        timestamp: new Date().toISOString(),
        organizationId: orgId,
        data: { submissionId: faker.string.uuid() },
      },
      status: 'QUEUED',
      ...overrides,
    })
    .returning();
  return row;
}

export async function createOutboxEvent(
  overrides?: Partial<OutboxEvent>,
): Promise<OutboxEvent> {
  const db = adminDb();
  const [row] = await db
    .insert(outboxEvents)
    .values({
      eventType: 'submission/created',
      payload: {
        submissionId: faker.string.uuid(),
        orgId: faker.string.uuid(),
      },
      processedAt: null,
      ...overrides,
    })
    .returning();
  return row;
}

export async function createTrustedPeer(
  orgId: string,
  overrides?: Partial<TrustedPeer>,
): Promise<TrustedPeer> {
  const db = adminDb();
  const [row] = await db
    .insert(trustedPeers)
    .values({
      organizationId: orgId,
      domain: `peer-${faker.string.alphanumeric(8)}.example.com`,
      instanceUrl: `http://localhost:${faker.number.int({ min: 4001, max: 9999 })}`,
      publicKey: `-----BEGIN PUBLIC KEY-----\n${faker.string.alphanumeric(64)}\n-----END PUBLIC KEY-----`,
      keyId: `${faker.string.alphanumeric(8)}#main-key`,
      status: 'active',
      initiatedBy: 'local',
      ...overrides,
    })
    .returning();
  return row;
}
