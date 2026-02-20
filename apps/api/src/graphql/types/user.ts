import type { User } from '@colophony/db';
import { builder } from '../builder.js';

export const UserType = builder.objectRef<User>('User').implement({
  fields: (t) => ({
    id: t.exposeString('id'),
    email: t.exposeString('email'),
    emailVerified: t.exposeBoolean('emailVerified'),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    updatedAt: t.expose('updatedAt', { type: 'DateTime' }),
  }),
});
