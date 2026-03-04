import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// Mock dependencies
const mockIssueServiceGetById = vi.fn();
const mockIssueServiceGetSections = vi.fn();
const mockIssueServiceGetItems = vi.fn();
const mockSaveCmsPublishResult = vi.fn();
vi.mock('../../services/issue.service.js', () => ({
  issueService: {
    getById: (...args: unknown[]) => mockIssueServiceGetById(...args),
    getSections: (...args: unknown[]) => mockIssueServiceGetSections(...args),
    getItems: (...args: unknown[]) => mockIssueServiceGetItems(...args),
    saveCmsPublishResult: (...args: unknown[]) =>
      mockSaveCmsPublishResult(...args),
  },
}));

const mockListByPublication = vi.fn();
const mockUpdateLastSync = vi.fn();
vi.mock('../../services/cms-connection.service.js', () => ({
  cmsConnectionService: {
    listByPublication: (...args: unknown[]) => mockListByPublication(...args),
    updateLastSync: (...args: unknown[]) => mockUpdateLastSync(...args),
  },
}));

const mockPublishIssue = vi.fn();
vi.mock('../../adapters/cms/index.js', () => ({
  getCmsAdapter: () => ({
    publishIssue: (...args: unknown[]) => mockPublishIssue(...args),
  }),
}));

// Mock withRls to pass through
vi.mock('@colophony/db', () => ({
  withRls: vi.fn((_ctx: unknown, fn: (tx: string) => unknown) => fn('mock-tx')),
  pipelineItems: { id: 'id', submissionId: 'submission_id' },
  submissions: {
    id: 'id',
    title: 'title',
    content: 'content',
    submitterId: 'submitter_id',
  },
  users: { id: 'id', displayName: 'display_name', email: 'email' },
  eq: vi.fn(),
  inArray: vi.fn(),
}));

// Mock Inngest client — capture function handler
let capturedFunction: {
  handler: (args: {
    event: Record<string, unknown>;
    step: Record<string, unknown>;
  }) => Promise<unknown>;
};

vi.mock('../client.js', () => ({
  inngest: {
    createFunction: (
      _config: Record<string, unknown>,
      _triggers: unknown,
      handler: (args: Record<string, unknown>) => Promise<unknown>,
    ) => {
      capturedFunction = { handler };
      return { handler };
    },
  },
}));

