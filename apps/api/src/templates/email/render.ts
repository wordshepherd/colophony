import sanitizeHtml from 'sanitize-html';
import mjml2html from 'mjml';
import type { TemplateName } from './types.js';
import { templates } from './templates.js';
import { wrapInLayout } from './layout.js';
import {
  sanitizeTemplateHtml,
  interpolateMergeFields,
  interpolateMergeFieldsBody,
} from '../../services/email-template.service.js';

export interface RenderedEmail {
  html: string;
  text: string;
  subject: string;
}

/**
 * mjml 5 returns a Promise from mjml2html; mjml 4 returned the result
 * synchronously. Promise.resolve() normalizes both, so the render layer is
 * async regardless of which major is installed.
 */
export async function renderMjml(
  mjmlString: string,
): Promise<{ html: string }> {
  const result = await Promise.resolve(
    mjml2html(mjmlString, { validationLevel: 'soft' }),
  );
  return { html: result.html };
}

export async function renderEmailTemplate(
  name: TemplateName,
  data: Record<string, unknown>,
): Promise<RenderedEmail> {
  const renderer = templates[name];
  if (!renderer) {
    throw new Error(`Unknown email template: ${name}`);
  }

  const { mjml, text, subject } = renderer(data);
  const { html } = await renderMjml(mjml);

  return { html, text, subject };
}

/**
 * Render a custom (user-defined) email template with merge field
 * interpolation, HTML sanitization, and MJML layout wrapping.
 */
export async function renderCustomTemplate(
  customTemplate: { subjectTemplate: string; bodyHtml: string },
  data: Record<string, unknown>,
  orgName: string,
): Promise<RenderedEmail> {
  // Interpolate merge fields in subject (scalar-only — no HTML blocks)
  const subject = interpolateMergeFields(customTemplate.subjectTemplate, data);

  // Interpolate body HTML (supports {{#each}} blocks and array shorthand)
  const interpolatedBody = interpolateMergeFieldsBody(
    customTemplate.bodyHtml,
    data,
  );
  const sanitizedBody = sanitizeTemplateHtml(interpolatedBody);

  // Wrap in MJML layout and render
  const mjmlString = wrapInLayout(
    `<mj-text>${sanitizedBody}</mj-text>`,
    orgName,
  );
  const { html } = await renderMjml(mjmlString);

  // Generate plain text: convert block elements to newlines before stripping
  const textFriendly = sanitizedBody
    .replace(/<\/div>/gi, '</div>\n')
    .replace(/<\/p>/gi, '</p>\n')
    .replace(/<br\s*\/?>/gi, '\n');
  const text = sanitizeHtml(textFriendly, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { html, text, subject };
}
