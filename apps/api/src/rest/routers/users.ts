import { ORPCError } from '@orpc/server';
import { userService } from '../../services/user.service.js';
import { authedProcedure, requireScopes } from '../context.js';

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