describe('cmsPublishWorkflow Inngest function', () => {
  beforeAll(async () => {
    await import('./cms-publish.js');
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupMocks(overrides?: {
    pieceData?: unknown[];
    publishResult?: { externalId: string; externalUrl?: string };
  }) {
    mockIssueServiceGetById.mockResolvedValue({
      id: 'issue-1',
      title: 'Spring 2026',
      volume: 1,
      issueNumber: 1,
      description: 'Spring issue',
      coverImageUrl: null,
      publicationDate: null,
      metadata: null,
    });
    mockIssueServiceGetSections.mockResolvedValue([]);
    mockIssueServiceGetItems.mockResolvedValue([
      {
        id: 'item-1',
        issueId: 'issue-1',
        pipelineItemId: 'pi-1',
        issueSectionId: null,
        sortOrder: 0,
      },
    ]);
    mockListByPublication.mockResolvedValue([
      {
        id: 'conn-1',
        adapterType: 'GHOST',
        config: { apiUrl: 'https://ghost.example.com' },
        isActive: true,
      },
    ]);
    mockPublishIssue.mockResolvedValue(
      overrides?.publishResult ?? {
        externalId: 'ext-123',
        externalUrl: 'https://ghost.example.com/spring-2026',
      },
    );
    mockUpdateLastSync.mockResolvedValue(undefined);
    mockSaveCmsPublishResult.mockResolvedValue(null);
  }

  it('populates author from submitter displayName', async () => {
    setupMocks();

    // The handler calls step.run which calls withRls.
    // The first step.run loads data (issue, sections, items, connections, pieceData).
    // withRls mocks pass through with 'mock-tx', so the pieceData query
    // goes to the actual tx.select chain — we need to handle this differently.
    // Since withRls returns the fn result, and the fn does tx queries,
    // we need to make the mock tx return pieceData.
    const { withRls: mockWithRls } = await import('@colophony/db');
    const withRlsFn = vi.mocked(mockWithRls);

    // First call: load-issue-and-connections
    let callCount = 0;

    withRlsFn.mockImplementation(
      async (_ctx: any, fn: (tx: any) => Promise<unknown>) => {
        callCount++;
        if (callCount === 1) {
          // The data-loading step — mock tx with select for pieceData query
          const mockTx = {
            select: () => ({
              from: () => ({
                innerJoin: () => ({
                  leftJoin: () => ({
                    where: () =>
                      Promise.resolve([
                        {
                          pipelineItemId: 'pi-1',
                          title: 'My Poem',
                          content: '<p>Roses are red</p>',
                          submitterDisplayName: 'Jane Doe',
                          submitterEmail: 'jane@example.com',
                        },
                      ]),
                  }),
                }),
              }),
            }),
          };
          return fn(mockTx);
        }
        // Subsequent calls: publish step
        return fn('mock-tx');
      },
    );

    const mockStep = {
      run: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
    };

    await capturedFunction.handler({
      event: {
        data: { orgId: 'org-1', issueId: 'issue-1', publicationId: 'pub-1' },
      },
      step: mockStep,
    });

    // Check publishIssue was called with author populated
    expect(mockPublishIssue).toHaveBeenCalledOnce();
    const payload = mockPublishIssue.mock.calls[0][1];
    expect(payload.items[0].author).toBe('Jane Doe');
  });

  it('falls back to email when displayName is null', async () => {
    setupMocks();

    const { withRls: mockWithRls } = await import('@colophony/db');
    const withRlsFn = vi.mocked(mockWithRls);

    let callCount = 0;

    withRlsFn.mockImplementation(
      async (_ctx: any, fn: (tx: any) => Promise<unknown>) => {
        callCount++;
        if (callCount === 1) {
          const mockTx = {
            select: () => ({
              from: () => ({
                innerJoin: () => ({
                  leftJoin: () => ({
                    where: () =>
                      Promise.resolve([
                        {
                          pipelineItemId: 'pi-1',
                          title: 'My Poem',
                          content: '<p>Content</p>',
                          submitterDisplayName: null,
                          submitterEmail: 'writer@example.com',
                        },
                      ]),
                  }),
                }),
              }),
            }),
          };
          return fn(mockTx);
        }
        return fn('mock-tx');
      },
    );

    const mockStep = {
      run: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
    };

    await capturedFunction.handler({
      event: {
        data: { orgId: 'org-1', issueId: 'issue-1', publicationId: 'pub-1' },
      },
      step: mockStep,
    });

    const payload = mockPublishIssue.mock.calls[0][1];
    expect(payload.items[0].author).toBe('writer@example.com');
  });

  it('persists CMS publish result in issue metadata', async () => {
    setupMocks();

    const { withRls: mockWithRls } = await import('@colophony/db');
    const withRlsFn = vi.mocked(mockWithRls);

    let callCount = 0;
    withRlsFn.mockImplementation(
      async (_ctx: any, fn: (tx: any) => Promise<unknown>) => {
        callCount++;
        if (callCount === 1) {
          const mockTx = {
            select: () => ({
              from: () => ({
                innerJoin: () => ({
                  leftJoin: () => ({
                    where: () =>
                      Promise.resolve([
                        {
                          pipelineItemId: 'pi-1',
                          title: 'Poem',
                          content: '<p>text</p>',
                          submitterDisplayName: null,
                          submitterEmail: null,
                        },
                      ]),
                  }),
                }),
              }),
            }),
          };
          return fn(mockTx);
        }
        return fn('mock-tx');
      },
    );

    const mockStep = {
      run: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
    };

    await capturedFunction.handler({
      event: {
        data: { orgId: 'org-1', issueId: 'issue-1', publicationId: 'pub-1' },
      },
      step: mockStep,
    });

    expect(mockSaveCmsPublishResult).toHaveBeenCalledWith(
      'mock-tx',
      'issue-1',
      'conn-1',
      {
        externalId: 'ext-123',
        externalUrl: 'https://ghost.example.com/spring-2026',
        adapterType: 'GHOST',
      },
    );
  });
});
