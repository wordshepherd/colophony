import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

// ---------------------------------------------------------------------------
// Service mock
// ---------------------------------------------------------------------------

const { mockAssembleExport, mockImportRecords } = vi.hoisted(() => ({
  mockAssembleExport: vi.fn(),
  mockImportRecords: vi.fn(),
}));

vi.mock('../../services/csr.service.js', () => ({
  csrService: {
    assembleExport: mockAssembleExport,
    importRecords: mockImportRecords,
  },
  CSRImportError: class CSRImportError extends Error {
    override name = 'CSRImportError';
  },
  CSRExportError: class CSRExportError extends Error {
    override name = 'CSRExportError';
  },
}));

// Mock all other services that the appRouter imports
vi.mock('../../services/organization.service.js', () => ({
  organizationService: {},
  UserNotFoundError: class extends Error {},
  SlugTakenError: class extends Error {},
  LastAdminError: class extends Error {},
}));

vi.mock('../../services/submission.service.js', () => ({
  submissionService: {},
  SubmissionNotFoundError: class extends Error {},
  NotDraftError: class extends Error {},
  InvalidStatusTransitionError: class extends Error {},
  UnscannedFilesError: class extends Error {},
  InfectedFilesError: class extends Error {},
  FormDefinitionMismatchError: class extends Error {},
  MissingRevisionNotesError: class extends Error {},
  NotReviseAndResubmitError: class extends Error {},
}));

vi.mock('../../services/file.service.js', () => ({
  fileService: {},
  FileNotFoundError: class extends Error {},
  FileNotCleanError: class extends Error {},
}));

vi.mock('../../services/manuscript.service.js', () => ({
  manuscriptService: {},
  ManuscriptNotFoundError: class extends Error {},
  ManuscriptVersionNotFoundError: class extends Error {},
}));

vi.mock('../../services/form.service.js', () => ({
  formService: {},
  FormNotFoundError: class extends Error {},
  FormFieldNotFoundError: class extends Error {},
  FormPageNotFoundError: class extends Error {},
  FormNotDraftError: class extends Error {},
  FormNotPublishedError: class extends Error {},
  DuplicateFieldKeyError: class extends Error {},
  FormHasNoFieldsError: class extends Error {},
  FormInUseError: class extends Error {},
  InvalidFormDataError: class extends Error {},
  InvalidBranchReferenceError: class extends Error {},
}));

vi.mock('../../services/period.service.js', () => ({
  periodService: {},
  PeriodNotFoundError: class extends Error {},
  PeriodHasSubmissionsError: class extends Error {},
}));

vi.mock('../../services/publication.service.js', () => ({
  publicationService: {},
  PublicationNotFoundError: class extends Error {},
  PublicationSlugConflictError: class extends Error {},
}));

vi.mock('../../services/pipeline.service.js', () => ({
  pipelineService: {},
  PipelineItemNotFoundError: class extends Error {},
  PipelineItemAlreadyExistsError: class extends Error {},
  InvalidPipelineTransitionError: class extends Error {},
  SubmissionNotAcceptedError: class extends Error {},
}));

vi.mock('../../services/contract-template.service.js', () => ({
  contractTemplateService: {},
  ContractTemplateNotFoundError: class extends Error {},
}));

vi.mock('../../services/contract.service.js', () => ({
  contractService: {},
  ContractNotFoundError: class extends Error {},
}));

vi.mock('../../services/issue.service.js', () => ({
  issueService: {},
  IssueNotFoundError: class extends Error {},
  IssueItemAlreadyExistsError: class extends Error {},
}));

vi.mock('../../services/cms-connection.service.js', () => ({
  cmsConnectionService: {},
  CmsConnectionNotFoundError: class extends Error {},
}));

vi.mock('../../services/simsub.service.js', () => ({
  simSubService: {},
  SimSubConflictError: class extends Error {},
}));

vi.mock('../../services/transfer.service.js', () => ({
  transferService: {},
  TransferNotFoundError: class extends Error {},
  TransferInvalidStateError: class extends Error {},
  TransferCapabilityError: class extends Error {},
}));

vi.mock('../../services/migration.service.js', () => ({
  migrationService: {},
  MigrationNotFoundError: class extends Error {},
  MigrationInvalidStateError: class extends Error {},
  MigrationCapabilityError: class extends Error {},
  MigrationAlreadyActiveError: class extends Error {},
  MigrationUserNotFoundError: class extends Error {},
}));

vi.mock('../../services/email-template.service.js', () => ({
  emailTemplateService: {},
  EmailTemplateNotFoundError: class extends Error {},
  InvalidMergeFieldError: class extends Error {},
}));

