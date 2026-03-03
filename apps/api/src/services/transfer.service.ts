import { Readable } from 'node:stream';
import crypto from 'node:crypto';
import * as jose from 'jose';
import {
  db,
  withRls,
  submissions,
  manuscriptVersions,
  files,
  pieceTransfers,
  inboundTransfers,
  trustedPeers,
  users,
  eq,
  and,
  sql,
} from '@colophony/db';
import { count, getTableColumns } from 'drizzle-orm';
import {
  AuditActions,
  AuditResources,
  type TransferInitiateRequest,
  type TransferInitiateResponse,
  type TransferFileManifestEntry,
  type PieceTransfer,
} from '@colophony/types';
import type { Env } from '../config/env.js';
import { auditService } from './audit.service.js';
import { federationService, domainToDid } from './federation.service.js';
import { signFederationRequest } from '../federation/http-signatures.js';
import { validateOutboundUrl } from '../lib/url-validation.js';
import { getGlobalRegistry } from '../adapters/registry-accessor.js';
import type { S3StorageAdapter } from '../adapters/storage/index.js';
import { enqueueTransferFetch } from '../queues/transfer-fetch.queue.js';
import { getLogger } from '../config/logger.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class TransferNotFoundError extends Error {
  override name = 'TransferNotFoundError' as const;
  constructor(id: string) {
    super(`Transfer not found: ${id}`);
  }
}

export class TransferInvalidStateError extends Error {
  override name = 'TransferInvalidStateError' as const;
  constructor(message: string) {
    super(message);
  }
}

export class TransferCapabilityError extends Error {
  override name = 'TransferCapabilityError' as const;
  constructor(domain: string) {
    super(`Peer ${domain} does not have the required transfer capability`);
  }
}

export class TransferTokenError extends Error {
  override name = 'TransferTokenError' as const;
  constructor(message: string) {
    super(message);
  }
}

