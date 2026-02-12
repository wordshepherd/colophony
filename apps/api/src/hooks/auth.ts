import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createJwksVerifier } from '@colophony/auth-client';
import { db, eq, users } from '@colophony/db';
import type { AuthContext } from '@prospector/types';
import type { Env } from '../config/env.js';

declare module 'fastify' {
  interface FastifyRequest {
    authContext: AuthContext | null;
  }
}

/** Routes that skip authentication entirely. */
const PUBLIC_PREFIXES = ['/health', '/ready', '/webhooks/', '/.well-known/'];
const PUBLIC_EXACT = ['/', '/health', '/ready'];

function isPublicRoute(url: string): boolean {
  const path = url.split('?')[0];
  if (PUBLIC_EXACT.includes(path)) return true;
  return PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export interface AuthPluginOptions {
  env: Env;
}

export default fp(
  async function authPlugin(app: FastifyInstance, opts: AuthPluginOptions) {
    const { env } = opts;

    // Decorate request with null authContext
    app.decorateRequest('authContext', null);

    const isProduction = env.NODE_ENV === 'production';
    const isTest = env.NODE_ENV === 'test';

    // Production guard: fail fast if Zitadel is not configured
    if (isProduction && !env.ZITADEL_AUTHORITY) {
      throw new Error(
        'ZITADEL_AUTHORITY is required in production. Cannot start without auth.',
      );
    }

    // Development warning
    if (!isProduction && !isTest && !env.ZITADEL_AUTHORITY) {
      app.log.warn(
        'ZITADEL_AUTHORITY not set — auth hook will reject all authenticated requests. Set it to enable OIDC.',
      );
    }

    // Create JWKS verifier if authority is configured
    const verifyToken = env.ZITADEL_AUTHORITY
      ? createJwksVerifier({
          authority: env.ZITADEL_AUTHORITY,
          clientId: env.ZITADEL_CLIENT_ID,
        })
      : null;

    app.addHook(
      'onRequest',
      async function authHook(request: FastifyRequest, reply: FastifyReply) {
        // Skip public routes
        if (isPublicRoute(request.url)) return;

        // Test mode: allow injection via headers when no JWKS verifier
        if (isTest && !verifyToken) {
          const testUserId = request.headers['x-test-user-id'] as
            | string
            | undefined;
          const testEmail = request.headers['x-test-email'] as
            | string
            | undefined;

          if (testUserId) {
            request.authContext = {
              userId: testUserId,
              zitadelUserId:
                (request.headers['x-test-zitadel-id'] as string) ?? testUserId,
              email: testEmail ?? 'test@example.com',
              emailVerified: true,
            };
          }
          return;
        }

        // Extract Bearer token
        const authHeader = request.headers.authorization;
        if (!authHeader) return; // No auth header — routes decide if auth is required

        const match = /^Bearer\s+(\S+)$/i.exec(authHeader);
        if (!match) {
          return reply.status(401).send({
            error: 'unauthorized',
            message:
              'Invalid Authorization header format. Expected: Bearer <token>',
          });
        }

        const token = match[1];

        if (!verifyToken) {
          return reply.status(401).send({
            error: 'unauthorized',
            message: 'Auth not configured. Set ZITADEL_AUTHORITY.',
          });
        }

        // Validate token
        let sub: string;
        try {
          const { payload } = await verifyToken(token);
          if (!payload.sub) {
            return reply.status(401).send({
              error: 'token_invalid',
              message: 'Token missing subject claim',
            });
          }
          sub = payload.sub;
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Token validation failed';
          const isExpired = message.includes('exp');
          return reply.status(401).send({
            error: isExpired ? 'token_expired' : 'token_invalid',
            message,
          });
        }

        // Resolve local user by Zitadel user ID
        const user = await db.query.users.findFirst({
          where: eq(users.zitadelUserId, sub),
        });

        if (!user) {
          return reply.status(403).send({
            error: 'user_not_provisioned',
            message:
              'User not found. Account may not have been synced yet. Please try again shortly.',
          });
        }

        if (user.deletedAt) {
          return reply.status(403).send({
            error: 'user_deactivated',
            message: 'Account has been deactivated.',
          });
        }

        request.authContext = {
          userId: user.id,
          zitadelUserId: sub,
          email: user.email,
          emailVerified: user.emailVerified,
        };
      },
    );
  },
  {
    name: 'colophony-auth',
    fastify: '5.x',
  },
);
