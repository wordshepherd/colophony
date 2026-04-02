import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createJwksVerifier } from '@colophony/auth-client';
import { db, eq, and, isNull, sql, users, type DrizzleDb } from '@colophony/db';
import type { JWTPayload } from 'jose';
import type {
  AuthContext,
  AuthAuditParams,
  ApiKeyAuditParams,
  ApiKeyScope,
} from '@colophony/types';
import { AuditActions, AuditResources } from '@colophony/types';
import type { Env } from '../config/env.js';
import { auditService } from '../services/audit.service.js';
import { apiKeyService } from '../services/api-key.service.js';

declare module 'fastify' {
  interface FastifyRequest {
    authContext: AuthContext | null;
  }
}

/**
 * Routes that skip authentication entirely (default-deny allowlist).
 *
 * To add a new public route:
 * 1. Add the exact path to PUBLIC_EXACT or prefix to PUBLIC_PREFIXES
 * 2. Add a corresponding test in auth.spec.ts
 * 3. Document in apps/api/CLAUDE.md
 */
const PUBLIC_PREFIXES = [
  '/health',
  '/ready',
  '/webhooks/',
  '/.well-known/',
  '/embed/',
  '/api/inngest',
  '/federation/trust',
  '/federation/v1/',
  '/v1/public/',
];
const PUBLIC_EXACT = [
  '/',
  '/health',
  '/ready',
  '/metrics',
  '/trpc/health',
  '/v1/openapi.json',
  '/v1/docs',
];

