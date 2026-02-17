import { pool } from '@colophony/db';
import { organizationService } from './organization.service.js';

export const userService = {
  /**
   * Get user profile with organization memberships.
   * Uses pool directly (users table has no RLS) and SECURITY DEFINER
   * function for org lookups (bypasses RLS for cross-tenant query).
   */
  async getProfile(userId: string) {
    const result = await pool.query<{
      id: string;
      email: string;
      email_verified: boolean;
      created_at: Date;
    }>(
      'SELECT id, email, email_verified, created_at FROM users WHERE id = $1 LIMIT 1',
      [userId],
    );

    const user = result.rows[0];
    if (!user) {
      return null;
    }

    const orgs = await organizationService.listUserOrganizations(userId);

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
  },
};
