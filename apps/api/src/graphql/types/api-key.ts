import { builder } from '../builder.js';

export const ApiKeyType = builder
  .objectRef<{
    id: string;
    name: string;
    scopes: unknown;
    keyPrefix: string;
    createdAt: Date;
    expiresAt: Date | null;
    lastUsedAt: Date | null;
    revokedAt: Date | null;
  }>('ApiKey')
  .implement({
    fields: (t) => ({
      id: t.exposeString('id'),
      name: t.exposeString('name'),
      scopes: t.expose('scopes', { type: 'JSON' }),
      keyPrefix: t.exposeString('keyPrefix'),
      createdAt: t.expose('createdAt', { type: 'DateTime' }),
      expiresAt: t.expose('expiresAt', { type: 'DateTime', nullable: true }),
      lastUsedAt: t.expose('lastUsedAt', {
        type: 'DateTime',
        nullable: true,
      }),
      revokedAt: t.expose('revokedAt', { type: 'DateTime', nullable: true }),
    }),
  });
