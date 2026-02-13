import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createJwksVerifier } from '@colophony/auth-client';
import { db, eq, users } from '@colophony/db';
import type { AuthContext, AuthAuditParams } from '@prospector/types';
import { AuditActions, AuditResources } from '@prospector/types';
import type { Env } from '../config/env.js';
import { auditService } from '../services/audit.service.js';

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

    /** Log an auth failure audit event. Never throws — swallows errors. */
    async function logAuthFailure(
      request: FastifyRequest,
      action: AuthAuditParams['action'],
      details: Record<string, unknown>,
      actorId?: string,
    ): Promise<void> {
      try {
        await auditService.logDirect({
          action,
          resource: AuditResources.AUTH,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          newValue: details,
          actorId,
        });
      } catch (err) {
        request.log.warn({ err }, 'Failed to log auth failure audit event');
      }
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
          await logAuthFailure(request, AuditActions.AUTH_TOKEN_INVALID, {
            reason: 'invalid_header_format',
          });
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
          const isExpired = err instanceof Error && err.name === 'JWTExpired';
          request.log.warn({ err }, 'Token validation failed');
          await logAuthFailure(
            request,
            isExpired
              ? AuditActions.AUTH_TOKEN_EXPIRED
              : AuditActions.AUTH_TOKEN_INVALID,
            { reason: isExpired ? 'expired' : 'signature_failed' },
          );
          return reply.status(401).send({
            error: isExpired ? 'token_expired' : 'token_invalid',
            message: isExpired
              ? 'Token has expired'
              : 'Token validation failed',
          });
        }

        // Resolve local user by Zitadel user ID
        const user = await db.query.users.findFirst({
          where: eq(users.zitadelUserId, sub),
        });

        if (!user) {
          await logAuthFailure(
            request,
            AuditActions.AUTH_USER_NOT_PROVISIONED,
            { reason: 'not_provisioned', zitadelUserId: sub },
          );
          return reply.status(403).send({
            error: 'user_not_provisioned',
            message:
              'User not found. Account may not have been synced yet. Please try again shortly.',
          });
        }

        if (user.deletedAt) {
          await logAuthFailure(
            request,
            AuditActions.AUTH_USER_DEACTIVATED,
            { reason: 'deactivated', zitadelUserId: sub },
            user.id,
          );
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
