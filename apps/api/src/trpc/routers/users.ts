import { pool } from '@colophony/db';
import { authedProcedure, createRouter } from '../init.js';
import { organizationService } from '../../services/organization.service.js';

export const usersRouter = createRouter({
  me: authedProcedure.query(async ({ ctx }) => {
    // Query user from the pool directly (users table has no RLS)
    const result = await pool.query<{
      id: string;
      email: string;
      email_verified: boolean;
      created_at: Date;
    }>(
      'SELECT id, email, email_verified, created_at FROM users WHERE id = $1 LIMIT 1',
      [ctx.authContext.userId],
    );

    const user = result.rows[0];
    if (!user) {
      return null;
    }

    // Get org memberships via SECURITY DEFINER function (bypasses RLS)
    const orgs = await organizationService.listUserOrganizations(
      ctx.authContext.userId,
    );

    return {
      id: user.id,
      email: user.email,
      emailVerified: user.email_verified,
      createdAt: user.created_at,
      organizations: orgs.map((o) => ({
        organizationId: o.organizationId,
        name: o.name,
        slug: o.slug,
        role: o.role,
      })),
    };
  }),
});
