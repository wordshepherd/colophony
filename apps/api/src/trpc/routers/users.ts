import { authedProcedure, createRouter } from '../init.js';
import { userService } from '../../services/user.service.js';

export const usersRouter = createRouter({
  me: authedProcedure.query(async ({ ctx }) => {
    return userService.getProfile(ctx.authContext.userId);
  }),
});
