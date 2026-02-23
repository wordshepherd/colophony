import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Redis from 'ioredis';
import {
  withRls,
  manuscriptVersions,
  manuscripts,
  eq,
  db,
  users,
} from '@colophony/db';
import type { DrizzleDb } from '@colophony/db';
import { createJwksVerifier } from '@colophony/auth-client';
import {
  tusdPreCreateHookSchema,
  tusdPostFinishHookSchema,
  sanitizeFilename,
  AuditActions,
  AuditResources,
} from '@colophony/types';
import type { TusdPreCreateResponse } from '@colophony/types';
import type { Env } from '../config/env.js';
import { apiKeyService } from '../services/api-key.service.js';
import { embedTokenService } from '../services/embed-token.service.js';
import { fileService } from '../services/file.service.js';
import { auditService } from '../services/audit.service.js';
import { enqueueFileScan } from '../queues/file-scan.queue.js';
import { createS3Client, copyObject, deleteS3Object } from '../services/s3.js';

export interface TusdWebhookOptions {
  env: Env;
}

function rejectUpload(
  statusCode: number,
  message: string,
): TusdPreCreateResponse {
  return {
    RejectUpload: true,
    HTTPResponse: {
      StatusCode: statusCode,
      Body: JSON.stringify({ error: message }),
      Header: { 'Content-Type': 'application/json' },
    },
  };
}

function getForwardedHeader(
  headers: Record<string, string[]>,
  name: string,
): string | undefined {
  const values = headers[name] ?? headers[name.toLowerCase()];
  return values?.[0];
}

/**
 * Resolve a Zitadel subject ID to the local user UUID.
 * Uses the shared db instance (no RLS) — same pattern as the auth hook.
 */
async function resolveLocalUserId(zitadelSub: string): Promise<string | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.zitadelUserId, zitadelSub),
  });
  return user?.id ?? null;
}

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

