import { describe, it, expect } from 'vitest';
import { renderEmailTemplate, renderMjml } from '../render.js';
import type { TemplateName } from '../types.js';

describe('renderMjml', () => {
  it('converts MJML to HTML', () => {
    const mjml = `<mjml><mj-body><mj-section><mj-column><mj-text>Hello</mj-text></mj-column></mj-section></mj-body></mjml>`;
    const result = renderMjml(mjml);
    expect(result.html).toContain('Hello');
    expect(result.html).toContain('<!doctype html>');
  });
});

describe('renderEmailTemplate', () => {
  const templates: Array<{
    name: TemplateName;
    data: Record<string, unknown>;
  }> = [
    {
      name: 'submission-received',
      data: {
        submissionTitle: 'My Poem',
        submitterName: 'Alice',
        submitterEmail: 'alice@example.com',
        orgName: 'Test Lit Mag',
      },
    },
    {
      name: 'submission-accepted',
      data: {
        submissionTitle: 'My Poem',
        submitterName: 'Alice',
        submitterEmail: 'alice@example.com',
        orgName: 'Test Lit Mag',
      },
    },
    {
      name: 'submission-rejected',
      data: {
        submissionTitle: 'My Poem',
        submitterName: 'Alice',
        submitterEmail: 'alice@example.com',
        orgName: 'Test Lit Mag',
      },
    },
    {
      name: 'submission-withdrawn',
      data: {
        submissionTitle: 'My Poem',
        submitterName: 'Alice',
        submitterEmail: 'alice@example.com',
        orgName: 'Test Lit Mag',
      },
    },
    {
      name: 'contract-ready',
      data: {
        submissionTitle: 'My Poem',
        signerName: 'Alice',
        orgName: 'Test Lit Mag',
      },
    },
    {
      name: 'copyeditor-assigned',
      data: {
        submissionTitle: 'My Poem',
        copyeditorName: 'Bob',
        orgName: 'Test Lit Mag',
      },
    },
  ];

  for (const { name, data } of templates) {
    it(`renders ${name} template with html, text, and subject`, () => {
      const result = renderEmailTemplate(name, data);
      expect(result.html).toBeTruthy();
      expect(result.html).toContain('<!doctype html>');
      expect(result.text).toBeTruthy();
      expect(result.subject).toBeTruthy();
    });
  }

  it('throws for unknown template', () => {
    expect(() =>
      renderEmailTemplate('nonexistent' as TemplateName, {}),
    ).toThrow('Unknown email template');
  });
});
