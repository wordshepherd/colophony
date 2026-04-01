import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditActions, AuditResources } from '@colophony/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockDelete = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockOnConflictDoUpdate = vi.fn();

vi.mock('@colophony/db', () => ({
  emailTemplates: {
    id: 'id',
    organizationId: 'organization_id',
    templateName: 'template_name',
    subjectTemplate: 'subject_template',
    bodyHtml: 'body_html',
    isActive: 'is_active',
  },
  eq: vi.fn((_col: unknown, val: unknown) => val),
  and: vi.fn((...args: unknown[]) => args),
}));

import {
  emailTemplateService,
  EmailTemplateNotFoundError,
  InvalidMergeFieldError,
  InvalidTemplateSyntaxError,
  sanitizeTemplateHtml,
  validateMergeFields,
  validateSubjectMergeFields,
  interpolateMergeFields,
  interpolateMergeFieldsBody,
  interpolateBlockFields,
  renderDefaultArrayBlock,
} from './email-template.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTx() {
  mockReturning.mockReturnValue([]);
  mockOnConflictDoUpdate.mockReturnValue({ returning: mockReturning });
  mockValues.mockReturnValue({
    onConflictDoUpdate: mockOnConflictDoUpdate,
  });
  mockInsert.mockReturnValue({ values: mockValues });
  mockLimit.mockReturnValue([]);
  mockWhere.mockReturnValue({ limit: mockLimit });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockSelect.mockReturnValue({ from: mockFrom });
  mockDelete.mockReturnValue({
    where: vi.fn().mockReturnValue({ returning: mockReturning }),
  });

  return {
    insert: mockInsert,
    select: mockSelect,
    delete: mockDelete,
  } as unknown as Parameters<typeof emailTemplateService.list>[0];
}

