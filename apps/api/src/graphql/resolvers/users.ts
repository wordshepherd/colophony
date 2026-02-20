import { builder } from '../builder.js';
import { requireAuth, requireScopes } from '../guards.js';
import { userService } from '../../services/user.service.js';

/** User profile shape (from userService.getProfile). */
const UserProfileType = builder
  .objectRef<{
    id: string;
    email: string;
    emailVerified: boolean;
    createdAt: Date;
    organizations: {
      id: string;
      name: string;
      slug: string;
      role: string;
    }[];
  }>('UserProfile')
  .implement({
    fields: (t) => ({
      id: t.exposeString('id'),
      email: t.exposeString('email'),
      emailVerified: t.exposeBoolean('emailVerified'),
      createdAt: t.expose('createdAt', { type: 'DateTime' }),
      organizations: t.field({
        type: [UserProfileOrgType],
        resolve: (p) => p.organizations,
      }),
    }),
  });

const UserProfileOrgType = builder
  .objectRef<{
    id: string;
    name: string;
    slug: string;
    role: string;
  }>('UserProfileOrganization')
  .implement({
    fields: (t) => ({
      id: t.exposeString('id'),
      name: t.exposeString('name'),
      slug: t.exposeString('slug'),
      role: t.exposeString('role'),
    }),
  });

// ---------------------------------------------------------------------------
// Query fields
// ---------------------------------------------------------------------------

builder.queryFields((t) => ({
  /**
   * Get the current user's profile (cross-org, no RLS needed).
   */
  me: t.field({
    type: UserProfileType,
    nullable: true,
    description:
      "Get the current user's profile with organization memberships.",
    resolve: async (_root, _args, ctx) => {
      const authed = requireAuth(ctx);
      await requireScopes(ctx, 'users:read');
      return userService.getProfile(authed.authContext.userId);
    },
  }),
}));
