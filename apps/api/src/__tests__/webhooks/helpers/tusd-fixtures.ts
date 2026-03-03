import { faker } from '@faker-js/faker';

interface TusdPreCreateOptions {
  manuscriptVersionId?: string;
  userId?: string;
  orgId?: string;
  filename?: string;
  mimeType?: string;
  size?: number;
}

interface TusdPostFinishOptions {
  manuscriptVersionId?: string;
  userId?: string;
  orgId?: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  storageKey?: string;
  uploadId?: string;
}

/**
 * Create a tusd v2 pre-create hook payload.
 * Wraps the inner event in the v2 envelope `{ Type, Event }`.
 */
export function createPreCreatePayload(opts: TusdPreCreateOptions = {}) {
  const userId = opts.userId ?? faker.string.uuid();
  const orgId = opts.orgId ?? faker.string.uuid();
  const manuscriptVersionId = opts.manuscriptVersionId ?? faker.string.uuid();

  return {
    Type: 'pre-create',
    Event: {
      Upload: {
        Size: opts.size ?? 1024,
        MetaData: {
          'manuscript-version-id': manuscriptVersionId,
          filename: opts.filename ?? 'test-file.pdf',
          filetype: opts.mimeType ?? 'application/pdf',
        },
      },
      HTTPRequest: {
        Method: 'POST',
        URI: '/files/',
        RemoteAddr: '127.0.0.1',
        Header: {
          'X-Test-User-Id': [userId],
          'X-Organization-Id': [orgId],
        },
      },
    },
  };
}

/**
 * Create a tusd v2 post-finish hook payload.
 * Wraps the inner event in the v2 envelope `{ Type, Event }`.
 */
export function createPostFinishPayload(opts: TusdPostFinishOptions = {}) {
  const userId = opts.userId ?? faker.string.uuid();
  const orgId = opts.orgId ?? faker.string.uuid();
  const manuscriptVersionId = opts.manuscriptVersionId ?? faker.string.uuid();
  const uploadId = opts.uploadId ?? faker.string.uuid();
  const storageKey =
    opts.storageKey ??
    `uploads/${faker.string.uuid()}/${opts.filename ?? 'test-file.pdf'}`;

  return {
    Type: 'post-finish',
    Event: {
      Upload: {
        ID: uploadId,
        Size: opts.size ?? 1024,
        Offset: opts.size ?? 1024,
        MetaData: {
          'manuscript-version-id': manuscriptVersionId,
          filename: opts.filename ?? 'test-file.pdf',
          filetype: opts.mimeType ?? 'application/pdf',
        },
        Storage: {
          Bucket: 'quarantine',
          Key: storageKey,
          Type: 's3store',
        },
      },
      HTTPRequest: {
        Method: 'PATCH',
        URI: `/files/${uploadId}`,
        RemoteAddr: '127.0.0.1',
        Header: {
          'X-Test-User-Id': [userId],
          'X-Organization-Id': [orgId],
        },
      },
    },
  };
}
