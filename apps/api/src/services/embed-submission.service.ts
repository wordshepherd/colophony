import {
  db,
  users,
  formDefinitions,
  formPages,
  formFields,
  eq,
  sql,
} from '@colophony/db';
import { withRls } from '@colophony/db';
import { asc } from 'drizzle-orm';
import type { EmbedSubmitInput } from '@colophony/types';
import { AuditActions, AuditResources } from '@colophony/types';
import type { VerifiedEmbedToken } from './embed-token.service.js';
import { auditService } from './audit.service.js';
import { submissionService } from './submission.service.js';

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
  ): Promise<{ submissionId: string; userId: string }> {
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

        return { submissionId: submission.id };
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
