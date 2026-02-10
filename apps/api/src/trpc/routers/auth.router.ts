import { TRPCError } from '@trpc/server';
import { router, publicProcedure, authedProcedure } from '../trpc.service';
import { trpcRegistry } from '../trpc.registry';
import {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  authResponseSchema,
  emailVerificationSchema,
  resendVerificationSchema,
  emailVerificationResponseSchema,
} from '@prospector/types';
import { AuditActions, AuditResources } from '../../modules/audit';

/**
 * Extract IP address from request
 */
function getIpAddress(req: Express.Request): string | undefined {
  const forwarded = (
    req as unknown as { headers: Record<string, string | string[]> }
  ).headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return (req as unknown as { ip?: string }).ip ?? undefined;
}

/**
 * Extract user agent from request
 */
function getUserAgent(req: Express.Request): string | undefined {
  return (req as unknown as { headers: Record<string, string | string[]> })
    .headers['user-agent'] as string | undefined;
}

/**
 * Auth router handles authentication operations.
 * These are public procedures (except logout which requires auth).
 */
export const authRouter = router({
  /**
   * Register a new user
   */
  register: publicProcedure
    .input(registerSchema)
    .output(authResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await trpcRegistry.authService.register(input);

      // Get user ID from the newly created token
      const payload = trpcRegistry.authService.verifyAccessToken(
        result.accessToken,
      );

      // Audit log - user registration
      await trpcRegistry.auditService.logSafe({
        actorId: payload?.sub ?? null,
        action: AuditActions.USER_REGISTERED,
        resource: AuditResources.USER,
        resourceId: payload?.sub ?? null,
        newValue: { email: input.email },
        ipAddress: getIpAddress(ctx.req),
        userAgent: getUserAgent(ctx.req),
      });

      return result;
    }),

  /**
   * Login with email and password
   */
  login: publicProcedure
    .input(loginSchema)
    .output(authResponseSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await trpcRegistry.authService.login(input);

        // Get user ID from the token
        const payload = trpcRegistry.authService.verifyAccessToken(
          result.accessToken,
        );

        // Audit log - successful login
        await trpcRegistry.auditService.logSafe({
          actorId: payload?.sub ?? null,
          action: AuditActions.USER_LOGIN,
          resource: AuditResources.USER,
          resourceId: payload?.sub ?? null,
          ipAddress: getIpAddress(ctx.req),
          userAgent: getUserAgent(ctx.req),
        });

        return result;
      } catch (error) {
        // Audit log - failed login attempt
        await trpcRegistry.auditService.logSafe({
          action: AuditActions.USER_LOGIN_FAILED,
          resource: AuditResources.USER,
          newValue: { email: input.email },
          ipAddress: getIpAddress(ctx.req),
          userAgent: getUserAgent(ctx.req),
        });

        throw error;
      }
    }),

  /**
   * Refresh access token using refresh token
   */
  refresh: publicProcedure
    .input(refreshTokenSchema)
    .output(authResponseSchema)
    .mutation(async ({ input }) => {
      return trpcRegistry.authService.refresh(input.refreshToken);
    }),

  /**
   * Logout - revokes all refresh tokens
   */
  logout: authedProcedure.mutation(async ({ ctx }) => {
    await trpcRegistry.authService.logout(ctx.user.userId);

    // Audit log - logout
    await trpcRegistry.auditService.logSafe({
      actorId: ctx.user.userId,
      action: AuditActions.USER_LOGOUT,
      resource: AuditResources.USER,
      resourceId: ctx.user.userId,
      ipAddress: getIpAddress(ctx.req),
      userAgent: getUserAgent(ctx.req),
    });

    return { success: true };
  }),

  /**
   * Get current user info
   */
  me: authedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.user.userId },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        createdAt: true,
        memberships: {
          select: {
            role: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      organizations: user.memberships,
    };
  }),

  /**
   * Verify email with token
   */
  verifyEmail: publicProcedure
    .input(emailVerificationSchema)
    .output(emailVerificationResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await trpcRegistry.authService.verifyEmail(input.token);

      // If verification was successful and not "already verified", log it
      if (result.success && result.message !== 'Email already verified') {
        // We can't easily get the user ID here without modifying the auth service
        // For now, we'll log without the user ID
        await trpcRegistry.auditService.logSafe({
          action: AuditActions.EMAIL_VERIFIED,
          resource: AuditResources.USER,
          ipAddress: getIpAddress(ctx.req),
          userAgent: getUserAgent(ctx.req),
        });
      }

      return result;
    }),

  /**
   * Resend verification email
   */
  resendVerification: publicProcedure
    .input(resendVerificationSchema)
    .output(emailVerificationResponseSchema)
    .mutation(async ({ input }) => {
      return trpcRegistry.authService.resendVerificationEmail(input.email);
    }),
});

export type AuthRouter = typeof authRouter;
