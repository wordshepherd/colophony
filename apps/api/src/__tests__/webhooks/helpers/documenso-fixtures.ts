import { faker } from '@faker-js/faker';
import crypto from 'node:crypto';

interface DocumensoWebhookPayload {
  event: string;
  data: {
    id: string;
    documentId: string;
    status?: string;
    [key: string]: unknown;
  };
}

interface DocumensoEventOptions {
  documentId?: string;
  id?: string;
  status?: string;
}

export function createDocumentSignedEvent(
  opts: DocumensoEventOptions = {},
): DocumensoWebhookPayload {
  return {
    event: 'DOCUMENT_SIGNED',
    data: {
      id: opts.id ?? faker.string.uuid(),
      documentId: opts.documentId ?? faker.string.uuid(),
      status: opts.status ?? 'SIGNED',
    },
  };
}

export function createDocumentCompletedEvent(
  opts: DocumensoEventOptions = {},
): DocumensoWebhookPayload {
  return {
    event: 'DOCUMENT_COMPLETED',
    data: {
      id: opts.id ?? faker.string.uuid(),
      documentId: opts.documentId ?? faker.string.uuid(),
      status: opts.status ?? 'COMPLETED',
    },
  };
}

export function createUnknownEvent(
  opts: { event?: string } & DocumensoEventOptions = {},
): DocumensoWebhookPayload {
  return {
    event: opts.event ?? 'DOCUMENT_VIEWED',
    data: {
      id: opts.id ?? faker.string.uuid(),
      documentId: opts.documentId ?? faker.string.uuid(),
    },
  };
}

/**
 * Compute a valid HMAC-SHA256 hex signature for a payload string.
 */
export function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}
