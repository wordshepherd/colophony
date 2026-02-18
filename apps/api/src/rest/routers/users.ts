import { ORPCError } from '@orpc/server';
import { userService } from '../../services/user.service.js';
import { authedProcedure } from '../context.js';

// ---------------------------------------------------------------------------
// User routes
// ---------------------------------------------------------------------------

const me = authedProcedure
  .route({ method: 'GET', path: '/users/me' })
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
