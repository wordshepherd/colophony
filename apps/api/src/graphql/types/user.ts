import type { User } from '@colophony/db';
import { builder } from '../builder.js';

export const UserType = builder.objectRef<User>('User').implement({
  description: 'A Colophony user account, synced from Zitadel.',
  fields: (t) => ({
    id: t.exposeString('id', { description: 'Unique identifier.' }),
    email: t.exposeString('email', { description: 'Primary email address.' }),
    emailVerified: t.exposeBoolean('emailVerified', {
      description: 'Whether the email has been verified.',
    }),
    createdAt: t.expose('createdAt', {
      type: 'DateTime',
      description: 'When the account was created.',
    }),
    updatedAt: t.expose('updatedAt', {
      type: 'DateTime',
      description: 'When the account was last updated.',
    }),
  }),
});
