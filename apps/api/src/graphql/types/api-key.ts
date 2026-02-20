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
    description: 'An organization-scoped API key for programmatic access.',
    fields: (t) => ({
      id: t.exposeString('id', { description: 'Unique identifier.' }),
      name: t.exposeString('name', { description: 'Human-readable name.' }),
      scopes: t.expose('scopes', {
        type: 'JSON',
        description: 'Granted permission scopes.',
      }),
      keyPrefix: t.exposeString('keyPrefix', {
        description: 'First characters of the key for identification.',
      }),
      createdAt: t.expose('createdAt', {
        type: 'DateTime',
        description: 'When the key was created.',
      }),
      expiresAt: t.expose('expiresAt', {
        type: 'DateTime',
        nullable: true,
        description: 'When the key expires (null = never).',
      }),
      lastUsedAt: t.expose('lastUsedAt', {
        type: 'DateTime',
        nullable: true,
        description: 'When the key was last used for authentication.',
      }),
      revokedAt: t.expose('revokedAt', {
        type: 'DateTime',
        nullable: true,
        description: 'When the key was revoked (null = active).',
      }),
    }),
  });
