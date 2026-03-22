import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Redis from 'ioredis';
import {
  embedSubmitSchema,
  embedPrepareUploadSchema,
  embedUploadStatusQuerySchema,
  embedResubmitSubmitSchema,
  STATUS_TOKEN_PREFIX,
} from '@colophony/types';
import {
  NotReviseAndResubmitError,
  UnscannedFilesError,
  InfectedFilesError,
} from '../services/submission.service.js';
import type { Env } from '../config/env.js';
import {
  embedTokenService,
  type VerifiedEmbedToken,
} from '../services/embed-token.service.js';
import {
  embedSubmissionService,
  PeriodClosedError,
} from '../services/embed-submission.service.js';
import { statusTokenService } from '../services/status-token.service.js';

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
    },
    async (request, reply) => {
      const token = await verifyTokenParam(request, reply);
      if (!token) return;

      // Check origin on POST (CSRF protection)
      const origin = request.headers.origin;
      if (token.allowedOrigins.length > 0) {
        if (!origin) {
          return reply.status(403).send({
            error: 'forbidden',
            message: 'Origin header required for this embed token',
          });
        }
        if (!token.allowedOrigins.includes(origin)) {
          return reply.status(403).send({
            error: 'forbidden',
            message: 'Origin not allowed for this embed token',
          });
        }
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
        const { submissionId, statusToken } =
          await embedSubmissionService.submitFromEmbed(
            token,
            parsed.data,
            request.ip,
            request.headers['user-agent'],
          );

        return {
          success: true,
          submissionId,
          message: 'Submission received successfully',
          statusToken,
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

  // ---------------------------------------------------------------------------
  // POST /embed/:token/prepare-upload — prepare for file upload
  // ---------------------------------------------------------------------------
  app.post<{ Params: { token: string } }>(
    '/embed/:token/prepare-upload',
    {
      bodyLimit: 16 * 1024, // 16KB
      preHandler: async function embedPrepareRateLimit(
        request: FastifyRequest,
        reply: FastifyReply,
      ) {
        const redisClient = getRedis();
        if (!redisClient) return;

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

          const embedLimit = 10;
          if (count > embedLimit) {
            const remainingMs = windowMs - (Date.now() % windowMs);
            const retryAfterSeconds = Math.ceil(remainingMs / 1000);
            reply.header('Retry-After', retryAfterSeconds);
            request.log.warn(
              { ip: request.ip, count, limit: embedLimit },
              'Embed prepare-upload rate limit exceeded',
            );
            return reply.status(429).send({
              error: 'rate_limit_exceeded',
              message: 'Too many requests. Please try again later.',
            });
          }
        } catch {
          request.log.warn(
            'Embed prepare-upload rate limit Redis error — allowing request',
          );
        }
      },
    },
    async (request, reply) => {
      const token = await verifyTokenParam(request, reply);
      if (!token) return;

      // Check origin on POST (CSRF protection)
      const origin = request.headers.origin;
      if (token.allowedOrigins.length > 0) {
        if (!origin) {
          return reply.status(403).send({
            error: 'forbidden',
            message: 'Origin header required for this embed token',
          });
        }
        if (!token.allowedOrigins.includes(origin)) {
          return reply.status(403).send({
            error: 'forbidden',
            message: 'Origin not allowed for this embed token',
          });
        }
      }

      // Validate body
      const parsed = embedPrepareUploadSchema.safeParse(request.body);
      if (!parsed.success) {
        const errors = parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        }));
        return reply.status(400).send({
          error: 'validation_error',
          message: 'Invalid request data',
          details: errors,
        });
      }

      try {
        const result = await embedSubmissionService.prepareUpload(
          token,
          parsed.data,
          request.ip,
          request.headers['user-agent'],
          env.TUS_ENDPOINT,
        );

        return result;
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

  // ---------------------------------------------------------------------------
  // GET /embed/:token/upload-status/:manuscriptVersionId — poll scan status
  // ---------------------------------------------------------------------------
  app.get<{
    Params: { token: string; manuscriptVersionId: string };
    Querystring: { email?: string };
  }>(
    '/embed/:token/upload-status/:manuscriptVersionId',
    {
      preHandler: async function embedStatusRateLimit(
        request: FastifyRequest,
        reply: FastifyReply,
      ) {
        const redisClient = getRedis();
        if (!redisClient) return;

        const windowMs = env.RATE_LIMIT_WINDOW_SECONDS * 1000;
        const windowId = Math.floor(Date.now() / windowMs);
        const key = `${env.RATE_LIMIT_KEY_PREFIX}:embed:poll:${request.ip}:${windowId}`;

        try {
          const result = (await redisClient.eval(
            RATE_LIMIT_LUA,
            1,
            key,
            windowMs,
          )) as [number, number];
          const count = result[0];

          // Higher limit for polling endpoint (60/window vs 10 for mutating endpoints)
          const pollLimit = 60;
          if (count > pollLimit) {
            const remainingMs = windowMs - (Date.now() % windowMs);
            const retryAfterSeconds = Math.ceil(remainingMs / 1000);
            reply.header('Retry-After', retryAfterSeconds);
            request.log.warn(
              { ip: request.ip, count, limit: pollLimit },
              'Embed upload-status rate limit exceeded',
            );
            return reply.status(429).send({
              error: 'rate_limit_exceeded',
              message: 'Too many requests. Please try again later.',
            });
          }
        } catch {
          request.log.warn(
            'Embed upload-status rate limit Redis error — allowing request',
          );
        }
      },
    },
    async (request, reply) => {
      const token = await verifyTokenParam(request, reply);
      if (!token) return;

      // Validate manuscriptVersionId param
      const { manuscriptVersionId } = request.params;
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(manuscriptVersionId)) {
        return reply.status(400).send({
          error: 'validation_error',
          message: 'Invalid manuscript version ID format',
        });
      }

      // Validate email query param
      const parsed = embedUploadStatusQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        const errors = parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        }));
        return reply.status(400).send({
          error: 'validation_error',
          message: 'Invalid query parameters',
          details: errors,
        });
      }

      try {
        const result = await embedSubmissionService.getUploadStatus(
          token,
          manuscriptVersionId,
          parsed.data.email,
        );

        return result;
      } catch (err) {
        if (
          err instanceof Error &&
          'statusCode' in err &&
          (err as Error & { statusCode: number }).statusCode === 404
        ) {
          return reply.status(404).send({
            error: 'not_found',
            message: 'User not found',
          });
        }
        throw err;
      }
    },
  );

  // ---------------------------------------------------------------------------
  // GET /embed/status/:statusToken — public submission status check
  // ---------------------------------------------------------------------------
  app.get<{ Params: { statusToken: string } }>(
    '/embed/status/:statusToken',
    {
      preHandler: async function embedStatusCheckRateLimit(
        request: FastifyRequest,
        reply: FastifyReply,
      ) {
        const redisClient = getRedis();
        if (!redisClient) return;

        const windowMs = env.RATE_LIMIT_WINDOW_SECONDS * 1000;
        const windowId = Math.floor(Date.now() / windowMs);
        const key = `${env.RATE_LIMIT_KEY_PREFIX}:embed:status:${request.ip}:${windowId}`;

        try {
          const result = (await redisClient.eval(
            RATE_LIMIT_LUA,
            1,
            key,
            windowMs,
          )) as [number, number];
          const count = result[0];

          const statusLimit = 30;
          if (count > statusLimit) {
            const remainingMs = windowMs - (Date.now() % windowMs);
            const retryAfterSeconds = Math.ceil(remainingMs / 1000);
            reply.header('Retry-After', retryAfterSeconds);
            request.log.warn(
              { ip: request.ip, count, limit: statusLimit },
              'Embed status check rate limit exceeded',
            );
            return reply.status(429).send({
              error: 'rate_limit_exceeded',
              message: 'Too many requests. Please try again later.',
            });
          }
        } catch {
          request.log.warn(
            'Embed status check rate limit Redis error — allowing request',
          );
        }
      },
    },
    async (request, reply) => {
      const { statusToken } = request.params;

      // Format check
      if (
        !statusToken.startsWith(STATUS_TOKEN_PREFIX) ||
        statusToken.length < 20
      ) {
        return reply.status(404).send({
          error: 'not_found',
          message: 'Submission not found',
        });
      }

      const result = await statusTokenService.verifyToken(statusToken);

      if (!result) {
        return reply.status(404).send({
          error: 'not_found',
          message: 'Submission not found',
        });
      }

      if (result.expired) {
        return reply.status(410).send({
          error: 'token_expired',
          message:
            'This status link has expired. Please contact the publication for an update.',
        });
      }

      return {
        title: result.title,
        status: result.status,
        submittedAt: result.submittedAt?.toISOString() ?? null,
        organizationName: result.organizationName,
        periodName: result.periodName,
      };
    },
  );

  // ---------------------------------------------------------------------------
  // Resubmit endpoints (R&R flow for embed submitters)
  // ---------------------------------------------------------------------------

  /**
   * Verify status token from URL param for resubmit endpoints.
   * Returns true if valid, sends error reply and returns false otherwise.
   */
  function verifyStatusTokenFormat(
    statusToken: string,
    reply: FastifyReply,
  ): boolean {
    if (
      !statusToken.startsWith(STATUS_TOKEN_PREFIX) ||
      statusToken.length < 20
    ) {
      void reply.status(404).send({
        error: 'not_found',
        message: 'Submission not found',
      });
      return false;
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // GET /embed/resubmit/:statusToken — resubmit context
  // ---------------------------------------------------------------------------
  app.get<{ Params: { statusToken: string } }>(
    '/embed/resubmit/:statusToken',
    {
      preHandler: async function resubmitContextRateLimit(
        request: FastifyRequest,
        reply: FastifyReply,
      ) {
        const redisClient = getRedis();
        if (!redisClient) return;

        const windowMs = env.RATE_LIMIT_WINDOW_SECONDS * 1000;
        const windowId = Math.floor(Date.now() / windowMs);
        const key = `${env.RATE_LIMIT_KEY_PREFIX}:embed:resubmit:${request.ip}:${windowId}`;

        try {
          const result = (await redisClient.eval(
            RATE_LIMIT_LUA,
            1,
            key,
            windowMs,
          )) as [number, number];

          const limit = 30;
          if (result[0] > limit) {
            const remainingMs = windowMs - (Date.now() % windowMs);
            reply.header('Retry-After', Math.ceil(remainingMs / 1000));
            return reply.status(429).send({
              error: 'rate_limit_exceeded',
              message: 'Too many requests. Please try again later.',
            });
          }
        } catch {
          request.log.warn(
            'Embed resubmit context rate limit Redis error — allowing request',
          );
        }
      },
    },
    async (request, reply) => {
      const { statusToken } = request.params;
      if (!verifyStatusTokenFormat(statusToken, reply)) return;

      const ctx = await embedSubmissionService.getResubmitContext(statusToken);

      if (!ctx) {
        return reply.status(404).send({
          error: 'not_found',
          message:
            'Submission not found, token expired, or not in revision-requested status',
        });
      }

      return ctx;
    },
  );

  // ---------------------------------------------------------------------------
  // POST /embed/resubmit/:statusToken/prepare-upload — prepare file upload
  // ---------------------------------------------------------------------------
  app.post<{ Params: { statusToken: string } }>(
    '/embed/resubmit/:statusToken/prepare-upload',
    {
      preHandler: async function resubmitPrepareRateLimit(
        request: FastifyRequest,
        reply: FastifyReply,
      ) {
        const redisClient = getRedis();
        if (!redisClient) return;

        const windowMs = env.RATE_LIMIT_WINDOW_SECONDS * 1000;
        const windowId = Math.floor(Date.now() / windowMs);
        const key = `${env.RATE_LIMIT_KEY_PREFIX}:embed:resubmit:${request.ip}:${windowId}`;

        try {
          const result = (await redisClient.eval(
            RATE_LIMIT_LUA,
            1,
            key,
            windowMs,
          )) as [number, number];

          const limit = 10;
          if (result[0] > limit) {
            const remainingMs = windowMs - (Date.now() % windowMs);
            reply.header('Retry-After', Math.ceil(remainingMs / 1000));
            return reply.status(429).send({
              error: 'rate_limit_exceeded',
              message: 'Too many requests. Please try again later.',
            });
          }
        } catch {
          request.log.warn(
            'Embed resubmit prepare-upload rate limit Redis error — allowing request',
          );
        }
      },
    },
    async (request, reply) => {
      const { statusToken } = request.params;
      if (!verifyStatusTokenFormat(statusToken, reply)) return;

      const result = await embedSubmissionService.prepareResubmitUpload(
        statusToken,
        request.ip,
        request.headers['user-agent'],
      );

      if (!result) {
        return reply.status(404).send({
          error: 'not_found',
          message:
            'Submission not found, token expired, or not in revision-requested status',
        });
      }

      return {
        manuscriptVersionId: result.manuscriptVersionId,
        guestUserId: result.guestUserId,
        tusEndpoint: result.tusEndpoint,
        maxFileSize: result.maxFileSize,
        maxFiles: result.maxFiles,
        allowedMimeTypes: result.allowedMimeTypes,
      };
    },
  );

  // ---------------------------------------------------------------------------
  // GET /embed/resubmit/:statusToken/upload-status/:manuscriptVersionId
  // ---------------------------------------------------------------------------
  app.get<{
    Params: { statusToken: string; manuscriptVersionId: string };
  }>(
    '/embed/resubmit/:statusToken/upload-status/:manuscriptVersionId',
    {
      preHandler: async function resubmitUploadStatusRateLimit(
        request: FastifyRequest,
        reply: FastifyReply,
      ) {
        const redisClient = getRedis();
        if (!redisClient) return;

        const windowMs = env.RATE_LIMIT_WINDOW_SECONDS * 1000;
        const windowId = Math.floor(Date.now() / windowMs);
        const key = `${env.RATE_LIMIT_KEY_PREFIX}:embed:resubmit:poll:${request.ip}:${windowId}`;

        try {
          const result = (await redisClient.eval(
            RATE_LIMIT_LUA,
            1,
            key,
            windowMs,
          )) as [number, number];

          const limit = 60;
          if (result[0] > limit) {
            const remainingMs = windowMs - (Date.now() % windowMs);
            reply.header('Retry-After', Math.ceil(remainingMs / 1000));
            return reply.status(429).send({
              error: 'rate_limit_exceeded',
              message: 'Too many requests. Please try again later.',
            });
          }
        } catch {
          request.log.warn(
            'Embed resubmit upload-status rate limit Redis error — allowing request',
          );
        }
      },
    },
    async (request, reply) => {
      const { statusToken, manuscriptVersionId } = request.params;
      if (!verifyStatusTokenFormat(statusToken, reply)) return;

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(manuscriptVersionId)) {
        return reply.status(400).send({
          error: 'validation_error',
          message: 'Invalid manuscript version ID format',
        });
      }

      const result = await embedSubmissionService.getResubmitUploadStatus(
        statusToken,
        manuscriptVersionId,
      );

      if (!result) {
        return reply.status(404).send({
          error: 'not_found',
          message:
            'Submission not found, token expired, or not in revision-requested status',
        });
      }

      return result;
    },
  );

  // ---------------------------------------------------------------------------
  // POST /embed/resubmit/:statusToken/submit — submit resubmission
  // ---------------------------------------------------------------------------
  app.post<{ Params: { statusToken: string } }>(
    '/embed/resubmit/:statusToken/submit',
    {
      bodyLimit: 16 * 1024,
      preHandler: async function resubmitSubmitRateLimit(
        request: FastifyRequest,
        reply: FastifyReply,
      ) {
        const redisClient = getRedis();
        if (!redisClient) return;

        const windowMs = env.RATE_LIMIT_WINDOW_SECONDS * 1000;
        const windowId = Math.floor(Date.now() / windowMs);
        const key = `${env.RATE_LIMIT_KEY_PREFIX}:embed:resubmit:${request.ip}:${windowId}`;

        try {
          const result = (await redisClient.eval(
            RATE_LIMIT_LUA,
            1,
            key,
            windowMs,
          )) as [number, number];

          const limit = 10;
          if (result[0] > limit) {
            const remainingMs = windowMs - (Date.now() % windowMs);
            reply.header('Retry-After', Math.ceil(remainingMs / 1000));
            return reply.status(429).send({
              error: 'rate_limit_exceeded',
              message: 'Too many submissions. Please try again later.',
            });
          }
        } catch {
          request.log.warn(
            'Embed resubmit submit rate limit Redis error — allowing request',
          );
        }
      },
    },
    async (request, reply) => {
      const { statusToken } = request.params;
      if (!verifyStatusTokenFormat(statusToken, reply)) return;

      const parsed = embedResubmitSubmitSchema.safeParse(request.body);
      if (!parsed.success) {
        const errors = parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        }));
        return reply.status(400).send({
          error: 'validation_error',
          message: 'Invalid request data',
          details: errors,
        });
      }

      try {
        const result = await embedSubmissionService.submitResubmission(
          statusToken,
          parsed.data.manuscriptVersionId,
          request.ip,
          request.headers['user-agent'],
        );

        if (!result) {
          return reply.status(404).send({
            error: 'not_found',
            message:
              'Submission not found, token expired, or not in revision-requested status',
          });
        }

        return result;
      } catch (err) {
        if (err instanceof NotReviseAndResubmitError) {
          return reply.status(409).send({
            error: 'conflict',
            message: err.message,
          });
        }
        if (
          err instanceof UnscannedFilesError ||
          err instanceof InfectedFilesError
        ) {
          return reply.status(422).send({
            error: 'unprocessable',
            message: err.message,
          });
        }
        throw err;
      }
    },
  );
}
