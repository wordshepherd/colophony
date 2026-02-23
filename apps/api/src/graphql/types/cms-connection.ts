import type { CmsConnection } from '@colophony/types';
import { builder } from '../builder.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const CmsAdapterTypeEnum = builder.enumType('CmsAdapterType', {
  description: 'Type of CMS adapter.',
  values: {
    WORDPRESS: { description: 'WordPress REST API v2.' },
    GHOST: { description: 'Ghost Admin API.' },
  } as const,
});

// ---------------------------------------------------------------------------
// Object type
// ---------------------------------------------------------------------------

export const CmsConnectionType = builder
  .objectRef<CmsConnection>('CmsConnection')
  .implement({
    description:
      'A CMS connection — configuration for publishing to an external CMS.',
    fields: (t) => ({
      id: t.exposeString('id', { description: 'Unique identifier.' }),
      organizationId: t.exposeString('organizationId', {
        description: 'ID of the owning organization.',
      }),
      publicationId: t.exposeString('publicationId', {
        nullable: true,
        description: 'ID of the associated publication (optional).',
      }),
      adapterType: t.exposeString('adapterType', {
        description: 'CMS adapter type (WORDPRESS or GHOST).',
      }),
      name: t.exposeString('name', { description: 'Display name.' }),
      isActive: t.exposeBoolean('isActive', {
        description: 'Whether the connection is active.',
      }),
      lastSyncAt: t.expose('lastSyncAt', {
        type: 'DateTime',
        nullable: true,
        description: 'When the connection was last used for publishing.',
      }),
      createdAt: t.expose('createdAt', {
        type: 'DateTime',
        description: 'When the connection was created.',
      }),
      updatedAt: t.expose('updatedAt', {
        type: 'DateTime',
        description: 'When the connection was last updated.',
      }),
    }),
  });
