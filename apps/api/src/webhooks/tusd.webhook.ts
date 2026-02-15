import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { withRls, submissions, eq } from '@colophony/db';
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
import { fileService } from '../services/file.service.js';
import { auditService } from '../services/audit.service.js';

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

  app.post(
    '/webhooks/tusd',
    { bodyLimit: 1024 * 1024 }, // 1MB
    async function tusdWebhookHandler(
      request: FastifyRequest,
      reply: FastifyReply,
    ) {
      const hookName = request.headers['hook-name'] as string | undefined;

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

    // Extract auth token from forwarded headers
    const authHeader = getForwardedHeader(forwardedHeaders, 'Authorization');
    const orgId = getForwardedHeader(forwardedHeaders, 'X-Organization-Id');

    if (!authHeader || !orgId) {
      await reply.status(200).send(rejectUpload(401, 'missing_auth_or_org'));
      return;
    }

    const match = /^Bearer\s+(\S+)$/i.exec(authHeader);
    if (!match) {
      await reply.status(200).send(rejectUpload(401, 'invalid_auth_header'));
      return;
    }

    // Validate token
    let userId: string;
    if (verifyToken) {
      try {
        const { payload } = await verifyToken(match[1]);
        if (!payload.sub) {
          await reply.status(200).send(rejectUpload(401, 'missing_sub_claim'));
          return;
        }
        userId = payload.sub;
      } catch {
        await reply
          .status(200)
          .send(rejectUpload(401, 'token_validation_failed'));
        return;
      }
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

    // Extract upload metadata
    const submissionId = metadata['submission-id'] ?? metadata['submissionId'];
    const mimeType =
      metadata['filetype'] ?? metadata['type'] ?? 'application/octet-stream';
    const fileSize = Upload.Size ?? 0;

    if (!submissionId) {
      await reply.status(200).send(rejectUpload(400, 'missing_submission_id'));
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

    // Validate within RLS context
    try {
      await withRls({ orgId, userId }, async (tx: DrizzleDb) => {
        // Check submission exists and is DRAFT
        const [submission] = await tx
          .select({ id: submissions.id, status: submissions.status })
          .from(submissions)
          .where(eq(submissions.id, submissionId))
          .limit(1);

        if (!submission) {
          throw new Error('submission_not_found');
        }
        if (submission.status !== 'DRAFT') {
          throw new Error('submission_not_draft');
        }

        // Check file count and size limits
        await fileService.validateLimits(tx, submissionId, fileSize);
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'validation_failed';
      const statusCode =
        message === 'submission_not_found'
          ? 404
          : message === 'submission_not_draft'
            ? 409
            : 422;
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

    const orgId = getForwardedHeader(forwardedHeaders, 'X-Organization-Id');
    const authHeader = getForwardedHeader(forwardedHeaders, 'Authorization');

    if (!orgId) {
      request.log.error('Post-finish webhook missing X-Organization-Id');
      return reply.status(400).send({ error: 'missing_org_id' });
    }

    // Resolve userId from forwarded auth
    let userId: string | undefined;
    if (verifyToken && authHeader) {
      const match = /^Bearer\s+(\S+)$/i.exec(authHeader);
      if (match) {
        try {
          const { payload } = await verifyToken(match[1]);
          userId = payload.sub ?? undefined;
        } catch {
          request.log.warn('Post-finish: token validation failed');
        }
      }
    } else if (env.NODE_ENV === 'test') {
      userId = getForwardedHeader(forwardedHeaders, 'X-Test-User-Id');
    }

    const submissionId = metadata['submission-id'] ?? metadata['submissionId'];
    const filename = sanitizeFilename(
      metadata['filename'] ?? metadata['name'] ?? 'unnamed',
    );
    const mimeType =
      metadata['filetype'] ?? metadata['type'] ?? 'application/octet-stream';
    const storageKey = Upload.Storage?.Key ?? Upload.ID;
    const size = Upload.Size;

    if (!submissionId || !storageKey) {
      request.log.error(
        { submissionId, storageKey },
        'Post-finish missing required metadata',
      );
      return reply.status(400).send({ error: 'missing_metadata' });
    }

    try {
      await withRls({ orgId, userId }, async (tx: DrizzleDb) => {
        // Idempotency: check if already processed
        const existing = await fileService.getByStorageKey(tx, storageKey);
        if (existing) {
          request.log.info(
            { storageKey, fileId: existing.id },
            'Post-finish already processed (idempotent)',
          );
          return;
        }

        // Create file record
        const file = await fileService.create(tx, {
          submissionId,
          filename,
          mimeType,
          size,
          storageKey,
        });

        // Audit within the same transaction
        await auditService.log(tx, {
          resource: AuditResources.FILE,
          action: AuditActions.FILE_UPLOADED,
          resourceId: file.id,
          actorId: userId,
          organizationId: orgId,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          newValue: { filename, mimeType, size, submissionId },
        });

        request.log.info(
          { fileId: file.id, submissionId, storageKey },
          'File record created from tusd post-finish',
        );
      });

      return reply.status(200).send({ status: 'processed' });
    } catch (err) {
      request.log.error(err, 'Post-finish webhook processing failed');
      return reply.status(500).send({ error: 'processing_failed' });
    }
  }
}
