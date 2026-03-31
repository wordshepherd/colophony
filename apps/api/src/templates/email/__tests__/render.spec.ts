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
    {
      name: 'organization-invitation',
      data: {
        orgName: 'Test Lit Mag',
        inviterName: 'admin@example.com',
        inviteUrl: 'https://example.com/invite/accept/col_inv_abc123',
        roleName: 'Editor',
        expiresAt: 'April 3, 2026',
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

  describe('submission-rejected with reader feedback', () => {
    const baseData = {
      submissionTitle: 'My Poem',
      submitterName: 'Alice',
      submitterEmail: 'alice@example.com',
      orgName: 'Test Lit Mag',
    };

    it('does not include feedback section when no feedback provided', () => {
      const result = renderEmailTemplate('submission-rejected', baseData);
      expect(result.text).not.toContain('Reader feedback');
      expect(result.html).not.toContain('Reader feedback');
    });

    it('includes feedback section when readerFeedback is present', () => {
      const result = renderEmailTemplate('submission-rejected', {
        ...baseData,
        readerFeedback: [
          { tags: ['engaging', 'well-written'], comment: 'Great pacing' },
          { tags: ['needs-work'], comment: null },
        ],
      });

      // Check plaintext
      expect(result.text).toContain('Reader feedback');
      expect(result.text).toContain('engaging');
      expect(result.text).toContain('Great pacing');
      expect(result.text).toContain('needs-work');

      // Check HTML
      expect(result.html).toContain('Reader feedback');
      expect(result.html).toContain('engaging');
      expect(result.html).toContain('Great pacing');
    });

    it('escapes HTML in feedback tags and comments', () => {
      const result = renderEmailTemplate('submission-rejected', {
        ...baseData,
        readerFeedback: [
          {
            tags: ['<script>alert("xss")</script>'],
            comment: '<img onerror="alert(1)">',
          },
        ],
      });

      expect(result.html).not.toContain('<script>');
      expect(result.html).not.toContain('<img onerror');
      expect(result.html).toContain('&lt;script&gt;');
    });
  });
});
