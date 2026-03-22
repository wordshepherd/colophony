import { faker } from '@faker-js/faker';

interface ZitadelPayloadOptions {
  eventType?: string;
  eventId?: string;
  userId?: string;
  email?: string;
  emailVerified?: boolean;
  displayName?: string;
  creationDate?: string;
}

let fixtureSequence = 0;

/**
 * Create a Zitadel Actions v2 webhook payload matching `zitadelWebhookPayloadSchema`.
 * Defaults produce a valid, fresh `user.human.added` event.
 *
 * Maps legacy option names to the v2 payload format:
 * - eventType → event_type (with alias mapping)
 * - userId → aggregateID
 * - creationDate → created_at
 * - email/displayName/emailVerified → event_payload fields
 */
export function createZitadelPayload(opts: ZitadelPayloadOptions = {}) {
  fixtureSequence++;

  // Map legacy event types to Zitadel v2 names
  const EVENT_TYPE_MAP: Record<string, string> = {
    'user.created': 'user.human.added',
    'user.changed': 'user.human.changed',
    'user.deactivated': 'user.human.deactivated',
    'user.reactivated': 'user.human.reactivated',
    'user.removed': 'user.human.removed',
    'user.email.verified': 'user.human.email.verified',
  };

  const rawEventType = opts.eventType ?? 'user.created';
  const eventType = EVENT_TYPE_MAP[rawEventType] ?? rawEventType;
  const aggregateID = opts.userId ?? faker.string.uuid();

  return {
    aggregateID,
    aggregateType: 'user',
    resourceOwner: faker.string.uuid(),
    instanceID: faker.string.uuid(),
    version: 'v2',
    sequence: fixtureSequence,
    event_type: eventType,
    created_at: opts.creationDate ?? new Date().toISOString(),
    userID: faker.string.uuid(),
    event_payload: {
      userName: faker.internet.userName(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      displayName: opts.displayName ?? faker.person.fullName(),
      email: opts.email ?? faker.internet.email(),
      emailVerified: opts.emailVerified ?? false,
    },
  };
}
