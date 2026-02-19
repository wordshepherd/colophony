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

/**
 * Create a Zitadel webhook payload matching `zitadelWebhookPayloadSchema`.
 * Defaults produce a valid, fresh `user.created` event.
 */
export function createZitadelPayload(opts: ZitadelPayloadOptions = {}) {
  return {
    eventType: opts.eventType ?? 'user.created',
    eventId: opts.eventId ?? faker.string.uuid(),
    creationDate: opts.creationDate ?? new Date().toISOString(),
    user: {
      userId: opts.userId ?? faker.string.uuid(),
      email: opts.email ?? faker.internet.email(),
      emailVerified: opts.emailVerified ?? false,
      displayName: opts.displayName ?? faker.person.fullName(),
    },
  };
}
