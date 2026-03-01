import {
  db,
  users,
  formDefinitions,
  formPages,
  formFields,
  manuscripts,
  manuscriptVersions,
  eq,
  sql,
} from '@colophony/db';
import { withRls } from '@colophony/db';
import { asc } from 'drizzle-orm';
import type { EmbedSubmitInput } from '@colophony/types';
import type {
  EmbedPrepareUploadResponse,
  EmbedUploadStatusResponse,
} from '@colophony/types';
import {
  AuditActions,
  AuditResources,
  MAX_FILE_SIZE,
  MAX_FILES_PER_MANUSCRIPT_VERSION,
  ALLOWED_MIME_TYPES,
} from '@colophony/types';
import type { VerifiedEmbedToken } from './embed-token.service.js';
import { auditService } from './audit.service.js';
import { submissionService } from './submission.service.js';
import { fileService } from './file.service.js';
import { statusTokenService } from './status-token.service.js';
import { enqueueOutboxEvent } from './outbox.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class PeriodClosedError extends Error {
  constructor(periodName: string) {
    super(`Submission period "${periodName}" is not currently open`);
    this.name = 'PeriodClosedError';
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const embedSubmissionService = {
  /**
   * Find an existing user by email (case-insensitive) or create a guest user.
   * Uses the shared `db` instance (no RLS on users table).
   */
  async findOrCreateGuestUser(
    email: string,
    _name?: string,
  ): Promise<{ id: string; isNew: boolean }> {
    const normalizedEmail = email.toLowerCase().trim();

    // Try to find existing user by lowercase email
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${normalizedEmail}`)
      .limit(1);

    if (existing) {
      return { id: existing.id, isNew: false };
    }

    // Create guest user — retry on unique constraint race (concurrent submissions)
    try {
      const [created] = await db
        .insert(users)
        .values({
          email: normalizedEmail,
          isGuest: true,
          emailVerified: false,
        })
        .returning({ id: users.id });

      return { id: created.id, isNew: true };
    } catch (err: unknown) {
      // Unique constraint violation (23505) — another request created the user concurrently
      if (
        err instanceof Error &&
        'code' in err &&
        (err as { code: string }).code === '23505'
      ) {
        const [raced] = await db
          .select({ id: users.id })
          .from(users)
          .where(sql`lower(${users.email}) = ${normalizedEmail}`)
          .limit(1);
        if (raced) return { id: raced.id, isNew: false };
      }
      throw err;
    }
  },

  /**
   * Find an existing user by email (case-insensitive). SELECT only — no INSERT.
   * Used by getUploadStatus to avoid creating users on a polling endpoint.
   */
  async findGuestUser(email: string): Promise<{ id: string } | null> {
    const normalizedEmail = email.toLowerCase().trim();
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${normalizedEmail}`)
      .limit(1);
    return existing ?? null;
  },

  /**
   * Prepare for file upload from an embedded form.
   *
   * 1. Validate period is open
   * 2. Find/create guest user
   * 3. Create manuscript + version under RLS
   * 4. Return upload config (client passes guestUserId as tus metadata)
   */
  async prepareUpload(
    token: VerifiedEmbedToken,
    input: { email: string; name?: string },
    ipAddress: string,
    userAgent: string | undefined,
    tusEndpoint: string,
  ): Promise<EmbedPrepareUploadResponse> {
    // Validate period is open
    const now = new Date();
    if (now < token.period.opensAt || now > token.period.closesAt) {
      throw new PeriodClosedError(token.period.name);
    }

    // Find/create guest user (no RLS — users table has no RLS)
    const { id: userId, isNew } =
      await embedSubmissionService.findOrCreateGuestUser(
        input.email,
        input.name,
      );

    if (isNew) {
      await auditService.logDirect({
        action: AuditActions.GUEST_USER_CREATED,
        resource: AuditResources.EMBED_TOKEN,
        resourceId: userId,
        ipAddress,
        userAgent,
        newValue: { email: input.email, embedTokenId: token.id },
      });
    }

    // Create manuscript + version under RLS
    const result = await withRls(
      { orgId: token.organizationId, userId },
      async (tx) => {
        const [manuscript] = await tx
          .insert(manuscripts)
          .values({
            ownerId: userId,
            title: `Embed upload — ${input.email}`,
          })
          .returning({ id: manuscripts.id });

        const [version] = await tx
          .insert(manuscriptVersions)
          .values({
            manuscriptId: manuscript.id,
            versionNumber: 1,
          })
          .returning({ id: manuscriptVersions.id });

        // Audit manuscript + version creation
        await auditService.log(tx, {
          action: AuditActions.MANUSCRIPT_CREATED,
          resource: AuditResources.MANUSCRIPT,
          resourceId: manuscript.id,
          actorId: userId,
          organizationId: token.organizationId,
          ipAddress,
          userAgent,
          newValue: { embedTokenId: token.id, email: input.email },
        });

        await auditService.log(tx, {
          action: AuditActions.MANUSCRIPT_VERSION_CREATED,
          resource: AuditResources.MANUSCRIPT,
          resourceId: version.id,
          actorId: userId,
          organizationId: token.organizationId,
          ipAddress,
          userAgent,
          newValue: { manuscriptId: manuscript.id, versionNumber: 1 },
        });

        return { manuscriptVersionId: version.id };
      },
    );

    return {
      manuscriptVersionId: result.manuscriptVersionId,
      guestUserId: userId,
      tusEndpoint,
      maxFileSize: MAX_FILE_SIZE,
      maxFiles: MAX_FILES_PER_MANUSCRIPT_VERSION,
      allowedMimeTypes: [...ALLOWED_MIME_TYPES],
    };
  },

  /**
   * Get upload status for files in a manuscript version.
   * SELECT-only user lookup — does not create users.
   */
  async getUploadStatus(
    token: VerifiedEmbedToken,
    manuscriptVersionId: string,
    guestEmail: string,
  ): Promise<EmbedUploadStatusResponse> {
    const user = await embedSubmissionService.findGuestUser(guestEmail);
    if (!user) {
      const err = new Error('User not found');
      (err as Error & { statusCode: number }).statusCode = 404;
      throw err;
    }

    // Scope to token's org + user — prevents cross-token enumeration
    const files = await withRls(
      { orgId: token.organizationId, userId: user.id },
      async (tx) => {
        return fileService.listByManuscriptVersion(tx, manuscriptVersionId);
      },
    );

    return {
      files: files.map((f) => ({
        id: f.id,
        filename: f.filename,
        size: Number(f.size),
        mimeType: f.mimeType,
        scanStatus: f.scanStatus,
      })),
      allClean:
        files.length > 0 && files.every((f) => f.scanStatus === 'CLEAN'),
    };
  },

  /**
   * Submit from an embedded form.
   *
   * 1. Find/create guest user (outside RLS — users table has no RLS)
   * 2. Open RLS transaction with org+user context
   * 3. Validate period is open
   * 4. Create DRAFT submission, then transition to SUBMITTED via updateStatus
   *    (reuses invariant checks: form validation, file scan verification)
   * 5. Audit log
   */
  async submitFromEmbed(
    token: VerifiedEmbedToken,
    input: EmbedSubmitInput,
    ipAddress: string,
    userAgent: string | undefined,
  ): Promise<{ submissionId: string; userId: string; statusToken: string }> {
    // Step 1: Find/create guest user (no RLS)
    const { id: userId, isNew } =
      await embedSubmissionService.findOrCreateGuestUser(
        input.email,
        input.name,
      );

    if (isNew) {
      // Audit guest user creation outside RLS (no org context needed)
      await auditService.logDirect({
        action: AuditActions.GUEST_USER_CREATED,
        resource: AuditResources.EMBED_TOKEN,
        resourceId: userId,
        ipAddress,
        userAgent,
        newValue: { email: input.email, embedTokenId: token.id },
      });
    }

    // Step 2: RLS transaction with org + user context
    const result = await withRls(
      { orgId: token.organizationId, userId },
      async (tx) => {
        // Step 3: Validate period is open
        const now = new Date();
        if (now < token.period.opensAt || now > token.period.closesAt) {
          throw new PeriodClosedError(token.period.name);
        }

        // Step 4a: Create DRAFT submission
        const submission = await submissionService.create(
          tx,
          {
            title: input.title,
            content: input.content,
            coverLetter: input.coverLetter,
            submissionPeriodId: token.submissionPeriodId,
            formData: input.formData,
            manuscriptVersionId: input.manuscriptVersionId,
          },
          token.organizationId,
          userId,
        );

        // Step 4b: Transition DRAFT → SUBMITTED (reuses invariant checks)
        await submissionService.updateStatus(
          tx,
          submission.id,
          'SUBMITTED',
          userId,
          undefined,
          'submitter',
        );

        // Step 5: Audit log
        await auditService.log(tx, {
          action: AuditActions.EMBED_SUBMISSION_CREATED,
          resource: AuditResources.EMBED_TOKEN,
          resourceId: submission.id,
          actorId: userId,
          organizationId: token.organizationId,
          ipAddress,
          userAgent,
          newValue: {
            title: input.title,
            embedTokenId: token.id,
            submissionPeriodId: token.submissionPeriodId,
          },
        });

        // Step 6: Generate status token for public status checking
        const statusToken = await statusTokenService.generateAndStore(
          tx,
          submission.id,
        );

        // Step 7: Enqueue outbox event (triggers editor + embed confirmation notifications)
        await enqueueOutboxEvent(tx, 'hopper/submission.submitted', {
          orgId: token.organizationId,
          submissionId: submission.id,
          submitterId: userId,
          isEmbed: true,
          submitterEmail: input.email,
          statusToken,
        });

        return { submissionId: submission.id, statusToken };
      },
    );

    return { ...result, userId };
  },

  /**
   * Load form definition with fields and pages for the embed response.
   * Uses RLS context from the token's org.
   */
  async loadFormForEmbed(token: VerifiedEmbedToken): Promise<{
    id: string;
    name: string;
    fields: unknown[];
    pages: unknown[];
  } | null> {
    if (!token.period.formDefinitionId) return null;

    return withRls({ orgId: token.organizationId }, async (tx) => {
      const [form] = await tx
        .select({
          id: formDefinitions.id,
          name: formDefinitions.name,
        })
        .from(formDefinitions)
        .where(eq(formDefinitions.id, token.period.formDefinitionId!))
        .limit(1);

      if (!form) return null;

      const [fields, pages] = await Promise.all([
        tx
          .select()
          .from(formFields)
          .where(eq(formFields.formDefinitionId, form.id))
          .orderBy(asc(formFields.sortOrder)),
        tx
          .select()
          .from(formPages)
          .where(eq(formPages.formDefinitionId, form.id))
          .orderBy(asc(formPages.sortOrder)),
      ]);

      return {
        id: form.id,
        name: form.name,
        fields,
        pages,
      };
    });
  },
};
