import type { Publication } from '@colophony/types';
import { builder } from '../builder.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const PublicationStatusEnum = builder.enumType('PublicationStatus', {
  description: 'Status of a publication.',
  values: {
    ACTIVE: { description: 'Publication is active and accepting content.' },
    ARCHIVED: { description: 'Publication has been archived.' },
  } as const,
});

// ---------------------------------------------------------------------------
// Object type
// ---------------------------------------------------------------------------

export const PublicationType = builder
  .objectRef<Publication>('Publication')
  .implement({
    description:
      'A publication — a named publishing venue within an organization.',
    fields: (t) => ({
      id: t.exposeString('id', { description: 'Unique identifier.' }),
      organizationId: t.exposeString('organizationId', {
        description: 'ID of the owning organization.',
      }),
      name: t.exposeString('name', { description: 'Display name.' }),
      slug: t.exposeString('slug', {
        description: 'URL-friendly slug (unique per org).',
      }),
      description: t.exposeString('description', {
        nullable: true,
        description: 'Optional description.',
      }),
      status: t.exposeString('status', {
        description: 'Current status (ACTIVE or ARCHIVED).',
      }),
      createdAt: t.expose('createdAt', {
        type: 'DateTime',
        description: 'When the publication was created.',
      }),
      updatedAt: t.expose('updatedAt', {
        type: 'DateTime',
        description: 'When the publication was last updated.',
      }),
    }),
  });