function isPublicRoute(url: string): boolean {
  const path = url.split('?')[0].replace(/\/+$/, '') || '/';
  if (PUBLIC_EXACT.includes(path)) return true;
  if (PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;
  // DID document endpoints (did:web resolution)
  if (path.endsWith('/did.json')) return true;
  return false;
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

    // --- Per-IP auth failure throttle ---
    const throttleMax = env.AUTH_FAILURE_THROTTLE_MAX;
    const throttleWindowMs = env.AUTH_FAILURE_THROTTLE_WINDOW_SECONDS * 1000;
    const FAILURE_MAP_MAX_SIZE = 10_000;
    const failureMap = new Map<
      string,
      { count: number; windowStart: number }
    >();

    function recordAuthFailure(ip: string): void {
      const now = Date.now();
      const entry = failureMap.get(ip);
      if (!entry || now - entry.windowStart >= throttleWindowMs) {
        // New entry or expired window — check capacity before inserting new IP
        if (!entry && failureMap.size >= FAILURE_MAP_MAX_SIZE) {
          // Fail-open: skip tracking for new IPs when map is at capacity.
          // Redis rate-limit hook provides broader DDoS protection.
          return;
        }
        failureMap.set(ip, { count: 1, windowStart: now });
      } else {
        entry.count++;
      }
    }

    function isThrottled(ip: string): boolean {
      const entry = failureMap.get(ip);
      if (!entry) return false;
      if (Date.now() - entry.windowStart >= throttleWindowMs) {
        failureMap.delete(ip);
        return false;
      }
      return entry.count >= throttleMax;
    }

    // Cleanup interval to prune expired entries (prevent memory growth)
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [ip, entry] of failureMap) {
        if (now - entry.windowStart >= throttleWindowMs) {
          failureMap.delete(ip);
        }
      }
    }, 60_000);

    app.addHook('onClose', async () => {
      clearInterval(cleanupInterval);
      failureMap.clear();
    });

    // Production guard: fail fast if Zitadel is not configured
    if (isProduction && !env.ZITADEL_AUTHORITY) {
      throw new Error(
        'ZITADEL_AUTHORITY is required in production. Cannot start without auth.',
      );
    }

    // Dev bypass: only when not production, no Zitadel configured, and explicitly opted in
    const devAuthBypass =
      !isProduction && !env.ZITADEL_AUTHORITY && env.DEV_AUTH_BYPASS;

    // Development warning
    if (!isProduction && !isTest && !env.ZITADEL_AUTHORITY) {
      if (devAuthBypass) {
        app.log.warn(
          'DEV_AUTH_BYPASS is active — unauthenticated requests allowed on all routes. Do NOT use in production.',
        );
      } else {
        app.log.warn(
          'ZITADEL_AUTHORITY not set — all non-public routes will return 401. Set ZITADEL_AUTHORITY to enable OIDC or DEV_AUTH_BYPASS=true for local development.',
        );
      }
    }

    /** Log an auth failure audit event. Never throws — swallows errors. */
    async function logAuthFailure(
      request: FastifyRequest,
      action: AuthAuditParams['action'] | ApiKeyAuditParams['action'],
      details: Record<string, unknown>,
      actorId?: string,
    ): Promise<void> {
      recordAuthFailure(request.ip);
      try {
        const isApiKeyAction = action.startsWith('API_KEY_');
        const resource = isApiKeyAction
          ? AuditResources.API_KEY
          : AuditResources.AUTH;

        await auditService.logDirect({
          action,
          resource,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          newValue: details,
          actorId,
          requestId: String(request.id),
          method: request.method,
          route: request.routeOptions?.url ?? request.url.split('?')[0],
        } as AuthAuditParams | ApiKeyAuditParams);
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

        // Per-IP auth failure throttle — block before doing any work
        if (isThrottled(request.ip)) {
          return reply.status(429).send({
            error: 'too_many_auth_failures',
            message: 'Too many authentication failures. Try again later.',
          });
        }

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
              authMethod: 'test',
            };
            return;
          }
          // Default-deny: no test headers on a non-public route → 401
          return reply.status(401).send({
            error: 'unauthorized',
            message:
              'Missing authentication. Provide x-test-user-id header in test mode.',
          });
        }

        // Demo mode: allow demo user injection via header (gated behind DEMO_MODE env var)
        if (env.DEMO_MODE) {
          const demoUserId = request.headers['x-demo-user-id'] as
            | string
            | undefined;
          if (demoUserId) {
            const allowedIds = (env.DEMO_USER_IDS || '')
              .split(',')
              .filter(Boolean);
            if (!allowedIds.includes(demoUserId)) {
              return reply.status(401).send({
                error: 'unauthorized',
                message: 'Invalid demo user',
              });
            }
            const [demoUser] = await db
              .select()
              .from(users)
              .where(eq(users.id, demoUserId))
              .limit(1);
            if (!demoUser) {
              return reply.status(401).send({
                error: 'unauthorized',
                message: 'Demo user not found',
              });
            }
            request.authContext = {
              userId: demoUser.id,
              zitadelUserId: demoUser.zitadelUserId ?? demoUserId,
              email: demoUser.email,
              emailVerified: true,
              authMethod: 'demo',
            };
            return;
          }
        }

        // Extract Bearer token
        const authHeader = request.headers.authorization;
        if (!authHeader) {
          // Check for API key before rejecting
          const apiKeyHeader = request.headers['x-api-key'] as
            | string
            | undefined;
          if (apiKeyHeader) {
            const result = await apiKeyService.verifyKey(apiKeyHeader);
            if (!result) {
              void logAuthFailure(request, AuditActions.API_KEY_AUTH_FAILED, {
                reason: 'invalid_key',
                keyPrefix: apiKeyHeader.substring(0, 12),
              });
              return reply.status(401).send({
                error: 'unauthorized',
                message: 'Invalid API key',
              });
            }
            const { apiKey, creator } = result;
            if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
              void logAuthFailure(request, AuditActions.API_KEY_AUTH_FAILED, {
                reason: 'expired',
                keyId: apiKey.id,
              });
              return reply.status(401).send({
                error: 'unauthorized',
                message: 'API key has expired',
              });
            }
            if (apiKey.revokedAt) {
              void logAuthFailure(request, AuditActions.API_KEY_AUTH_FAILED, {
                reason: 'revoked',
                keyId: apiKey.id,
              });
              return reply.status(401).send({
                error: 'unauthorized',
                message: 'API key has been revoked',
              });
            }
            if (creator.deletedAt) {
              void logAuthFailure(request, AuditActions.API_KEY_AUTH_FAILED, {
                reason: 'creator_deactivated',
                keyId: apiKey.id,
              });
              return reply.status(401).send({
                error: 'unauthorized',
                message: 'API key creator account has been deactivated',
              });
            }
            request.authContext = {
              userId: creator.id,
              email: creator.email,
              emailVerified: creator.emailVerified,
              authMethod: 'apikey',
              apiKeyId: apiKey.id,
              apiKeyScopes: apiKey.scopes as ApiKeyScope[],
              orgId: apiKey.organizationId,
            };
            // Fire-and-forget: update lastUsedAt
            void apiKeyService.touchLastUsed(apiKey.id);
            return;
          }

          // Dev bypass: allow unauthenticated requests in dev mode when explicitly enabled
          if (devAuthBypass) {
            request.log.debug(
              'DEV_AUTH_BYPASS: allowing unauthenticated request',
            );
            return;
          }
          void logAuthFailure(request, AuditActions.AUTH_TOKEN_INVALID, {
            reason: 'missing_authorization_header',
          });
          return reply.status(401).send({
            error: 'unauthorized',
            message: 'Missing Authorization header',
          });
        }

        const match = /^Bearer\s+(\S+)$/i.exec(authHeader);
        if (!match) {
          void logAuthFailure(request, AuditActions.AUTH_TOKEN_INVALID, {
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
        let payload: JWTPayload;
        try {
          const result = await verifyToken(token);
          payload = result.payload;
          if (!payload.sub) {
            void logAuthFailure(request, AuditActions.AUTH_TOKEN_INVALID, {
              reason: 'missing_sub_claim',
            });
            return reply.status(401).send({
              error: 'token_invalid',
              message: 'Token missing subject claim',
            });
          }
          sub = payload.sub;
        } catch (err) {
          const isExpired = err instanceof Error && err.name === 'JWTExpired';
          request.log.warn({ err }, 'Token validation failed');
          void logAuthFailure(
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
        let user = await db.query.users.findFirst({
          where: eq(users.zitadelUserId, sub),
        });

        if (!user) {
          // JIT provisioning: create user from OIDC token claims
          const rawEmail =
            (payload.email as string | undefined) ?? `${sub}@placeholder.local`;
          const jitEmail = rawEmail.toLowerCase().trim();
          const jitDisplayName =
            (payload.name as string | undefined) ?? undefined;
          const jitEmailVerified =
            (payload.email_verified as boolean | undefined) ?? false;

          try {
            const [jitUser] = await db.transaction(async (tx) => {
              const [created] = await tx
                .insert(users)
                .values({
                  email: jitEmail,
                  zitadelUserId: sub,
                  ...(jitDisplayName ? { displayName: jitDisplayName } : {}),
                  emailVerified: jitEmailVerified,
                  emailVerifiedAt: jitEmailVerified ? new Date() : undefined,
                })
                .onConflictDoUpdate({
                  target: users.zitadelUserId,
                  targetWhere: sql`${users.zitadelUserId} IS NOT NULL`,
                  set: { updatedAt: new Date() },
                })
                .returning();

              await auditService.log(tx as unknown as DrizzleDb, {
                action: AuditActions.USER_JIT_PROVISIONED,
                resource: AuditResources.USER,
                resourceId: created.id,
                newValue: {
                  zitadelUserId: sub,
                  email: created.email,
                  source: 'jit',
                },
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'],
              });

              return [created];
            });

            request.log.info(
              { zitadelUserId: sub, email: jitUser.email },
              'JIT provisioned user',
            );
            user = jitUser;
          } catch (err) {
            // Email uniqueness conflict — a guest user with this email exists.
            // Link the Zitadel identity to the existing guest record.
            if ((err as { code?: string }).code === '23505') {
              const [linked] = await db
                .update(users)
                .set({
                  zitadelUserId: sub,
                  isGuest: false,
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(users.email, jitEmail),
                    eq(users.isGuest, true),
                    isNull(users.deletedAt),
                  ),
                )
                .returning();

              if (linked) {
                request.log.info(
                  { zitadelUserId: sub, email: linked.email },
                  'JIT linked to existing guest user',
                );
                user = linked;
              } else {
                void logAuthFailure(
                  request,
                  AuditActions.AUTH_USER_NOT_PROVISIONED,
                  { reason: 'jit_link_failed', zitadelUserId: sub },
                );
                return reply.status(403).send({
                  error: 'user_not_provisioned',
                  message: 'User provisioning failed. Please try again.',
                });
              }
            } else {
              throw err;
            }
          }
        }

        if (user.deletedAt) {
          void logAuthFailure(
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
          authMethod: 'oidc',
        };
      },
    );
  },
  {
    name: 'colophony-auth',
    fastify: '5.x',
  },
);
