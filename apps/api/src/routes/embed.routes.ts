import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Redis from 'ioredis';
import { embedSubmitSchema } from '@colophony/types';
import type { Env } from '../config/env.js';
import {
  embedTokenService,
  type VerifiedEmbedToken,
} from '../services/embed-token.service.js';
import {
  embedSubmissionService,
  PeriodClosedError,
} from '../services/embed-submission.service.js';

/**
 * Atomic Lua script: INCR key, set PEXPIRE on first hit, return [count, pttl].
 */
const RATE_LIMIT_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { current, ttl }
`;

export async function registerEmbedRoutes(
  app: FastifyInstance,
  opts: { env: Env },
): Promise<void> {
  const { env } = opts;

  // Lazy Redis connection for embed rate limiting
  let redis: Redis | null = null;

  function getRedis(): Redis | null {
    if (redis) return redis;
    try {
      redis = new Redis({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 0,
        connectTimeout: 5000,
        commandTimeout: 1000,
      });
      redis.connect().catch(() => {
        // Connection failure handled per-request via graceful degradation
      });
      return redis;
    } catch {
      return null;
    }
  }

  app.addHook('onClose', async () => {
    if (redis) {
      await redis.quit().catch(() => {
        // Ignore quit errors during shutdown
      });
    }
  });

  /**
   * Verify embed token from URL param.
   * Returns token details or sends error reply.
   */
  async function verifyTokenParam(
    request: FastifyRequest<{ Params: { token: string } }>,
    reply: FastifyReply,
  ): Promise<VerifiedEmbedToken | undefined> {
    const { token: plainTextToken } = request.params;

    // Basic format check
    if (!plainTextToken.startsWith('col_emb_') || plainTextToken.length < 20) {
      void reply
        .status(404)
        .send({ error: 'not_found', message: 'Invalid embed token' });
      return undefined;
    }

    const verified = await embedTokenService.verifyToken(plainTextToken);

    if (!verified) {
      void reply
        .status(404)
        .send({ error: 'not_found', message: 'Invalid embed token' });
      return undefined;
    }

    if (!verified.active) {
      void reply.status(404).send({
        error: 'not_found',
        message: 'Embed token has been revoked',
      });
      return undefined;
    }

    // Check expiration
    if (verified.expiresAt && verified.expiresAt < new Date()) {
      void reply
        .status(410)
        .send({ error: 'gone', message: 'Embed token has expired' });
      return undefined;
    }

    // Check period dates
    const now = new Date();
    if (now > verified.period.closesAt) {
      void reply
        .status(410)
        .send({ error: 'gone', message: 'Submission period has closed' });
      return undefined;
    }

    return verified;
  }

  // ---------------------------------------------------------------------------
  // GET /embed/:token — public form definition
  // ---------------------------------------------------------------------------
  app.get<{ Params: { token: string } }>(
    '/embed/:token',
    async (request, reply) => {
      const token = await verifyTokenParam(request, reply);
      if (!token) return;

      // Set CSP frame-ancestors
      const origins =
        token.allowedOrigins.length > 0 ? token.allowedOrigins.join(' ') : '*';
      void reply.header(
        'content-security-policy',
        `frame-ancestors ${origins}`,
      );

      // Load form definition
      const form = await embedSubmissionService.loadFormForEmbed(token);

      return {
        period: {
          id: token.submissionPeriodId,
          name: token.period.name,
          opensAt: token.period.opensAt,
          closesAt: token.period.closesAt,
        },
        form,
        theme: token.themeConfig,
        organizationId: token.organizationId,
      };
    },
  );

  // ---------------------------------------------------------------------------
  // POST /embed/:token/submit — submit from embed form
  // ---------------------------------------------------------------------------
  app.post<{ Params: { token: string } }>(
    '/embed/:token/submit',
    {
      bodyLimit: 512 * 1024, // 512KB
      /* eslint-disable @typescript-eslint/no-misused-promises */
      preHandler: async function embedRateLimit(
        request: FastifyRequest,
        reply: FastifyReply,
      ) {
        // Rate limit per IP
        const redisClient = getRedis();
        if (!redisClient) return; // Graceful degradation

        const windowMs = env.RATE_LIMIT_WINDOW_SECONDS * 1000;
        const windowId = Math.floor(Date.now() / windowMs);
        const key = `${env.RATE_LIMIT_KEY_PREFIX}:embed:${request.ip}:${windowId}`;

        try {
          const result = (await redisClient.eval(
            RATE_LIMIT_LUA,
            1,
            key,
            windowMs,
          )) as [number, number];
          const count = result[0];

          // Stricter limit for embed submissions (10 per window per IP)
          const embedLimit = 10;
          if (count > embedLimit) {
            const remainingMs = windowMs - (Date.now() % windowMs);
            const retryAfterSeconds = Math.ceil(remainingMs / 1000);
            reply.header('Retry-After', retryAfterSeconds);
            request.log.warn(
              { ip: request.ip, count, limit: embedLimit },
              'Embed submission rate limit exceeded',
            );
            return reply.status(429).send({
              error: 'rate_limit_exceeded',
              message: 'Too many submissions. Please try again later.',
            });
          }
        } catch {
          request.log.warn('Embed rate limit Redis error — allowing request');
        }
      },
      /* eslint-enable @typescript-eslint/no-misused-promises */
    },
    async (request, reply) => {
      const token = await verifyTokenParam(request, reply);
      if (!token) return;

      // Check origin on POST (CSRF protection)
      const origin = request.headers.origin;
      if (
        token.allowedOrigins.length > 0 &&
        origin &&
        !token.allowedOrigins.includes(origin)
      ) {
        return reply.status(403).send({
          error: 'forbidden',
          message: 'Origin not allowed for this embed token',
        });
      }

      // Validate body
      const parsed = embedSubmitSchema.safeParse(request.body);
      if (!parsed.success) {
        const errors = parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        }));
        return reply.status(400).send({
          error: 'validation_error',
          message: 'Invalid submission data',
          details: errors,
        });
      }

      try {
        const { submissionId } = await embedSubmissionService.submitFromEmbed(
          token,
          parsed.data,
          request.ip,
          request.headers['user-agent'],
        );

        return {
          success: true,
          submissionId,
          message: 'Submission received successfully',
        };
      } catch (err) {
        if (err instanceof PeriodClosedError) {
          return reply.status(410).send({
            error: 'gone',
            message: err.message,
          });
        }
        throw err;
      }
    },
  );
}
