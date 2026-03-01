import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
  };
  return { mockDb };
});

vi.mock('@colophony/db', () => ({
  db: mockDb,
  submissions: {
    id: 'submissions.id',
    submitterId: 'submissions.submitterId',
    title: 'submissions.title',
    coverLetter: 'submissions.coverLetter',
    status: 'submissions.status',
    formData: 'submissions.formData',
    submittedAt: 'submissions.submittedAt',
    organizationId: 'submissions.organizationId',
    manuscriptVersionId: 'submissions.manuscriptVersionId',
    submissionPeriodId: 'submissions.submissionPeriodId',
  },
  manuscriptVersions: {
    id: 'manuscriptVersions.id',
    manuscriptId: 'manuscriptVersions.manuscriptId',
  },
  manuscripts: {
    id: 'manuscripts.id',
    title: 'manuscripts.title',
    genre: 'manuscripts.genre',
    ownerId: 'manuscripts.ownerId',
    createdAt: 'manuscripts.createdAt',
  },
  organizations: { id: 'organizations.id', name: 'organizations.name' },
  submissionPeriods: {
    id: 'submissionPeriods.id',
    name: 'submissionPeriods.name',
  },
  submissionHistory: {
    submissionId: 'submissionHistory.submissionId',
    fromStatus: 'submissionHistory.fromStatus',
    toStatus: 'submissionHistory.toStatus',
    changedAt: 'submissionHistory.changedAt',
    comment: 'submissionHistory.comment',
  },
  externalSubmissions: {
    id: 'externalSubmissions.id',
    userId: 'externalSubmissions.userId',
  },
  correspondence: {
    userId: 'correspondence.userId',
  },
  writerProfiles: {
    userId: 'writerProfiles.userId',
  },
  users: { id: 'users.id', email: 'users.email' },
  eq: vi.fn(),
  inArray: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import type { DrizzleDb } from '@colophony/db';
import { csrService, CSRImportError } from './csr.service.js';

const validUuid = '00000000-0000-4000-a000-000000000001';
const validUuid2 = '00000000-0000-4000-a000-000000000002';

describe('csrService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('assembleExport', () => {
    it('returns empty envelope when user has no data', async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        return mockDb;
      });

      mockDb.where.mockImplementation(() => {
        if (selectCallCount === 1) {
          // User lookup
          return [{ id: validUuid, email: 'writer@test.com' }];
        }
        // All other queries return empty
        return [];
      });

      const envelope = await csrService.assembleExport({
        userId: validUuid,
      });

      expect(envelope.version).toBe('1.0');
      expect(envelope.exportedAt).toBeDefined();
      expect(envelope.identity.userId).toBe(validUuid);
      expect(envelope.identity.email).toBe('writer@test.com');
      expect(envelope.identity.displayName).toBeNull();
      expect(envelope.nativeSubmissions).toEqual([]);
      expect(envelope.externalSubmissions).toEqual([]);
      expect(envelope.correspondence).toEqual([]);
      expect(envelope.writerProfiles).toEqual([]);
      expect(envelope.manuscripts).toEqual([]);
    });

    it('includes native submissions with org/period/genre enrichment', async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        return mockDb;
      });

      const mvId = '00000000-0000-4000-a000-000000000010';
      const periodId = '00000000-0000-4000-a000-000000000030';

      mockDb.where.mockImplementation(() => {
        if (selectCallCount === 1) {
          // User
          return [{ id: validUuid, email: 'writer@test.com' }];
        }
        if (selectCallCount === 2) {
          // Submissions
          return [
            {
              id: validUuid,
              title: 'Rejected Poem',
              coverLetter: 'Dear editor',
              status: 'REJECTED',
              formData: null,
              submittedAt: new Date('2025-01-01'),
              organizationId: validUuid2,
              manuscriptVersionId: mvId,
              submissionPeriodId: periodId,
            },
            {
              id: validUuid2,
              title: 'Submitted Story',
              coverLetter: null,
              status: 'SUBMITTED',
              formData: null,
              submittedAt: new Date('2025-02-01'),
              organizationId: validUuid2,
              manuscriptVersionId: null,
              submissionPeriodId: null,
            },
          ];
        }
        if (selectCallCount === 3) {
          // Orgs
          return [{ id: validUuid2, name: 'Test Magazine' }];
        }
        if (selectCallCount === 4) {
          // Periods
          return [{ id: periodId, name: 'Spring 2025' }];
        }
        if (selectCallCount === 5) {
          // Genre JOIN
          return [
            {
              versionId: mvId,
              genre: { primary: 'poetry', sub: 'lyric', hybrid: [] },
            },
          ];
        }
        if (selectCallCount === 6) {
          // History
          return [
            {
              submissionId: validUuid,
              fromStatus: 'SUBMITTED',
              toStatus: 'REJECTED',
              changedAt: new Date('2025-03-01T10:00:00Z'),
              comment: 'Not a fit',
            },
          ];
        }
        // External, correspondence, profiles, manuscripts — empty
        return [];
      });

      const envelope = await csrService.assembleExport({
        userId: validUuid,
      });

      expect(envelope.nativeSubmissions).toHaveLength(2);

      const rejected = envelope.nativeSubmissions[0];
      expect(rejected.publicationName).toBe('Test Magazine');
      expect(rejected.periodName).toBe('Spring 2025');
      expect(rejected.genre).toEqual({
        primary: 'poetry',
        sub: 'lyric',
        hybrid: [],
      });
      expect(rejected.decidedAt).toBe('2025-03-01T10:00:00.000Z');
      expect(rejected.status).toBe('rejected');

      const submitted = envelope.nativeSubmissions[1];
      expect(submitted.publicationName).toBe('Test Magazine');
      expect(submitted.status).toBe('sent');
    });

    it('includes external submissions, correspondence, profiles, manuscripts', async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        return mockDb;
      });

      mockDb.where.mockImplementation(() => {
        if (selectCallCount === 1) {
          return [{ id: validUuid, email: 'writer@test.com' }];
        }
        if (selectCallCount === 2) {
          // Native submissions — empty
          return [];
        }
        if (selectCallCount === 3) {
          // External submissions
          return [
            {
              id: validUuid,
              manuscriptId: null,
              journalDirectoryId: null,
              journalName: 'Poetry Daily',
              status: 'sent',
              sentAt: new Date('2025-04-01'),
              respondedAt: null,
              method: 'email',
              notes: null,
              importedFrom: 'csv',
              createdAt: new Date('2025-04-01'),
              updatedAt: new Date('2025-04-01'),
            },
          ];
        }
        if (selectCallCount === 4) {
          // Correspondence
          return [
            {
              id: validUuid2,
              submissionId: null,
              externalSubmissionId: validUuid,
              direction: 'outbound',
              channel: 'email',
              sentAt: new Date('2025-04-02'),
              subject: 'Submission',
              body: 'Dear editors...',
              senderName: 'Writer',
              senderEmail: 'writer@test.com',
              isPersonalized: false,
              source: 'manual',
              capturedAt: new Date('2025-04-02'),
            },
          ];
        }
        if (selectCallCount === 5) {
          // Writer profiles
          return [
            {
              id: validUuid,
              platform: 'submittable',
              externalId: 'user123',
              profileUrl: null,
            },
          ];
        }
        if (selectCallCount === 6) {
          // Manuscripts
          return [
            {
              id: validUuid,
              title: 'My Poems',
              genre: { primary: 'poetry', sub: null, hybrid: [] },
              createdAt: new Date('2025-01-01'),
            },
          ];
        }
        return [];
      });

      const envelope = await csrService.assembleExport({
        userId: validUuid,
      });

      expect(envelope.externalSubmissions).toHaveLength(1);
      expect(envelope.externalSubmissions[0].journalName).toBe('Poetry Daily');
      expect(envelope.correspondence).toHaveLength(1);
      expect(envelope.correspondence[0].body).toBe('Dear editors...');
      expect(envelope.writerProfiles).toHaveLength(1);
      expect(envelope.writerProfiles[0].platform).toBe('submittable');
      expect(envelope.manuscripts).toHaveLength(1);
      expect(envelope.manuscripts[0].title).toBe('My Poems');
    });

    it('respects MAX_NATIVE_SUBMISSIONS cap', async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        return mockDb;
      });

      mockDb.where.mockImplementation(() => {
        if (selectCallCount === 1) {
          return [{ id: validUuid, email: 'writer@test.com' }];
        }
        return [];
      });

      await csrService.assembleExport({ userId: validUuid });

      // Should call .limit(10000) on native submissions query
      expect(mockDb.limit).toHaveBeenCalledWith(10_000);
    });

    it('handles null genre gracefully', async () => {
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        return mockDb;
      });

      mockDb.where.mockImplementation(() => {
        if (selectCallCount === 1) {
          return [{ id: validUuid, email: 'writer@test.com' }];
        }
        if (selectCallCount === 2) return []; // Native submissions
        if (selectCallCount === 3) return []; // External submissions
        if (selectCallCount === 4) return []; // Correspondence
        if (selectCallCount === 5) return []; // Writer profiles
        if (selectCallCount === 6) {
          // Manuscripts — null genre
          return [
            {
              id: validUuid,
              title: 'Untitled',
              genre: null,
              createdAt: new Date('2025-01-01'),
            },
          ];
        }
        return [];
      });

      const envelope = await csrService.assembleExport({
        userId: validUuid,
      });

      expect(envelope.manuscripts[0].genre).toBeNull();
    });
  });

  describe('importRecords', () => {
    // Use a separate mock tx for imports
    const mockTx = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn(),
    };

    beforeEach(() => {
      mockTx.insert.mockReturnThis();
      mockTx.values.mockReturnThis();
      mockTx.returning.mockResolvedValue([]);
    });

    it('creates external submissions with importedFrom tag', async () => {
      mockTx.returning.mockResolvedValue([
        { id: 'new-1' },
        { id: 'new-2' },
        { id: 'new-3' },
      ]);

      const result = await csrService.importRecords(
        mockTx as unknown as DrizzleDb,
        {
          userId: validUuid,
          input: {
            submissions: [
              { journalName: 'Journal A', status: 'sent' },
              { journalName: 'Journal B', status: 'rejected' },
              { journalName: 'Journal C', status: 'accepted' },
            ],
            correspondence: [],
            importedFrom: 'duotrope_export',
          },
        },
      );

      expect(result.submissionsCreated).toBe(3);
      expect(result.correspondenceCreated).toBe(0);
      expect(mockTx.insert).toHaveBeenCalledTimes(1);
      expect(mockTx.values).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            userId: validUuid,
            journalName: 'Journal A',
            importedFrom: 'duotrope_export',
          }),
        ]),
      );
    });

    it('creates correspondence linked to new submissions', async () => {
      mockTx.returning.mockResolvedValueOnce([
        { id: 'new-sub-1' },
        { id: 'new-sub-2' },
      ]);

      const result = await csrService.importRecords(
        mockTx as unknown as DrizzleDb,
        {
          userId: validUuid,
          input: {
            submissions: [
              { journalName: 'Journal A', status: 'sent' },
              { journalName: 'Journal B', status: 'sent' },
            ],
            correspondence: [
              {
                externalSubmissionIndex: 0,
                direction: 'outbound' as const,
                channel: 'email' as const,
                sentAt: '2025-04-01T00:00:00Z',
                body: 'Dear editors...',
                isPersonalized: false,
              },
            ],
            importedFrom: 'csr_import',
          },
        },
      );

      expect(result.submissionsCreated).toBe(2);
      expect(result.correspondenceCreated).toBe(1);
      // Second insert call is for correspondence
      expect(mockTx.insert).toHaveBeenCalledTimes(2);
      expect(mockTx.values).toHaveBeenLastCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            userId: validUuid,
            externalSubmissionId: 'new-sub-1',
            body: 'Dear editors...',
            source: 'manual',
          }),
        ]),
      );
    });

    it('throws CSRImportError on invalid externalSubmissionIndex', async () => {
      mockTx.returning.mockResolvedValueOnce([
        { id: 'new-sub-1' },
        { id: 'new-sub-2' },
      ]);

      await expect(
        csrService.importRecords(mockTx as unknown as DrizzleDb, {
          userId: validUuid,
          input: {
            submissions: [
              { journalName: 'Journal A', status: 'sent' },
              { journalName: 'Journal B', status: 'sent' },
            ],
            correspondence: [
              {
                externalSubmissionIndex: 5,
                direction: 'outbound' as const,
                channel: 'email' as const,
                sentAt: '2025-04-01T00:00:00Z',
                body: 'Dear editors...',
                isPersonalized: false,
              },
            ],
            importedFrom: 'csr_import',
          },
        }),
      ).rejects.toThrow(CSRImportError);
    });

    it('handles empty correspondence array', async () => {
      mockTx.returning.mockResolvedValueOnce([{ id: 'new-1' }]);

      const result = await csrService.importRecords(
        mockTx as unknown as DrizzleDb,
        {
          userId: validUuid,
          input: {
            submissions: [{ journalName: 'Journal A', status: 'sent' }],
            correspondence: [],
            importedFrom: 'csr_import',
          },
        },
      );

      expect(result.submissionsCreated).toBe(1);
      expect(result.correspondenceCreated).toBe(0);
      // Only one insert call (submissions)
      expect(mockTx.insert).toHaveBeenCalledTimes(1);
    });
  });
});
