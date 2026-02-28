import sanitizeHtml from 'sanitize-html';
import { emailTemplates, eq, and, type DrizzleDb } from '@colophony/db';
import {
  AuditActions,
  AuditResources,
  TEMPLATE_MERGE_FIELDS,
  type EmailTemplateName,
  type UpsertEmailTemplateInput,
} from '@colophony/types';
import type { ServiceContext } from './types.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class EmailTemplateNotFoundError extends Error {
  constructor(templateName: string) {
    super(`Email template "${templateName}" not found`);
    this.name = 'EmailTemplateNotFoundError';
  }
}

export class InvalidMergeFieldError extends Error {
  constructor(field: string, templateName: string) {
    super(`Invalid merge field "{{${field}}}" for template "${templateName}"`);
    this.name = 'InvalidMergeFieldError';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    'a',
    'ul',
    'ol',
    'li',
    'blockquote',
    'h1',
    'h2',
    'h3',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
};

/** Sanitize HTML to the same allowlist as Tiptap content in templates.ts. */
export function sanitizeTemplateHtml(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

const MERGE_FIELD_RE = /\{\{(\w+)\}\}/g;

/**
 * Validate that all `{{field}}` placeholders in `text` are allowed for the
 * given template. Throws {@link InvalidMergeFieldError} on the first invalid
 * field.
 */
export function validateMergeFields(
  text: string,
  templateName: EmailTemplateName,
): void {
  const allowed = TEMPLATE_MERGE_FIELDS[templateName];
  const re = /\{\{(\w+)\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (!allowed.includes(match[1])) {
      throw new InvalidMergeFieldError(match[1], templateName);
    }
  }
}

/**
 * Replace `{{field}}` placeholders with values from `data`. Missing fields
 * are replaced with an empty string.
 */
export function interpolateMergeFields(
  template: string,
  data: Record<string, unknown>,
): string {
  return template.replace(MERGE_FIELD_RE, (_, field: string) => {
    const value = data[field];
    return value != null ? String(value) : '';
  });
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const emailTemplateService = {
  /**
   * List active custom template overrides for the current org (RLS-scoped).
   * Returns only the id and templateName — the caller builds the full list
   * by cross-referencing with the static template catalog.
   */
  async list(tx: DrizzleDb) {
    return tx
      .select({
        id: emailTemplates.id,
        templateName: emailTemplates.templateName,
      })
      .from(emailTemplates)
      .where(eq(emailTemplates.isActive, true));
  },

  /** Get a single template override by name (RLS-scoped, active only). */
  async getByName(tx: DrizzleDb, templateName: string) {
    const [row] = await tx
      .select()
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.templateName, templateName),
          eq(emailTemplates.isActive, true),
        ),
      )
      .limit(1);

    return row ?? null;
  },

  /** Get subject + body for a template (worker use — no full row needed). */
  async getActiveTemplate(tx: DrizzleDb, templateName: string) {
    const [row] = await tx
      .select({
        subjectTemplate: emailTemplates.subjectTemplate,
        bodyHtml: emailTemplates.bodyHtml,
      })
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.templateName, templateName),
          eq(emailTemplates.isActive, true),
        ),
      )
      .limit(1);

    return row ?? null;
  },

  /**
   * Insert or update a template override. Validates merge fields and
   * sanitizes the HTML body.
   */
  async upsert(tx: DrizzleDb, orgId: string, input: UpsertEmailTemplateInput) {
    const { templateName, subjectTemplate, bodyHtml } = input;

    // Validate merge fields in both subject and body
    validateMergeFields(subjectTemplate, templateName);
    validateMergeFields(bodyHtml, templateName);

    // Sanitize body HTML
    const sanitizedBody = sanitizeTemplateHtml(bodyHtml);

    const [row] = await tx
      .insert(emailTemplates)
      .values({
        organizationId: orgId,
        templateName,
        subjectTemplate,
        bodyHtml: sanitizedBody,
      })
      .onConflictDoUpdate({
        target: [emailTemplates.organizationId, emailTemplates.templateName],
        set: {
          subjectTemplate,
          bodyHtml: sanitizedBody,
          isActive: true,
        },
      })
      .returning();

    return row;
  },

  /** Upsert with audit logging (CREATED or UPDATED). */
  async upsertWithAudit(ctx: ServiceContext, input: UpsertEmailTemplateInput) {
    const existing = await this.getByName(ctx.tx, input.templateName);
    const row = await this.upsert(ctx.tx, ctx.actor.orgId, input);

    await ctx.audit({
      resource: AuditResources.EMAIL_TEMPLATE,
      action: existing
        ? AuditActions.EMAIL_TEMPLATE_UPDATED
        : AuditActions.EMAIL_TEMPLATE_CREATED,
      resourceId: row.id,
      newValue: {
        templateName: input.templateName,
        subjectTemplate: input.subjectTemplate,
      },
    });

    return row;
  },

  /** Delete a template override (resets to built-in default). */
  async delete(tx: DrizzleDb, templateName: string) {
    const [row] = await tx
      .delete(emailTemplates)
      .where(eq(emailTemplates.templateName, templateName))
      .returning();

    return row ?? null;
  },

  /** Delete with audit logging. Throws if the template doesn't exist. */
  async deleteWithAudit(ctx: ServiceContext, templateName: string) {
    const row = await this.delete(ctx.tx, templateName);

    if (!row) {
      throw new EmailTemplateNotFoundError(templateName);
    }

    await ctx.audit({
      resource: AuditResources.EMAIL_TEMPLATE,
      action: AuditActions.EMAIL_TEMPLATE_DELETED,
      resourceId: row.id,
      newValue: { templateName },
    });

    return row;
  },
};
