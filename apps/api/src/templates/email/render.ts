import mjml2html from 'mjml';
import type { TemplateName } from './types.js';
import { templates } from './templates.js';

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
