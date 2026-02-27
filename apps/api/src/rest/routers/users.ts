import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { roleSchema } from '@colophony/types';
import { userService } from '../../services/user.service.js';
import { authedProcedure, requireScopes } from '../context.js';

// ---------------------------------------------------------------------------
// Output schemas
// ---------------------------------------------------------------------------

const userProfileOutputSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  emailVerified: z.boolean(),
  createdAt: z.date(),
  organizations: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      slug: z.string(),
      role: roleSchema,
    }),
  ),
});

// ---------------------------------------------------------------------------
// User routes
// ---------------------------------------------------------------------------

const me = authedProcedure
  .use(requireScopes('users:read'))
  .route({
    method: 'GET',
    path: '/users/me',
    summary: 'Get current user profile',
    description:
      "Returns the authenticated user's profile including organization memberships.",
    operationId: 'getCurrentUser',
    tags: ['Users'],
  })
  .output(userProfileOutputSchema)
  .handler(async ({ context }) => {
    const profile = await userService.getProfile(context.authContext.userId);
    if (!profile) {
      throw new ORPCError('NOT_FOUND', { message: 'User not found' });
    }
    return profile;
  });

// ---------------------------------------------------------------------------
// Assembled router
// ---------------------------------------------------------------------------

export const usersRouter = {
  me,
};
