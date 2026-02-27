import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditActions, AuditResources } from '@colophony/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockOrderBy = vi.fn();

vi.mock('@colophony/db', () => ({
  correspondence: { submissionId: 'submission_id', sentAt: 'sent_at' },
  submissions: { id: 'id' },
  users: { id: 'id', email: 'email', displayName: 'display_name' },
  organizations: { id: 'id', name: 'name' },
  eq: vi.fn((_col: unknown, val: unknown) => val),
  desc: vi.fn(),
}));

vi.mock('./submission.service.js', () => ({
  submissionService: {
    getById: vi.fn(),
  },
}));

vi.mock('./email.service.js', () => ({
  emailService: {
    create: vi.fn(),
  },
}));

vi.mock('../queues/email.queue.js', () => ({
  enqueueEmail: vi.fn(),
}));

vi.mock('../config/env.js', () => ({
  validateEnv: vi.fn(() => ({
    EMAIL_PROVIDER: 'smtp',
    SMTP_FROM: 'noreply@test.com',
  })),
}));

import { correspondenceService } from './correspondence.service.js';
import { submissionService } from './submission.service.js';
import { emailService } from './email.service.js';
import { enqueueEmail } from '../queues/email.queue.js';
import { ForbiddenError, NotFoundError } from './errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTx() {
  mockReturning.mockReturnValue([
    {
      id: 'corr-1',
      userId: 'user-1',
      submissionId: 'sub-1',
      direction: 'outbound',
      channel: 'email',
      sentAt: new Date(),
      subject: 'Test',
      body: '<p>Hello</p>',
      senderName: 'Editor',
      senderEmail: 'editor@test.com',
      isPersonalized: true,
      source: 'colophony',
    },
  ]);
  mockValues.mockReturnValue({ returning: mockReturning });
  mockInsert.mockReturnValue({ values: mockValues });
  mockLimit.mockReturnValue([]);
  mockWhere.mockReturnValue({ limit: mockLimit, orderBy: mockOrderBy });
  mockOrderBy.mockReturnValue([]);
  mockFrom.mockReturnValue({ where: mockWhere });
  mockSelect.mockReturnValue({ from: mockFrom });

  return {
    insert: mockInsert,
    select: mockSelect,
  } as unknown as Parameters<typeof correspondenceService.create>[0];
}

function makeSvc(role = 'EDITOR') {
  const tx = makeTx();
  return {
    tx,
    actor: { userId: 'editor-1', orgId: 'org-1', role },
    audit: vi.fn(),
  } as unknown as Parameters<typeof correspondenceService.sendEditorMessage>[0];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('correspondenceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('inserts and returns row', async () => {
      const tx = makeTx();
      const result = await correspondenceService.create(tx, {
        userId: 'user-1',
        submissionId: 'sub-1',
        direction: 'outbound',
        channel: 'email',
        sentAt: new Date(),
        subject: 'Test',
        body: '<p>Hello</p>',
        senderName: 'Editor',
        senderEmail: 'editor@test.com',
        isPersonalized: true,
        source: 'colophony',
      });

      expect(mockInsert).toHaveBeenCalled();
      expect(result).toMatchObject({ id: 'corr-1' });
    });
  });

  describe('listBySubmission', () => {
    it('returns rows ordered by sentAt desc', async () => {
      const rows = [
        { id: 'c1', sentAt: new Date('2026-01-02') },
        { id: 'c2', sentAt: new Date('2026-01-01') },
      ];
      const svc = makeSvc('EDITOR');
      // Override the chain for list: select().from().where().orderBy()
      const localOrderBy = vi.fn().mockReturnValue(rows);
      const localWhere = vi.fn().mockReturnValue({ orderBy: localOrderBy });
      const localFrom = vi.fn().mockReturnValue({ where: localWhere });
      const localSelect = vi.fn().mockReturnValue({ from: localFrom });
      (svc.tx as unknown as Record<string, unknown>).select = localSelect;

      const result = await correspondenceService.listBySubmission(svc, 'sub-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('c1');
    });

    it('throws ForbiddenError for non-editor', async () => {
      const svc = makeSvc('READER');

      await expect(
        correspondenceService.listBySubmission(svc, 'sub-1'),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('sendEditorMessage', () => {
    function setupMocks() {
      vi.mocked(submissionService.getById).mockResolvedValue({
        id: 'sub-1',
        submitterId: 'writer-1',
        title: 'My Poem',
      } as Awaited<ReturnType<typeof submissionService.getById>>);

      // submitter lookup
      mockLimit
        .mockReturnValueOnce([
          { email: 'writer@test.com', displayName: 'Writer' },
        ])
        // editor lookup
        .mockReturnValueOnce([
          { email: 'editor@test.com', displayName: 'Editor' },
        ])
        // org lookup
        .mockReturnValueOnce([{ name: 'Test Mag' }]);

      vi.mocked(emailService.create).mockResolvedValue({
        id: 'email-1',
      } as Awaited<ReturnType<typeof emailService.create>>);
    }

    it('creates correspondence with correct fields', async () => {
      setupMocks();
      const svc = makeSvc();

      await correspondenceService.sendEditorMessage(svc, {
        submissionId: 'sub-1',
        subject: 'Re: My Poem',
        body: '<p>Thanks for submitting</p>',
      });

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'outbound',
          isPersonalized: true,
          source: 'colophony',
          channel: 'email',
        }),
      );
    });

    it('enqueues email with editor-message template', async () => {
      setupMocks();
      const svc = makeSvc();

      await correspondenceService.sendEditorMessage(svc, {
        submissionId: 'sub-1',
        subject: 'Re: My Poem',
        body: '<p>Thanks</p>',
      });

      expect(enqueueEmail).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          templateName: 'editor-message',
          replyTo: 'editor@test.com',
        }),
      );
    });

    it('audits CORRESPONDENCE_SENT', async () => {
      setupMocks();
      const svc = makeSvc();

      await correspondenceService.sendEditorMessage(svc, {
        submissionId: 'sub-1',
        subject: 'Re: My Poem',
        body: '<p>Thanks</p>',
      });

      expect(svc.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditActions.CORRESPONDENCE_SENT,
          resource: AuditResources.CORRESPONDENCE,
        }),
      );
    });

    it('throws NotFoundError for missing submission', async () => {
      vi.mocked(submissionService.getById).mockResolvedValue(null);
      const svc = makeSvc();

      await expect(
        correspondenceService.sendEditorMessage(svc, {
          submissionId: 'missing',
          subject: 'Test',
          body: 'Test',
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError for non-editor', async () => {
      const svc = makeSvc('READER');

      await expect(
        correspondenceService.sendEditorMessage(svc, {
          submissionId: 'sub-1',
          subject: 'Test',
          body: 'Test',
        }),
      ).rejects.toThrow(ForbiddenError);
    });
  });
});