vi.mock('../../services/submission-reviewer.service.js', () => ({
  submissionReviewerService: {},
  ReviewerAlreadyAssignedError: class extends Error {},
  ReviewerNotAssignedError: class extends Error {},
  ReviewerNotOrgMemberError: class extends Error {},
}));

vi.mock('../../services/submission-discussion.service.js', () => ({
  submissionDiscussionService: {},
  DiscussionCommentNotFoundError: class extends Error {},
  DiscussionParentNotFoundError: class extends Error {},
}));

vi.mock('../../services/submission-vote.service.js', () => ({
  submissionVoteService: {},
  VoteNotFoundError: class extends Error {},
  VotingDisabledError: class extends Error {},
  VoteOnTerminalSubmissionError: class extends Error {},
  ScoreOutOfRangeError: class extends Error {},
}));

vi.mock('../../services/queue-preset.service.js', () => ({
  queuePresetService: {},
  PresetLimitExceededError: class extends Error {},
  PresetNotFoundError: class extends Error {},
}));

vi.mock('../../services/gdpr.service.js', () => ({
  gdprService: {},
  UserNotDeletableError: class extends Error {},
  OrgNotDeletableError: class extends Error {},
}));

vi.mock('../../services/context.js', () => ({
  toUserServiceContext: vi.fn((ctx: unknown) => ctx),
  toOrgServiceContext: vi.fn((ctx: unknown) => ctx),
}));

vi.mock('../../config/env.js', () => ({
  validateEnv: () => ({
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: '',
  }),
}));

vi.mock('@colophony/db', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  db: { query: {} },
  organizations: {},
  organizationMembers: {},
  users: {},
  auditEvents: {},
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { appRouter } from '../router.js';
import type { TRPCContext } from '../context.js';

const USER_ID = '00000000-0000-4000-a000-000000000001';

function userContext(): TRPCContext {
  return {
    authContext: {
      userId: USER_ID,
      zitadelUserId: '00000000-0000-4000-a000-000000000099',
      email: 'test@example.com',
      emailVerified: true,
      authMethod: 'test',
    },
    dbTx: {} as TRPCContext['dbTx'],
    audit: vi.fn(),
  };
}

function unauthContext(): TRPCContext {
  return {
    authContext: null,
    dbTx: null,
    audit: vi.fn(),
  };
}

const createCaller = (appRouter as any).createCaller as (
  ctx: TRPCContext,
) => any;

describe('csr tRPC router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('csr.export', () => {
    it('returns CSR envelope and audits', async () => {
      const mockEnvelope = {
        version: '1.0',
        exportedAt: '2025-06-01T00:00:00.000Z',
        identity: {
          userId: USER_ID,
          email: 'test@example.com',
          displayName: null,
        },
        nativeSubmissions: [],
        externalSubmissions: [],
        correspondence: [],
        writerProfiles: [],
        manuscripts: [],
      };
      mockAssembleExport.mockResolvedValueOnce(mockEnvelope);

      const ctx = userContext();
      const caller = createCaller(ctx);
      const result = await caller.csr.export();

      expect(result.version).toBe('1.0');
      expect(result.identity.userId).toBe(USER_ID);
      expect(mockAssembleExport).toHaveBeenCalledWith({ userId: USER_ID });
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CSR_EXPORTED',
          resource: 'csr',
        }),
      );
    });

    it('requires authentication', async () => {
      const caller = createCaller(unauthContext());
      await expect(caller.csr.export()).rejects.toThrow(TRPCError);
    });
  });

  describe('csr.import', () => {
    it('creates records and audits', async () => {
      mockImportRecords.mockResolvedValueOnce({
        submissionsCreated: 3,
        correspondenceCreated: 1,
      });

      const ctx = userContext();
      const caller = createCaller(ctx);
      const result = await caller.csr.import({
        submissions: [
          { journalName: 'Journal A', status: 'sent' },
          { journalName: 'Journal B', status: 'rejected' },
          { journalName: 'Journal C', status: 'accepted' },
        ],
        correspondence: [],
        importedFrom: 'test_import',
      });

      expect(result.submissionsCreated).toBe(3);
      expect(result.correspondenceCreated).toBe(1);
      expect(mockImportRecords).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ userId: USER_ID }),
      );
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CSR_IMPORTED',
          resource: 'csr',
        }),
      );
    });

    it('maps CSRImportError to BAD_REQUEST', async () => {
      // Import the mocked error class
      const { CSRImportError } = await import('../../services/csr.service.js');
      mockImportRecords.mockRejectedValueOnce(
        new CSRImportError('Invalid index'),
      );

      const caller = createCaller(userContext());
      await expect(
        caller.csr.import({
          submissions: [{ journalName: 'Journal A', status: 'sent' }],
          correspondence: [],
          importedFrom: 'test',
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'BAD_REQUEST',
        }),
      );
    });
  });
});
