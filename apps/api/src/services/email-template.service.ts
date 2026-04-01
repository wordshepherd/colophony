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
import { escapeHtml } from '../templates/email/escape-html.js';

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

export class InvalidTemplateSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTemplateSyntaxError';
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
    'div',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    div: ['style'],
    p: ['style'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedStyles: {
    div: {
      'margin-bottom': [/.*/],
      'padding-left': [/.*/],
      'border-left': [/.*/],
    },
    p: {
      color: [/.*/],
      'font-size': [/.*/],
    },
  },
};

/** Sanitize HTML to the same allowlist as Tiptap content in templates.ts. */
export function sanitizeTemplateHtml(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

const MERGE_FIELD_RE = /\{\{(\w+)\}\}/g;

/**
 * Validate that all `{{field}}` placeholders and `{{#each field}}` blocks in
 * `text` are allowed for the given template. Throws
 * {@link InvalidMergeFieldError} on the first invalid field, or
 * {@link InvalidTemplateSyntaxError} on malformed block syntax.
 *
 * `{{this.prop}}` inside blocks is not validated against the top-level list
 * (the dot prevents matching `\w+`).
 */
export function validateMergeFields(
  text: string,
  templateName: EmailTemplateName,
): void {
  const allowed = TEMPLATE_MERGE_FIELDS[templateName];

  // Detect unclosed {{#each}} blocks (opening without matching close)
  const opens = text.match(/\{\{#each\s+\w+\}\}/g) ?? [];
  const closes = text.match(/\{\{\/each\}\}/g) ?? [];
  if (opens.length !== closes.length) {
    throw new InvalidTemplateSyntaxError(
      'Unclosed {{#each}} block — every {{#each field}} must have a matching {{/each}}',
    );
  }

  // Strip {{#each field}}...{{/each}} blocks, validating the block field name
  const withoutBlocks = text.replace(
    /\{\{#each\s+(\w+)\}\}[\s\S]*?\{\{\/each\}\}/g,
    (_, field: string) => {
      if (!allowed.includes(field)) {
        throw new InvalidMergeFieldError(field, templateName);
      }
      return '';
    },
  );

  // Validate remaining scalar {{field}} placeholders
  const re = /\{\{(\w+)\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(withoutBlocks)) !== null) {
    if (!allowed.includes(match[1])) {
      throw new InvalidMergeFieldError(match[1], templateName);
    }
  }
}

/**
 * Validate subject template — scalar `{{field}}` only, no `{{#each}}` blocks.
 * Subjects are rendered with scalar-only interpolation; block syntax would
 * appear as raw markup in outgoing email subject lines.
 */
export function validateSubjectMergeFields(
  text: string,
  templateName: EmailTemplateName,
): void {
  if (/\{\{#each\s/.test(text)) {
    throw new InvalidTemplateSyntaxError(
      '{{#each}} blocks are not allowed in subject templates — use scalar merge fields only',
    );
  }
  // Delegate scalar validation to the standard validator
  validateMergeFields(text, templateName);
}

/**
 * Replace `{{field}}` placeholders with scalar values from `data`. Arrays are
 * replaced with an empty string (use {@link interpolateMergeFieldsBody} for
 * HTML body content that supports arrays).
 */
export function interpolateMergeFields(
  template: string,
  data: Record<string, unknown>,
): string {
  return template.replace(MERGE_FIELD_RE, (_, field: string) => {
    const value = data[field];
    if (value == null || Array.isArray(value)) return '';
    return String(value);
  });
}

// ---------------------------------------------------------------------------
// Block interpolation — {{#each field}}...{{/each}} for array data
// ---------------------------------------------------------------------------

const BLOCK_RE = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
const INNER_FIELD_RE = /\{\{this\.(\w+)\}\}/g;

/**
 * Process `{{#each field}}...{{/each}}` blocks. Each array item's inner
 * `{{this.prop}}` references are replaced with HTML-escaped values.
 * Arrays-of-primitives (e.g. `tags: string[]`) auto-join with `, `.
 */
export function interpolateBlockFields(
  template: string,
  data: Record<string, unknown>,
): string {
  return template.replace(BLOCK_RE, (_, fieldName: string, inner: string) => {
    const value = data[fieldName];
    if (!Array.isArray(value) || value.length === 0) return '';

    return (value as Array<Record<string, unknown>>)
      .map((item) =>
        inner.replace(INNER_FIELD_RE, (__, prop: string) => {
          const v = item[prop];
          if (Array.isArray(v))
            return v.map((s) => escapeHtml(String(s))).join(', ');
          return v != null ? escapeHtml(String(v)) : '';
        }),
      )
      .join('');
  });
}

/**
 * Render a default HTML block for an array merge field used as a scalar tag
 * (e.g. `{{readerFeedback}}`). Matches the built-in template visual style.
 */
export function renderDefaultArrayBlock(
  items: Array<Record<string, unknown>>,
  fieldName: string,
): string {
  if (fieldName === 'readerFeedback') {
    return items
      .map((item) => {
        const tags = Array.isArray(item.tags)
          ? (item.tags as string[]).map(escapeHtml).join(', ')
          : '';
        const comment = item.comment ? escapeHtml(String(item.comment)) : '';
        const tagLine = tags
          ? `<p style="color:#6b7280;font-size:13px">${tags}</p>`
          : '';
        const commentLine = comment ? `<p>${comment}</p>` : '';
        return `<div style="margin-bottom:12px;padding-left:12px;border-left:3px solid #e5e7eb">${tagLine}${commentLine}</div>`;
      })
      .join('');
  }
  // Generic fallback for future array fields
  return items
    .map((item) => `<li>${escapeHtml(JSON.stringify(item))}</li>`)
    .join('');
}

/**
 * Full merge field interpolation for HTML body content. Supports both
 * `{{#each field}}...{{/each}}` blocks and `{{field}}` scalar/array shorthand.
 */
export function interpolateMergeFieldsBody(
  template: string,
  data: Record<string, unknown>,
): string {
  // First pass: expand {{#each}}...{{/each}} blocks
  const withBlocks = interpolateBlockFields(template, data);

  // Second pass: replace scalar {{field}} placeholders
  return withBlocks.replace(MERGE_FIELD_RE, (_, field: string) => {
    const value = data[field];
    if (value == null) return '';
    if (Array.isArray(value)) {
      return renderDefaultArrayBlock(
        value as Array<Record<string, unknown>>,
        field,
      );
    }
    return String(value);
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
    validateSubjectMergeFields(subjectTemplate, templateName);
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
  async delete(tx: DrizzleDb, orgId: string, templateName: string) {
    const [row] = await tx
      .delete(emailTemplates)
      .where(
        and(
          eq(emailTemplates.organizationId, orgId),
          eq(emailTemplates.templateName, templateName),
        ),
      )
      .returning();

    return row ?? null;
  },

  /** Delete with audit logging. Throws if the template doesn't exist. */
  async deleteWithAudit(ctx: ServiceContext, templateName: string) {
    const row = await this.delete(ctx.tx, ctx.actor.orgId, templateName);

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
