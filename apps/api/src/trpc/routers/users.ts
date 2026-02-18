import { userProfileSchema } from '@colophony/types';
import { authedProcedure, createRouter, requireScopes } from '../init.js';
import { userService } from '../../services/user.service.js';

export const usersRouter = createRouter({
  me: authedProcedure
    .use(requireScopes('users:read'))
    .output(userProfileSchema.nullable())
    .query(async ({ ctx }) => {
      return userService.getProfile(ctx.authContext.userId);
    }),
});