export async function registerTusdWebhooks(
  app: FastifyInstance,
  opts: TusdWebhookOptions,
) {
  const { env } = opts;

  // Create JWKS verifier for validating forwarded user tokens
  const verifyToken = env.ZITADEL_AUTHORITY
    ? createJwksVerifier({
        authority: env.ZITADEL_AUTHORITY,
        clientId: env.ZITADEL_CLIENT_ID,
      })
    : null;

  // Lazy Redis connection for webhook rate limiting
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

  app.post(
    '/webhooks/tusd',
    {
      bodyLimit: 1024 * 1024, // 1MB
      /* eslint-disable @typescript-eslint/no-misused-promises */
      preHandler: async function webhookRateLimit(
        request: FastifyRequest,
        reply: FastifyReply,
      ) {
        const redisClient = getRedis();
        if (!redisClient) return; // Graceful degradation

        const windowMs = env.RATE_LIMIT_WINDOW_SECONDS * 1000;
        const windowId = Math.floor(Date.now() / windowMs);
        // Global key (no IP) — tusd is an internal sidecar, all calls share one IP
        const key = `${env.RATE_LIMIT_KEY_PREFIX}:wh-tusd:${windowId}`;

        try {
          const result = (await redisClient.eval(
            RATE_LIMIT_LUA,
            1,
            key,
            windowMs,
          )) as [number, number];
          const count = result[0];

          if (count > env.WEBHOOK_RATE_LIMIT_MAX) {
            // Compute remaining time until window boundary (not key TTL)
            const remainingMs = windowMs - (Date.now() % windowMs);
            const retryAfterSeconds = Math.ceil(remainingMs / 1000);
            reply.header('Retry-After', retryAfterSeconds);
            request.log.warn(
              { ip: request.ip, count, limit: env.WEBHOOK_RATE_LIMIT_MAX },
              'Tusd webhook rate limit exceeded',
            );
            return reply.status(429).send({
              error: 'rate_limit_exceeded',
              message: 'Too many webhook requests',
            });
          }
        } catch {
          // Graceful degradation: Redis unavailable → allow request
          request.log.warn(
            'Tusd webhook rate limit Redis error — allowing request',
          );
        }
      },
      /* eslint-enable @typescript-eslint/no-misused-promises */
    },
    async function tusdWebhookHandler(
      request: FastifyRequest,
      reply: FastifyReply,
    ) {
      // tusd v2 sends { Type: "pre-create"|"post-finish"|..., Event: { Upload, HTTPRequest } }
      // tusd v1 sent the hook name as a Hook-Name header and Upload/HTTPRequest at top level.
      // Support both formats for compatibility.
      const body = request.body as Record<string, unknown>;
      let hookName: string | undefined;

      if (body && typeof body.Type === 'string' && body.Event) {
        // tusd v2 format: unwrap Event into request body for handler functions
        hookName = body.Type;
        (request as unknown as { body: unknown }).body = body.Event;
      } else {
        // tusd v1 format: hook name in header, Upload/HTTPRequest at top level
        hookName = request.headers['hook-name'] as string | undefined;
      }

      if (hookName === 'pre-create') {
        return handlePreCreate(request, reply);
      } else if (hookName === 'post-finish') {
        return handlePostFinish(request, reply);
      } else {
        request.log.info({ hookName }, 'Unhandled tusd hook');
        return reply.status(200).send({});
      }
    },
  );

  async function handlePreCreate(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = tusdPreCreateHookSchema.safeParse(request.body);
    if (!parsed.success) {
      request.log.warn(
        { errors: parsed.error.flatten() },
        'Invalid tusd pre-create payload',
      );
      await reply.status(200).send(rejectUpload(400, 'invalid_payload'));
      return;
    }

    const { Upload, HTTPRequest } = parsed.data;
    const metadata = Upload.MetaData ?? {};
    const forwardedHeaders = HTTPRequest.Header;

    // Extract auth from forwarded headers
    const authHeader = getForwardedHeader(forwardedHeaders, 'Authorization');
    const apiKeyHeader = getForwardedHeader(forwardedHeaders, 'X-Api-Key');
    const embedTokenHeader = getForwardedHeader(
      forwardedHeaders,
      'X-Embed-Token',
    );

    // Extract guest-user-id from metadata (used by embed token auth)
    const guestUserId = metadata['guest-user-id'];

    // Validate token and resolve local user UUID
    // Note: orgId is NOT required for manuscript uploads (user-scoped)
    let userId: string;

    const bearerMatch = authHeader
      ? /^Bearer\s+(\S+)$/i.exec(authHeader)
      : null;

    if (verifyToken && bearerMatch) {
      // OIDC token auth (interactive users)
      try {
        const { payload } = await verifyToken(bearerMatch[1]);
        if (!payload.sub) {
          await reply.status(200).send(rejectUpload(401, 'missing_sub_claim'));
          return;
        }
        // Resolve Zitadel sub → local user UUID (same as auth hook)
        const localUserId = await resolveLocalUserId(payload.sub);
        if (!localUserId) {
          await reply
            .status(200)
            .send(rejectUpload(403, 'user_not_provisioned'));
          return;
        }
        userId = localUserId;
      } catch {
        await reply
          .status(200)
          .send(rejectUpload(401, 'token_validation_failed'));
        return;
      }
    } else if (apiKeyHeader) {
      // API key auth (programmatic consumers)
      const result = await apiKeyService.verifyKey(apiKeyHeader);
      if (!result) {
        await reply.status(200).send(rejectUpload(401, 'invalid_key'));
        return;
      }
      const { apiKey, creator } = result;
      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        await reply.status(200).send(rejectUpload(401, 'key_expired'));
        return;
      }
      if (apiKey.revokedAt) {
        await reply.status(200).send(rejectUpload(401, 'key_revoked'));
        return;
      }
      if (creator.deletedAt) {
        await reply.status(200).send(rejectUpload(401, 'creator_deactivated'));
        return;
      }
      // Scope check: require files:write for upload
      if (!apiKey.scopes || !apiKey.scopes.includes('files:write')) {
        await reply.status(200).send(rejectUpload(403, 'insufficient_scopes'));
        return;
      }
      userId = creator.id;
      // Fire-and-forget: update lastUsedAt (mirrors auth.ts)
      void apiKeyService.touchLastUsed(apiKey.id);
    } else if (embedTokenHeader) {
      // Embed token auth (guest form submitters)
      const tokenResult = await embedTokenService.verifyToken(embedTokenHeader);
      if (!tokenResult) {
        await reply.status(200).send(rejectUpload(401, 'invalid_embed_token'));
        return;
      }
      if (!tokenResult.active) {
        await reply.status(200).send(rejectUpload(401, 'embed_token_revoked'));
        return;
      }
      if (tokenResult.expiresAt && tokenResult.expiresAt < new Date()) {
        await reply.status(200).send(rejectUpload(401, 'embed_token_expired'));
        return;
      }
      if (!guestUserId) {
        await reply
          .status(200)
          .send(rejectUpload(400, 'missing_guest_user_id'));
        return;
      }
      userId = guestUserId;
    } else if (env.NODE_ENV === 'test') {
      // Test mode: extract from forwarded test headers
      const testUserId = getForwardedHeader(forwardedHeaders, 'X-Test-User-Id');
      if (!testUserId) {
        await reply.status(200).send(rejectUpload(401, 'no_auth_configured'));
        return;
      }
      userId = testUserId;
    } else {
      await reply.status(200).send(rejectUpload(401, 'no_auth_configured'));
      return;
    }

    // Extract upload metadata — manuscript-version-id replaces submission-id
    const manuscriptVersionId =
      metadata['manuscript-version-id'] ?? metadata['manuscriptVersionId'];
    const mimeType =
      metadata['filetype'] ?? metadata['type'] ?? 'application/octet-stream';
    const fileSize = Upload.Size ?? 0;

    if (!manuscriptVersionId) {
      await reply
        .status(200)
        .send(rejectUpload(400, 'missing_manuscript_version_id'));
      return;
    }

    // Validate MIME type
    try {
      fileService.validateMimeType(mimeType);
    } catch {
      await reply.status(200).send(rejectUpload(415, 'invalid_mime_type'));
      return;
    }

    // Validate file size
    try {
      fileService.validateFileSize(fileSize);
    } catch {
      await reply.status(200).send(rejectUpload(413, 'file_too_large'));
      return;
    }

    // Validate within user-scoped RLS context (no org needed)
    try {
      await withRls({ userId }, async (tx: DrizzleDb) => {
        // Check manuscript version exists and is owned by this user
        const [version] = await tx
          .select({
            id: manuscriptVersions.id,
            manuscriptId: manuscriptVersions.manuscriptId,
          })
          .from(manuscriptVersions)
          .innerJoin(
            manuscripts,
            eq(manuscriptVersions.manuscriptId, manuscripts.id),
          )
          .where(eq(manuscriptVersions.id, manuscriptVersionId))
          .limit(1);

        if (!version) {
          throw new Error('manuscript_version_not_found');
        }
        // RLS already ensures ownership, but the join through manuscripts
        // table with owner_id = current_user_id() policy handles this.

        // Check file count and size limits
        await fileService.validateLimits(tx, manuscriptVersionId, fileSize);
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'validation_failed';
      const statusCode = message === 'manuscript_version_not_found' ? 404 : 422;
      await reply.status(200).send(rejectUpload(statusCode, message));
      return;
    }

    // Allow the upload
    await reply.status(200).send({});
  }

  async function handlePostFinish(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = tusdPostFinishHookSchema.safeParse(request.body);
    if (!parsed.success) {
      request.log.warn(
        { errors: parsed.error.flatten() },
        'Invalid tusd post-finish payload',
      );
      return reply.status(400).send({ error: 'invalid_payload' });
    }

    const { Upload, HTTPRequest } = parsed.data;
    const metadata = Upload.MetaData ?? {};
    const forwardedHeaders = HTTPRequest.Header;

    const authHeader = getForwardedHeader(forwardedHeaders, 'Authorization');
    const apiKeyHeader = getForwardedHeader(forwardedHeaders, 'X-Api-Key');
    const embedTokenHeader = getForwardedHeader(
      forwardedHeaders,
      'X-Embed-Token',
    );
    // orgId is optional — manuscript uploads are user-scoped, not org-scoped
    const orgId = getForwardedHeader(forwardedHeaders, 'X-Organization-Id');

    // Extract guest-user-id from metadata (used by embed token auth)
    const postFinishGuestUserId = metadata['guest-user-id'];

    // Resolve userId from forwarded auth — fail closed if auth is invalid
    let userId: string;

    const bearerMatch = authHeader
      ? /^Bearer\s+(\S+)$/i.exec(authHeader)
      : null;

    if (verifyToken && bearerMatch) {
      // OIDC token auth
      try {
        const { payload } = await verifyToken(bearerMatch[1]);
        if (!payload.sub) {
          return reply.status(401).send({ error: 'missing_sub_claim' });
        }
        const localUserId = await resolveLocalUserId(payload.sub);
        if (!localUserId) {
          return reply.status(403).send({ error: 'user_not_provisioned' });
        }
        userId = localUserId;
      } catch {
        request.log.warn('Post-finish: token validation failed');
        return reply.status(401).send({ error: 'token_validation_failed' });
      }
    } else if (apiKeyHeader) {
      // API key auth (programmatic consumers)
      const result = await apiKeyService.verifyKey(apiKeyHeader);
      if (!result) {
        return reply.status(401).send({ error: 'invalid_key' });
      }
      const { apiKey, creator } = result;
      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        return reply.status(401).send({ error: 'key_expired' });
      }
      if (apiKey.revokedAt) {
        return reply.status(401).send({ error: 'key_revoked' });
      }
      if (creator.deletedAt) {
        return reply.status(401).send({ error: 'creator_deactivated' });
      }
      // Scope check: require files:write for post-finish
      if (!apiKey.scopes || !apiKey.scopes.includes('files:write')) {
        return reply.status(403).send({ error: 'insufficient_scopes' });
      }
      userId = creator.id;
      // Fire-and-forget: update lastUsedAt (mirrors auth.ts)
      void apiKeyService.touchLastUsed(apiKey.id);
    } else if (embedTokenHeader) {
      // Embed token auth (guest form submitters)
      const tokenResult = await embedTokenService.verifyToken(embedTokenHeader);
      if (!tokenResult) {
        return reply.status(401).send({ error: 'invalid_embed_token' });
      }
      if (!tokenResult.active) {
        return reply.status(401).send({ error: 'embed_token_revoked' });
      }
      if (tokenResult.expiresAt && tokenResult.expiresAt < new Date()) {
        return reply.status(401).send({ error: 'embed_token_expired' });
      }
      if (!postFinishGuestUserId) {
        return reply.status(400).send({ error: 'missing_guest_user_id' });
      }
      userId = postFinishGuestUserId;
    } else if (env.NODE_ENV === 'test') {
      const testUserId = getForwardedHeader(forwardedHeaders, 'X-Test-User-Id');
      if (!testUserId) {
        return reply.status(401).send({ error: 'no_auth_configured' });
      }
      userId = testUserId;
    } else {
      request.log.warn('Post-finish: no auth available');
      return reply.status(401).send({ error: 'no_auth_configured' });
    }

    const manuscriptVersionId =
      metadata['manuscript-version-id'] ?? metadata['manuscriptVersionId'];
    const filename = sanitizeFilename(
      metadata['filename'] ?? metadata['name'] ?? 'unnamed',
    );
    const mimeType =
      metadata['filetype'] ?? metadata['type'] ?? 'application/octet-stream';
    const storageKey = Upload.Storage?.Key ?? Upload.ID;
    const size = Upload.Size;

    if (!manuscriptVersionId || !storageKey) {
      request.log.error(
        { manuscriptVersionId, storageKey },
        'Post-finish missing required metadata',
      );
      return reply.status(400).send({ error: 'missing_metadata' });
    }

    try {
      // Track file info for post-commit actions
      let fileIdToScan: string | null = null;
      let needsScanEnqueue = false;

      // User-scoped RLS — no org needed for manuscript file operations
      await withRls({ userId }, async (tx: DrizzleDb) => {
        // Idempotency: check if already processed
        const existing = await fileService.getByStorageKey(tx, storageKey);
        if (existing) {
          // If file exists but is still PENDING (prior enqueue failed),
          // re-enqueue the scan job after commit
          if (existing.scanStatus === 'PENDING' && env.VIRUS_SCAN_ENABLED) {
            fileIdToScan = existing.id;
            needsScanEnqueue = true;
          }
          request.log.info(
            { storageKey, fileId: existing.id },
            'Post-finish already processed (idempotent)',
          );
          return;
        }

        // Create file record linked to manuscript version
        const file = await fileService.create(tx, {
          manuscriptVersionId,
          filename,
          mimeType,
          size,
          storageKey,
        });

        // If scanning disabled, mark CLEAN immediately inside the tx
        if (!env.VIRUS_SCAN_ENABLED) {
          await fileService.updateScanStatus(tx, file.id, 'CLEAN');
        }

        // Audit within the same transaction.
        // Do NOT pass organizationId here — the RLS context is user-scoped
        // (withRls({ userId })), so app.current_org is unset. The audit_events
        // INSERT policy requires organization_id = current_org_id() when non-NULL,
        // which would fail. The actorId is sufficient for traceability.
        await auditService.log(tx, {
          resource: AuditResources.FILE,
          action: AuditActions.FILE_UPLOADED,
          resourceId: file.id,
          actorId: userId,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          newValue: { filename, mimeType, size, manuscriptVersionId },
        });

        fileIdToScan = file.id;
        if (env.VIRUS_SCAN_ENABLED) {
          needsScanEnqueue = true;
        }

        request.log.info(
          { fileId: file.id, manuscriptVersionId, storageKey },
          'File record created from tusd post-finish',
        );
      });

      // Post-commit actions (outside tx to avoid ghost jobs/ops on rollback)
      if (needsScanEnqueue && fileIdToScan) {
        await enqueueFileScan(env, {
          fileId: fileIdToScan,
          storageKey,
          userId,
          ...(orgId ? { organizationId: orgId } : {}),
        });
      }

      // When scanning disabled, move file to clean bucket so
      // download/delete paths find it in the expected location
      if (!env.VIRUS_SCAN_ENABLED && fileIdToScan && !needsScanEnqueue) {
        try {
          const s3Client = createS3Client(env);
          await copyObject(
            s3Client,
            env.S3_QUARANTINE_BUCKET,
            storageKey,
            env.S3_BUCKET,
            storageKey,
          );
          await deleteS3Object(s3Client, env.S3_QUARANTINE_BUCKET, storageKey);
        } catch (s3Err) {
          // Log but don't fail — file is still accessible from quarantine
          // and can be moved by a reconciliation job
          request.log.error(
            s3Err,
            'Failed to move file from quarantine (scan disabled)',
          );
        }
      }

      return reply.status(200).send({ status: 'processed' });
    } catch (err) {
      request.log.error(err, 'Post-finish webhook processing failed');
      return reply.status(500).send({ error: 'processing_failed' });
    }
  }
}