export class TransferFileNotFoundError extends Error {
  override name = 'TransferFileNotFoundError' as const;
  constructor(fileId: string) {
    super(`Transfer file not found: ${fileId}`);
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const transferService = {
  // ─── Origin-side ───

  /**
   * Initiate a piece transfer from a rejected submission to a remote instance.
   *
   * 1. Verify submission is REJECTED and user is the submitter
   * 2. Look up trusted peer with transfer.receive capability
   * 3. Generate signed JWT transfer token
   * 4. POST to remote instance's transfer endpoint
   * 5. Record the transfer locally
   */
  async initiateTransfer(
    env: Env,
    params: {
      orgId: string;
      userId: string;
      submissionId: string;
      targetDomain: string;
    },
  ): Promise<{
    transferId: string;
    remoteTransferId: string;
    status: string;
  }> {
    const { orgId, userId, submissionId, targetDomain } = params;

    // Step 1: Verify submission exists, is REJECTED, and user is submitter
    const submission = await withRls({ userId }, async (tx) => {
      const [row] = await tx
        .select({
          id: submissions.id,
          status: submissions.status,
          submitterId: submissions.submitterId,
          manuscriptVersionId: submissions.manuscriptVersionId,
          title: submissions.title,
          coverLetter: submissions.coverLetter,
          organizationId: submissions.organizationId,
        })
        .from(submissions)
        .where(eq(submissions.id, submissionId))
        .limit(1);
      return row;
    });

    if (!submission) {
      throw new TransferNotFoundError(submissionId);
    }

    if (submission.status !== 'REJECTED') {
      throw new TransferInvalidStateError(
        `Submission must be REJECTED to transfer (current: ${submission.status})`,
      );
    }

    if (submission.submitterId !== userId) {
      throw new TransferInvalidStateError(
        'Only the submitter can initiate a transfer',
      );
    }

    if (!submission.manuscriptVersionId) {
      throw new TransferInvalidStateError(
        'Submission has no manuscript version to transfer',
      );
    }

    // Step 2: Read submission details, files, fingerprint, and peer info (org-scoped)
    const { fileManifest, fingerprint, peer, submitterDid } = await withRls(
      { orgId },
      async (tx) => {
        // Get CLEAN files for the manuscript version
        const fileRows = await tx
          .select({
            id: files.id,
            filename: files.filename,
            mimeType: files.mimeType,
            size: files.size,
          })
          .from(files)
          .where(
            and(
              eq(files.manuscriptVersionId, submission.manuscriptVersionId!),
              eq(files.scanStatus, 'CLEAN'),
            ),
          );

        if (fileRows.length === 0) {
          throw new TransferInvalidStateError(
            'No clean files available for transfer',
          );
        }

        const manifest: TransferFileManifestEntry[] = fileRows.map((f) => ({
          fileId: f.id,
          filename: f.filename,
          mimeType: f.mimeType,
          size: Number(f.size),
        }));

        // Get content fingerprint from manuscript version
        const [version] = await tx
          .select({ contentFingerprint: manuscriptVersions.contentFingerprint })
          .from(manuscriptVersions)
          .where(eq(manuscriptVersions.id, submission.manuscriptVersionId!))
          .limit(1);

        // Look up trusted peer with transfer.receive capability
        const [peerRow] = await tx
          .select({
            domain: trustedPeers.domain,
            instanceUrl: trustedPeers.instanceUrl,
            publicKey: trustedPeers.publicKey,
          })
          .from(trustedPeers)
          .where(
            and(
              eq(trustedPeers.domain, targetDomain),
              eq(trustedPeers.status, 'active'),
              sql`granted_capabilities @> '{"transfer.receive": true}'::jsonb`,
            ),
          )
          .limit(1);

        if (!peerRow) {
          throw new TransferCapabilityError(targetDomain);
        }

        // Build submitter DID
        const rawDomain = env.FEDERATION_DOMAIN ?? 'localhost';
        const encodedDomain = domainToDid(rawDomain);
        const [user] = await tx
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        // Users table is non-RLS; fall back gracefully
        const emailLocal = user?.email?.split('@')[0] ?? userId;
        const did = `did:web:${encodedDomain}:users:${emailLocal}`;

        return {
          fileManifest: manifest,
          fingerprint: version?.contentFingerprint ?? null,
          peer: peerRow,
          submitterDid: did,
        };
      },
    );

    // Step 3: Generate signed JWT transfer token
    const config = await federationService.getOrInitConfig(env);
    const domain = env.FEDERATION_DOMAIN ?? 'localhost';
    const transferId = crypto.randomUUID();
    const tokenExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h

    const privateKeyObj = crypto.createPrivateKey(config.privateKey);
    const jwt = await new jose.SignJWT({
      submissionId,
      manuscriptVersionId: submission.manuscriptVersionId,
      fileIds: fileManifest.map((f) => f.fileId),
    })
      .setProtectedHeader({ alg: 'EdDSA' })
      .setIssuer(domain)
      .setSubject(submitterDid)
      .setAudience(targetDomain)
      .setExpirationTime(tokenExpiresAt)
      .setJti(transferId)
      .sign(privateKeyObj);

    // Step 4: POST to remote instance
    const url = `${peer.instanceUrl}/federation/v1/transfers/initiate`;
    const devMode =
      process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    await validateOutboundUrl(url, { devMode });

    const body = JSON.stringify({
      transferToken: jwt,
      submitterDid,
      pieceMetadata: {
        title: submission.title ?? undefined,
        coverLetter: submission.coverLetter ?? undefined,
        contentFingerprint: fingerprint ?? undefined,
      },
      fileManifest,
      protocolVersion: '1.0',
    } satisfies TransferInitiateRequest);

    const { headers: signedHeaders } = signFederationRequest({
      method: 'POST',
      url,
      headers: { 'content-type': 'application/json' },
      body,
      privateKey: config.privateKey,
      keyId: `${domain}#main`,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...signedHeaders,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown');
      throw new TransferInvalidStateError(
        `Remote instance rejected transfer: ${response.status} ${errorBody}`,
      );
    }

    const remoteResult = (await response.json()) as {
      transferId: string;
      status: string;
    };

    // Step 5: Record the transfer locally
    await withRls({ orgId }, async (tx) => {
      await tx.insert(pieceTransfers).values({
        id: transferId,
        submissionId,
        manuscriptVersionId: submission.manuscriptVersionId!,
        initiatedByUserId: userId,
        targetDomain,
        status: 'PENDING',
        transferToken: jwt,
        tokenExpiresAt,
        fileManifest,
        contentFingerprint: fingerprint,
        submitterDid,
        remoteTransferId: remoteResult.transferId,
        remoteResponse: remoteResult,
      });

      await auditService.log(tx, {
        resource: AuditResources.TRANSFER,
        action: AuditActions.TRANSFER_INITIATED,
        resourceId: transferId,
        organizationId: orgId,
        actorId: userId,
        newValue: {
          submissionId,
          targetDomain,
          remoteTransferId: remoteResult.transferId,
        },
      });
    });

    return {
      transferId,
      remoteTransferId: remoteResult.transferId,
      status: remoteResult.status,
    };
  },

  /** List transfers for a submission. */
  async getTransfersBySubmission(
    orgId: string,
    submissionId: string,
    params?: { limit?: number },
  ): Promise<PieceTransfer[]> {
    const queryLimit = params?.limit ?? 100;
    return withRls({ orgId }, async (tx) => {
      return tx
        .select(getTableColumns(pieceTransfers))
        .from(pieceTransfers)
        .innerJoin(submissions, eq(pieceTransfers.submissionId, submissions.id))
        .where(
          and(
            eq(pieceTransfers.submissionId, submissionId),
            eq(submissions.organizationId, orgId),
          ),
        )
        .orderBy(sql`${pieceTransfers.createdAt} DESC`)
        .limit(queryLimit);
    });
  },

  /** Get a single transfer by ID. */
  async getTransferById(
    orgId: string,
    transferId: string,
  ): Promise<PieceTransfer> {
    const [row] = await withRls({ orgId }, async (tx) => {
      return tx
        .select(getTableColumns(pieceTransfers))
        .from(pieceTransfers)
        .innerJoin(submissions, eq(pieceTransfers.submissionId, submissions.id))
        .where(
          and(
            eq(pieceTransfers.id, transferId),
            eq(submissions.organizationId, orgId),
          ),
        )
        .limit(1);
    });

    if (!row) {
      throw new TransferNotFoundError(transferId);
    }

    return row;
  },

  /** Cancel a pending transfer. */
  async cancelTransfer(
    orgId: string,
    userId: string,
    transferId: string,
  ): Promise<void> {
    await withRls({ orgId }, async (tx) => {
      const [existing] = await tx
        .select({ status: pieceTransfers.status })
        .from(pieceTransfers)
        .innerJoin(submissions, eq(pieceTransfers.submissionId, submissions.id))
        .where(
          and(
            eq(pieceTransfers.id, transferId),
            eq(submissions.organizationId, orgId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new TransferNotFoundError(transferId);
      }

      if (
        existing.status !== 'PENDING' &&
        existing.status !== 'FILES_REQUESTED'
      ) {
        throw new TransferInvalidStateError(
          `Cannot cancel transfer in ${existing.status} state`,
        );
      }

      await tx
        .update(pieceTransfers)
        .set({ status: 'CANCELLED', updatedAt: new Date() })
        .where(eq(pieceTransfers.id, transferId));

      await auditService.log(tx, {
        resource: AuditResources.TRANSFER,
        action: AuditActions.TRANSFER_CANCELLED,
        resourceId: transferId,
        organizationId: orgId,
        actorId: userId,
      });
    });
  },

  /** List all transfers for an org with pagination. */
  async listTransfersForOrg(
    orgId: string,
    params: { page?: number; limit?: number },
  ): Promise<{ transfers: PieceTransfer[]; total: number }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const offset = (page - 1) * limit;

    return withRls({ orgId }, async (tx) => {
      const [totalRow] = await tx
        .select({ count: count() })
        .from(pieceTransfers)
        .innerJoin(submissions, eq(pieceTransfers.submissionId, submissions.id))
        .where(eq(submissions.organizationId, orgId));

      const rows = await tx
        .select(getTableColumns(pieceTransfers))
        .from(pieceTransfers)
        .innerJoin(submissions, eq(pieceTransfers.submissionId, submissions.id))
        .where(eq(submissions.organizationId, orgId))
        .orderBy(sql`${pieceTransfers.createdAt} DESC`)
        .limit(limit)
        .offset(offset);

      return { transfers: rows, total: totalRow?.count ?? 0 };
    });
  },

  // ─── Destination-side ───

  /**
   * Handle an inbound transfer from a trusted peer.
   *
   * 1. Find org that trusts peerDomain with transfer.initiate capability
   * 2. Verify JWT signature
   * 3. Create DRAFT submission with provenance columns (idempotent)
   * 4. Fire-and-forget file fetch (v1: acceptable, BullMQ upgrade later)
   */
  async handleInboundTransfer(
    env: Env,
    peerDomain: string,
    body: TransferInitiateRequest,
  ): Promise<TransferInitiateResponse> {
    // Step 1: Find org that trusts this peer with transfer.initiate capability
    // Superuser query — justified: pre-auth cross-org lookup, no org context
    // available until this query resolves. Same pattern as federation-auth.ts:119-132.
    const peerRows = await db
      .select({
        organizationId: trustedPeers.organizationId,
        publicKey: trustedPeers.publicKey,
      })
      .from(trustedPeers)
      .where(
        and(
          eq(trustedPeers.domain, peerDomain),
          eq(trustedPeers.status, 'active'),
          sql`granted_capabilities @> '{"transfer.initiate": true}'::jsonb`,
        ),
      )
      .limit(2);

    if (peerRows.length === 0) {
      throw new TransferCapabilityError(peerDomain);
    }

    if (peerRows.length > 1) {
      throw new TransferCapabilityError(
        `Ambiguous peer: multiple orgs trust ${peerDomain} with transfer.initiate`,
      );
    }

    const peerRow = peerRows[0];
    const orgId = peerRow.organizationId;

    // Step 2: Verify JWT signature
    let claims: jose.JWTPayload;
    try {
      const publicKeyObj = crypto.createPublicKey(peerRow.publicKey);
      const localDomain = env.FEDERATION_DOMAIN ?? 'localhost';
      const { payload } = await jose.jwtVerify(
        body.transferToken,
        publicKeyObj,
        {
          issuer: peerDomain,
          audience: localDomain,
        },
      );
      claims = payload;
    } catch (err) {
      throw new TransferTokenError(
        `Invalid transfer token: ${err instanceof Error ? err.message : 'verification failed'}`,
      );
    }

    const jti = claims.jti;
    if (!jti) {
      throw new TransferTokenError('Transfer token missing jti claim');
    }

    // Step 3: Create DRAFT submission with provenance columns (idempotent)
    const result = await withRls({ orgId }, async (tx) => {
      // Idempotency check: look for existing submission from this transfer
      const [existing] = await tx
        .select({ id: submissions.id })
        .from(submissions)
        .where(
          and(
            eq(submissions.transferredFromDomain, peerDomain),
            eq(submissions.transferredFromTransferId, jti),
          ),
        )
        .limit(1);

      if (existing) {
        // Idempotent replay — return existing submission
        return { transferId: existing.id, isNew: false };
      }

      // Create DRAFT submission with provenance
      const [newSubmission] = await tx
        .insert(submissions)
        .values({
          organizationId: orgId,
          title: body.pieceMetadata.title ?? 'Transferred piece',
          coverLetter: body.pieceMetadata.coverLetter,
          status: 'DRAFT',
          transferredFromDomain: peerDomain,
          transferredFromTransferId: jti,
        })
        .returning({ id: submissions.id });

      // Track inbound transfer
      const [inboundRow] = await tx
        .insert(inboundTransfers)
        .values({
          organizationId: orgId,
          submissionId: newSubmission.id,
          sourceDomain: peerDomain,
          remoteTransferId: jti,
          submitterDid: body.submitterDid,
          contentFingerprint:
            body.pieceMetadata.contentFingerprint ?? undefined,
          fileManifest: body.fileManifest,
          status: 'RECEIVED',
        })
        .returning({ id: inboundTransfers.id });

      await auditService.log(tx, {
        resource: AuditResources.TRANSFER,
        action: AuditActions.TRANSFER_INBOUND_RECEIVED,
        resourceId: newSubmission.id,
        organizationId: orgId,
        newValue: {
          peerDomain,
          submitterDid: body.submitterDid,
          fileCount: body.fileManifest.length,
          inboundTransferId: inboundRow.id,
        },
      });

      return {
        transferId: newSubmission.id,
        isNew: true,
        inboundTransferId: inboundRow.id,
      };
    });

    // Step 4: Enqueue file fetch via BullMQ (retries, exponential backoff)
    if (result.isNew) {
      const originDomain = claims.iss;
      if (originDomain && body.fileManifest.length > 0) {
        try {
          await enqueueTransferFetch(env, {
            transferId: jti,
            orgId,
            originDomain,
            transferToken: body.transferToken,
            tokenExpiresAt: claims.exp
              ? new Date(claims.exp * 1000).toISOString()
              : new Date(Date.now() + 86_400_000).toISOString(),
            fileManifest: body.fileManifest,
            localSubmissionId: result.transferId,
            inboundTransferId: result.inboundTransferId,
          });
        } catch {
          // Redis down — fall back to fire-and-forget (degraded but functional)
          void this.fetchTransferFiles(
            env,
            originDomain,
            jti,
            body.transferToken,
            body.fileManifest,
            result.transferId,
            orgId,
          ).catch((err) => {
            getLogger().error(
              { err },
              '[transfer] Background file fetch failed',
            );
          });
        }
      }
    }

    return { transferId: result.transferId, status: 'accepted' };
  },

  /**
   * Background file fetch from origin instance.
   * Downloads each file using the transfer token as bearer auth.
   */
  async fetchTransferFiles(
    _env: Env,
    originDomain: string,
    transferId: string,
    transferToken: string,
    fileManifest: TransferFileManifestEntry[],
    localSubmissionId: string,
    orgId: string,
  ): Promise<void> {
    // Resolve origin's instance URL from trusted peer
    const [peer] = await db
      .select({ instanceUrl: trustedPeers.instanceUrl })
      .from(trustedPeers)
      .where(
        and(
          eq(trustedPeers.domain, originDomain),
          eq(trustedPeers.status, 'active'),
        ),
      )
      .limit(1);

    if (!peer) return;

    // SSRF check on peer URL before any file fetches
    const devMode =
      process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    await validateOutboundUrl(peer.instanceUrl, { devMode });

    const storage = getGlobalRegistry().resolve<S3StorageAdapter>('storage');
    const storedFiles: Array<{ fileId: string; storageKey: string }> = [];

    for (const entry of fileManifest) {
      try {
        const url = `${peer.instanceUrl}/federation/v1/transfers/${transferId}/files/${entry.fileId}`;
        const response = await fetch(url, {
          headers: { authorization: `Bearer ${transferToken}` },
          signal: AbortSignal.timeout(60_000),
        });

        if (!response.ok) {
          getLogger().error(
            { fileId: entry.fileId, status: response.status },
            '[transfer] File fetch failed',
          );
          continue;
        }

        // Store in S3 under transfer-specific key prefix
        const storageKey = `transfers/${localSubmissionId}/${entry.fileId}/${entry.filename}`;
        const buffer = Buffer.from(await response.arrayBuffer());
        await storage.uploadToBucket(
          storage.defaultBucket,
          storageKey,
          buffer,
          entry.mimeType,
        );

        storedFiles.push({ fileId: entry.fileId, storageKey });
      } catch (err) {
        getLogger().error(
          { fileId: entry.fileId, err },
          '[transfer] File fetch error',
        );
      }
    }

    // Update the submission's file manifest with storage keys for later linking
    if (storedFiles.length > 0) {
      await withRls({ orgId }, async (tx) => {
        // Store the storage key mapping alongside the original manifest
        const enrichedManifest = fileManifest.map((entry) => {
          const stored = storedFiles.find((s) => s.fileId === entry.fileId);
          return { ...entry, storageKey: stored?.storageKey };
        });

        await tx
          .update(submissions)
          .set({
            // Store enriched manifest as form data for later processing
            formData: { _transferFiles: enrichedManifest } as Record<
              string,
              unknown
            >,
          })
          .where(eq(submissions.id, localSubmissionId));
      });
    }
  },

  // ─── Origin-side file serving ───

  /**
   * Verify a transfer token for file serving.
   *
   * Superuser query — justified: pre-auth token validation, no org context
   * available. File serve endpoint has no OIDC session.
   */
  async verifyTransferToken(
    env: Env,
    token: string,
    transferId: string,
    fileId: string,
  ): Promise<{
    submissionId: string;
    manuscriptVersionId: string;
    orgId: string;
  }> {
    // Look up the transfer record to get the origin's signing config
    const [transfer] = await db
      .select({
        id: pieceTransfers.id,
        submissionId: pieceTransfers.submissionId,
        manuscriptVersionId: pieceTransfers.manuscriptVersionId,
        status: pieceTransfers.status,
      })
      .from(pieceTransfers)
      .where(eq(pieceTransfers.id, transferId))
      .limit(1);

    if (!transfer) {
      throw new TransferTokenError(`Transfer not found: ${transferId}`);
    }

    if (
      transfer.status !== 'PENDING' &&
      transfer.status !== 'FILES_REQUESTED'
    ) {
      throw new TransferTokenError(
        `Transfer in invalid state for file serving: ${transfer.status}`,
      );
    }

    // Verify JWT using the local instance's public key
    const config = await federationService.getOrInitConfig(env);
    const publicKeyObj = crypto.createPublicKey(config.publicKey);

    let claims: jose.JWTPayload;
    try {
      const { payload } = await jose.jwtVerify(token, publicKeyObj);
      claims = payload;
    } catch (err) {
      throw new TransferTokenError(
        `Token verification failed: ${err instanceof Error ? err.message : 'invalid'}`,
      );
    }

    // Verify jti matches transferId
    if (claims.jti !== transferId) {
      throw new TransferTokenError('Token jti does not match transfer ID');
    }

    // Verify fileId is in the allowed list
    const allowedFileIds = (claims as Record<string, unknown>).fileIds as
      | string[]
      | undefined;
    if (!allowedFileIds || !allowedFileIds.includes(fileId)) {
      throw new TransferTokenError('File ID not in transfer allowlist');
    }

    // Get org context from submission
    const [sub] = await db
      .select({ organizationId: submissions.organizationId })
      .from(submissions)
      .where(eq(submissions.id, transfer.submissionId))
      .limit(1);

    if (!sub) {
      throw new TransferTokenError('Submission not found for transfer');
    }

    // Update status to FILES_REQUESTED if still PENDING
    if (transfer.status === 'PENDING') {
      // Fire and forget status update
      void withRls({ orgId: sub.organizationId }, async (tx) => {
        await tx
          .update(pieceTransfers)
          .set({ status: 'FILES_REQUESTED', updatedAt: new Date() })
          .where(
            and(
              eq(pieceTransfers.id, transferId),
              eq(pieceTransfers.status, 'PENDING'),
            ),
          );
      }).catch(() => {
        // Status update is best-effort
      });
    }

    return {
      submissionId: transfer.submissionId,
      manuscriptVersionId: transfer.manuscriptVersionId,
      orgId: sub.organizationId,
    };
  },

  /** Stream a file for a verified transfer. */
  async getFileStream(
    _env: Env,
    transferId: string,
    fileId: string,
  ): Promise<{
    stream: Readable;
    filename: string;
    mimeType: string;
    size: number;
  }> {
    // verifyTransferToken must be called first to get orgId
    const [transfer] = await db
      .select({
        manuscriptVersionId: pieceTransfers.manuscriptVersionId,
        submissionId: pieceTransfers.submissionId,
      })
      .from(pieceTransfers)
      .where(eq(pieceTransfers.id, transferId))
      .limit(1);

    if (!transfer) {
      throw new TransferFileNotFoundError(fileId);
    }

    // Get org for RLS
    const [sub] = await db
      .select({ organizationId: submissions.organizationId })
      .from(submissions)
      .where(eq(submissions.id, transfer.submissionId))
      .limit(1);

    if (!sub) {
      throw new TransferFileNotFoundError(fileId);
    }

    // Look up the file within RLS context
    const [file] = await withRls({ orgId: sub.organizationId }, async (tx) => {
      return tx
        .select({
          id: files.id,
          filename: files.filename,
          mimeType: files.mimeType,
          size: files.size,
          storageKey: files.storageKey,
          scanStatus: files.scanStatus,
          manuscriptVersionId: files.manuscriptVersionId,
        })
        .from(files)
        .where(
          and(
            eq(files.id, fileId),
            eq(files.manuscriptVersionId, transfer.manuscriptVersionId),
          ),
        )
        .limit(1);
    });

    if (!file) {
      throw new TransferFileNotFoundError(fileId);
    }

    if (file.scanStatus !== 'CLEAN') {
      throw new TransferFileNotFoundError(fileId);
    }

    const storage = getGlobalRegistry().resolve<S3StorageAdapter>('storage');
    const stream = await storage.downloadFromBucket(
      storage.defaultBucket,
      file.storageKey,
    );

    return {
      stream,
      filename: file.filename,
      mimeType: file.mimeType,
      size: Number(file.size),
    };
  },
};
