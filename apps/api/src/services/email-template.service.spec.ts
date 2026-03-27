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
  sanitizeTemplateHtml,
  validateMergeFields,
  interpolateMergeFields,
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