function makeCtx(roles: string[] = ['ADMIN']) {
  const tx = makeTx();
  return {
    tx,
    actor: { userId: 'user-1', orgId: 'org-1', roles },
    audit: vi.fn(),
  } as unknown as Parameters<typeof emailTemplateService.upsertWithAudit>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe('sanitizeTemplateHtml', () => {
  it('strips disallowed tags', () => {
    const result = sanitizeTemplateHtml(
      '<p>Hello</p><script>alert(1)</script>',
    );
    expect(result).toBe('<p>Hello</p>');
  });

  it('allows safe formatting tags', () => {
    const html = '<p><strong>Bold</strong> and <em>italic</em></p>';
    expect(sanitizeTemplateHtml(html)).toBe(html);
  });
});

describe('validateMergeFields', () => {
  it('allows valid merge fields', () => {
    expect(() =>
      validateMergeFields(
        '{{submissionTitle}} by {{submitterName}}',
        'submission-received',
      ),
    ).not.toThrow();
  });

  it('rejects invalid merge field in subject', () => {
    expect(() =>
      validateMergeFields('{{invalidField}}', 'submission-received'),
    ).toThrow(InvalidMergeFieldError);
  });

  it('rejects invalid merge field in body', () => {
    expect(() =>
      validateMergeFields('<p>{{badField}}</p>', 'submission-accepted'),
    ).toThrow(InvalidMergeFieldError);
  });

  it('allows {{readerFeedback}} for submission-rejected', () => {
    expect(() =>
      validateMergeFields('{{readerFeedback}}', 'submission-rejected'),
    ).not.toThrow();
  });

  it('allows {{#each readerFeedback}} block for submission-rejected', () => {
    expect(() =>
      validateMergeFields(
        '{{#each readerFeedback}}{{this.comment}}{{/each}}',
        'submission-rejected',
      ),
    ).not.toThrow();
  });

  it('rejects {{#each}} with invalid field name', () => {
    expect(() =>
      validateMergeFields(
        '{{#each invalidField}}{{this.x}}{{/each}}',
        'submission-rejected',
      ),
    ).toThrow(InvalidMergeFieldError);
  });

  it('rejects {{readerFeedback}} for templates that do not allow it', () => {
    expect(() =>
      validateMergeFields('{{readerFeedback}}', 'submission-received'),
    ).toThrow(InvalidMergeFieldError);
  });

  it('rejects unclosed {{#each}} blocks', () => {
    expect(() =>
      validateMergeFields(
        '{{#each readerFeedback}}<p>{{this.comment}}</p>',
        'submission-rejected',
      ),
    ).toThrow(InvalidTemplateSyntaxError);
  });

  it('rejects mismatched {{#each}} and {{/each}} counts', () => {
    expect(() =>
      validateMergeFields(
        '{{#each readerFeedback}}{{#each readerFeedback}}{{/each}}',
        'submission-rejected',
      ),
    ).toThrow(InvalidTemplateSyntaxError);
  });
});

describe('validateSubjectMergeFields', () => {
  it('allows scalar merge fields in subject', () => {
    expect(() =>
      validateSubjectMergeFields(
        '{{submissionTitle}} — {{orgName}}',
        'submission-rejected',
      ),
    ).not.toThrow();
  });

  it('rejects {{#each}} blocks in subject', () => {
    expect(() =>
      validateSubjectMergeFields(
        '{{#each readerFeedback}}{{this.comment}}{{/each}}',
        'submission-rejected',
      ),
    ).toThrow(InvalidTemplateSyntaxError);
  });
});

describe('interpolateMergeFields', () => {
  it('replaces merge fields with values', () => {
    const result = interpolateMergeFields(
      'Hello {{name}}, welcome to {{org}}',
      {
        name: 'Alice',
        org: 'Acme',
      },
    );
    expect(result).toBe('Hello Alice, welcome to Acme');
  });

  it('replaces missing fields with empty string', () => {
    const result = interpolateMergeFields('Hello {{name}}', {});
    expect(result).toBe('Hello ');
  });

  it('replaces array fields with empty string (scalar-only)', () => {
    const result = interpolateMergeFields('Feedback: {{readerFeedback}}', {
      readerFeedback: [{ tags: ['good'], comment: 'Nice' }],
    });
    expect(result).toBe('Feedback: ');
  });
});

describe('interpolateBlockFields', () => {
  const feedback = [
    { tags: ['compelling voice', 'strong imagery'], comment: 'Great prose.' },
    { tags: ['needs revision'], comment: null },
  ];

  it('expands {{#each}} blocks with item data', () => {
    const result = interpolateBlockFields(
      '{{#each items}}<li>{{this.tags}} - {{this.comment}}</li>{{/each}}',
      { items: feedback },
    );
    expect(result).toContain('compelling voice, strong imagery - Great prose.');
    expect(result).toContain('needs revision - ');
  });

  it('renders nothing for empty array', () => {
    const result = interpolateBlockFields('{{#each items}}X{{/each}}', {
      items: [],
    });
    expect(result).toBe('');
  });

  it('renders nothing for missing field', () => {
    const result = interpolateBlockFields('{{#each items}}X{{/each}}', {});
    expect(result).toBe('');
  });

  it('auto-joins array-of-primitives with commas', () => {
    const result = interpolateBlockFields(
      '{{#each items}}[{{this.tags}}]{{/each}}',
      { items: [{ tags: ['a', 'b', 'c'] }] },
    );
    expect(result).toBe('[a, b, c]');
  });

  it('escapes HTML in {{this.comment}} to prevent XSS', () => {
    const result = interpolateBlockFields(
      '{{#each items}}{{this.comment}}{{/each}}',
      { items: [{ comment: '<script>alert(1)</script>' }] },
    );
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('escapes HTML in {{this.tags}} to prevent XSS', () => {
    const result = interpolateBlockFields(
      '{{#each items}}{{this.tags}}{{/each}}',
      { items: [{ tags: ['<img onerror=alert(1)>'] }] },
    );
    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;img');
  });
});

describe('renderDefaultArrayBlock', () => {
  it('renders reader feedback with tags and comments', () => {
    const result = renderDefaultArrayBlock(
      [
        { tags: ['voice', 'imagery'], comment: 'Nice work.' },
        { tags: ['pacing'], comment: null },
      ],
      'readerFeedback',
    );
    expect(result).toContain('voice, imagery');
    expect(result).toContain('Nice work.');
    expect(result).toContain('pacing');
    expect(result).toContain('border-left');
  });

  it('escapes HTML in feedback values', () => {
    const result = renderDefaultArrayBlock(
      [{ tags: ['<b>bold</b>'], comment: '<script>xss</script>' }],
      'readerFeedback',
    );
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('<b>bold</b>');
    expect(result).toContain('&lt;b&gt;');
  });
});

describe('interpolateMergeFieldsBody', () => {
  const feedback = [{ tags: ['voice'], comment: 'Great work.' }];

  it('renders {{readerFeedback}} scalar tag as default block', () => {
    const result = interpolateMergeFieldsBody(
      '<p>Feedback:</p>{{readerFeedback}}',
      { readerFeedback: feedback },
    );
    expect(result).toContain('voice');
    expect(result).toContain('Great work.');
    expect(result).toContain('border-left');
  });

  it('renders {{#each}} blocks with custom layout', () => {
    const result = interpolateMergeFieldsBody(
      '{{#each readerFeedback}}<div>{{this.comment}}</div>{{/each}}',
      { readerFeedback: feedback },
    );
    expect(result).toContain('<div>Great work.</div>');
  });

  it('renders empty string for empty array', () => {
    const result = interpolateMergeFieldsBody('Feedback: {{readerFeedback}}', {
      readerFeedback: [],
    });
    expect(result).toBe('Feedback: ');
  });

  it('handles mixed scalar and block fields', () => {
    const result = interpolateMergeFieldsBody(
      'Hi {{name}}, {{#each items}}<li>{{this.comment}}</li>{{/each}}',
      { name: 'Alice', items: [{ comment: 'Nice' }] },
    );
    expect(result).toContain('Hi Alice,');
    expect(result).toContain('<li>Nice</li>');
  });

  it('does not break existing scalar interpolation', () => {
    const result = interpolateMergeFieldsBody(
      'Hello {{name}}, welcome to {{org}}',
      { name: 'Alice', org: 'Acme' },
    );
    expect(result).toBe('Hello Alice, welcome to Acme');
  });
});

// ---------------------------------------------------------------------------
// Service method tests
// ---------------------------------------------------------------------------

describe('emailTemplateService', () => {
  describe('list', () => {
    it('returns customized template names', async () => {
      const tx = makeTx();
      const rows = [
        { id: 't1', templateName: 'submission-received' },
        { id: 't2', templateName: 'submission-accepted' },
      ];
      mockWhere.mockReturnValue(rows);

      const result = await emailTemplateService.list(tx);
      expect(result).toEqual(rows);
    });
  });

  describe('getByName', () => {
    it('returns template when exists', async () => {
      const tx = makeTx();
      const row = {
        id: 't1',
        templateName: 'submission-received',
        subjectTemplate: 'New: {{submissionTitle}}',
        bodyHtml: '<p>Received</p>',
      };
      mockLimit.mockReturnValue([row]);

      const result = await emailTemplateService.getByName(
        tx,
        'submission-received',
      );
      expect(result).toEqual(row);
    });

    it('returns null when no override', async () => {
      const tx = makeTx();
      mockLimit.mockReturnValue([]);

      const result = await emailTemplateService.getByName(
        tx,
        'submission-received',
      );
      expect(result).toBeNull();
    });
  });

  describe('getActiveTemplate', () => {
    it('returns subjectTemplate and bodyHtml', async () => {
      const tx = makeTx();
      const row = {
        subjectTemplate: 'Subject: {{submissionTitle}}',
        bodyHtml: '<p>Body</p>',
      };
      mockLimit.mockReturnValue([row]);

      const result = await emailTemplateService.getActiveTemplate(
        tx,
        'submission-received',
      );
      expect(result).toEqual(row);
    });

    it('returns null when no override', async () => {
      const tx = makeTx();
      mockLimit.mockReturnValue([]);

      const result = await emailTemplateService.getActiveTemplate(
        tx,
        'submission-received',
      );
      expect(result).toBeNull();
    });
  });

  describe('upsert', () => {
    it('sanitizes HTML body', async () => {
      const tx = makeTx();
      const row = {
        id: 't1',
        templateName: 'submission-received',
        subjectTemplate: 'New: {{submissionTitle}}',
        bodyHtml: '<p>Received</p>',
      };
      mockReturning.mockReturnValue([row]);

      await emailTemplateService.upsert(tx, 'org-1', {
        templateName: 'submission-received',
        subjectTemplate: 'New: {{submissionTitle}}',
        bodyHtml: '<p>Received</p><script>alert(1)</script>',
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          bodyHtml: '<p>Received</p>',
        }),
      );
    });

    it('rejects invalid merge field in subject', async () => {
      const tx = makeTx();

      await expect(
        emailTemplateService.upsert(tx, 'org-1', {
          templateName: 'submission-received',
          subjectTemplate: '{{invalidField}}',
          bodyHtml: '<p>Body</p>',
        }),
      ).rejects.toThrow(InvalidMergeFieldError);
    });

    it('rejects invalid merge field in body', async () => {
      const tx = makeTx();

      await expect(
        emailTemplateService.upsert(tx, 'org-1', {
          templateName: 'submission-received',
          subjectTemplate: 'Subject',
          bodyHtml: '<p>{{badField}}</p>',
        }),
      ).rejects.toThrow(InvalidMergeFieldError);
    });

    it('allows valid merge fields', async () => {
      const tx = makeTx();
      const row = {
        id: 't1',
        templateName: 'submission-received',
        subjectTemplate: '{{submissionTitle}} {{orgName}}',
        bodyHtml: '<p>By {{submitterName}}</p>',
      };
      mockReturning.mockReturnValue([row]);

      await expect(
        emailTemplateService.upsert(tx, 'org-1', {
          templateName: 'submission-received',
          subjectTemplate: '{{submissionTitle}} {{orgName}}',
          bodyHtml: '<p>By {{submitterName}}</p>',
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('upsertWithAudit', () => {
    it('logs CREATED for new template', async () => {
      const ctx = makeCtx();
      // getByName returns null (no existing)
      mockLimit.mockReturnValue([]);
      const newRow = {
        id: 't1',
        templateName: 'submission-received',
        subjectTemplate: 'Subject',
        bodyHtml: '<p>Body</p>',
      };
      mockReturning.mockReturnValue([newRow]);

      await emailTemplateService.upsertWithAudit(ctx, {
        templateName: 'submission-received',
        subjectTemplate: 'Subject',
        bodyHtml: '<p>Body</p>',
      });

      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: AuditResources.EMAIL_TEMPLATE,
          action: AuditActions.EMAIL_TEMPLATE_CREATED,
          resourceId: 't1',
        }),
      );
    });

    it('logs UPDATED for existing template', async () => {
      const ctx = makeCtx();
      // getByName returns existing row
      const existing = {
        id: 't1',
        templateName: 'submission-received',
        subjectTemplate: 'Old Subject',
        bodyHtml: '<p>Old</p>',
      };
      mockLimit.mockReturnValueOnce([existing]);
      mockReturning.mockReturnValue([{ ...existing, subjectTemplate: 'New' }]);

      await emailTemplateService.upsertWithAudit(ctx, {
        templateName: 'submission-received',
        subjectTemplate: 'New',
        bodyHtml: '<p>Old</p>',
      });

      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: AuditResources.EMAIL_TEMPLATE,
          action: AuditActions.EMAIL_TEMPLATE_UPDATED,
          resourceId: 't1',
        }),
      );
    });
  });

  describe('deleteWithAudit', () => {
    it('throws EmailTemplateNotFoundError when not found', async () => {
      const ctx = makeCtx();
      mockReturning.mockReturnValue([]);

      await expect(
        emailTemplateService.deleteWithAudit(ctx, 'submission-received'),
      ).rejects.toThrow(EmailTemplateNotFoundError);
    });

    it('deletes and logs audit', async () => {
      const ctx = makeCtx();
      const row = {
        id: 't1',
        templateName: 'submission-received',
      };
      // delete mock returns the row
      const deleteWhere = vi
        .fn()
        .mockReturnValue({ returning: vi.fn().mockReturnValue([row]) });
      (ctx.tx as unknown as Record<string, unknown>).delete = vi
        .fn()
        .mockReturnValue({ where: deleteWhere });

      const result = await emailTemplateService.deleteWithAudit(
        ctx,
        'submission-received',
      );

      expect(result).toEqual(row);
      // Verify defense-in-depth: WHERE uses both orgId and templateName
      const { and: mockAnd } = await import('@colophony/db');
      expect(mockAnd).toHaveBeenCalled();
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: AuditResources.EMAIL_TEMPLATE,
          action: AuditActions.EMAIL_TEMPLATE_DELETED,
          resourceId: 't1',
        }),
      );
    });
  });
});
