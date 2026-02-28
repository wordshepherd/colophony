import sanitizeHtml from 'sanitize-html';
import mjml2html from 'mjml';
import type { TemplateName } from './types.js';
import { templates } from './templates.js';
import { wrapInLayout } from './layout.js';
import {
  sanitizeTemplateHtml,
  interpolateMergeFields,
} from '../../services/email-template.service.js';

export interface RenderedEmail {
  html: string;
  text: string;
  subject: string;
}

export function renderMjml(mjmlString: string): { html: string } {
  const result = mjml2html(mjmlString, { validationLevel: 'soft' });
  return { html: result.html };
}

export function renderEmailTemplate(
  name: TemplateName,
  data: Record<string, unknown>,
): RenderedEmail {
  const renderer = templates[name];
  if (!renderer) {
    throw new Error(`Unknown email template: ${name}`);
  }

  const { mjml, text, subject } = renderer(data);
  const { html } = renderMjml(mjml);

  return { html, text, subject };
}

/**
 * Render a custom (user-defined) email template with merge field
 * interpolation, HTML sanitization, and MJML layout wrapping.
 */
export function renderCustomTemplate(
  customTemplate: { subjectTemplate: string; bodyHtml: string },
  data: Record<string, unknown>,
  orgName: string,
): RenderedEmail {
  // Interpolate merge fields in subject
  const subject = interpolateMergeFields(customTemplate.subjectTemplate, data);

  // Interpolate + sanitize body HTML
  const interpolatedBody = interpolateMergeFields(
    customTemplate.bodyHtml,
    data,
  );
  const sanitizedBody = sanitizeTemplateHtml(interpolatedBody);

  // Wrap in MJML layout and render
  const mjmlString = wrapInLayout(
    `<mj-text>${sanitizedBody}</mj-text>`,
    orgName,
  );
  const { html } = renderMjml(mjmlString);

  // Generate plain text by stripping HTML
  const text = sanitizeHtml(sanitizedBody, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/&nbsp;/g, ' ')
    .trim();

  return { html, text, subject };
}
