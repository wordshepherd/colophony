import { authedProcedure, createRouter, requireScopes } from '../init.js';
import { userService } from '../../services/user.service.js';

export const usersRouter = createRouter({
  me: authedProcedure
    .use(requireScopes('users:read'))
    .query(async ({ ctx }) => {
      return userService.getProfile(ctx.authContext.userId);
    }),
});
