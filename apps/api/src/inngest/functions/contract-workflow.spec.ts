import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// Mock dependencies
const mockContractServiceGetById = vi.fn();
vi.mock('../../services/contract.service.js', () => ({
  contractService: {
    getById: (...args: unknown[]) => mockContractServiceGetById(...args),
    updateDocumensoId: vi.fn().mockResolvedValue(null),
    updateStatus: vi.fn().mockResolvedValue(null),
  },
}));

const mockCreateDocumensoAdapter = vi.fn();
vi.mock('../../adapters/documenso.adapter.js', () => ({
  createDocumensoAdapter: (...args: unknown[]) =>
    mockCreateDocumensoAdapter(...args),
}));

vi.mock('../../config/env.js', () => ({
  validateEnv: () => ({
    DOCUMENSO_API_URL: 'https://documenso.example.com',
    DOCUMENSO_API_KEY: 'test-key',
  }),
}));

const mockWithRls = vi.fn();
vi.mock('@colophony/db', () => ({
  withRls: (...args: unknown[]) => mockWithRls(...args),
  pipelineItems: { id: 'pipeline_items.id', submissionId: 'submission_id' },
  submissions: { id: 'submissions.id', submitterId: 'submitter_id' },
  users: {
    id: 'users.id',
    email: 'users.email',
    displayName: 'users.display_name',
  },
  eq: vi.fn(),
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
      handler: (args: Record<string, unknown>) => Promise<unknown>,
    ) => {
      capturedFunction = { handler };
      return { handler };
    },
  },
}));

describe('contractWorkflow Inngest function', () => {
  beforeAll(async () => {
    await import('./contract-workflow.js');
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('populates signers with submitter email and displayName', async () => {
    const mockCreateDocument = vi.fn().mockResolvedValue('doc-123');
    mockCreateDocumensoAdapter.mockReturnValue({
      createDocument: mockCreateDocument,
    });

    // First withRls call: loads contract + submitter
    mockWithRls.mockImplementation(
      async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          select: () => ({
            from: () => ({
              innerJoin: () => ({
                innerJoin: () => ({
                  where: () => ({
                    limit: () =>
                      Promise.resolve([
                        {
                          email: 'writer@example.com',
                          displayName: 'Jane Writer',
                        },
                      ]),
                  }),
                }),
              }),
            }),
          }),
        };

        // For the contract getById call, need mockContractServiceGetById to work
        mockContractServiceGetById.mockResolvedValue({
          id: 'contract-1',
          renderedBody: '<p>Contract body</p>',
        });

        return fn(mockTx);
      },
    );

    const mockStep = {
      run: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
      waitForEvent: vi.fn().mockResolvedValue(null),
    };

    await capturedFunction.handler({
      event: {
        data: {
          orgId: 'org-1',
          contractId: 'contract-1',
          pipelineItemId: 'pi-1',
        },
      },
      step: mockStep,
    });

    expect(mockCreateDocument).toHaveBeenCalledOnce();
    const createDocArgs = mockCreateDocument.mock.calls[0][0];
    expect(createDocArgs.signers).toEqual([
      {
        email: 'writer@example.com',
        name: 'Jane Writer',
        role: 'SIGNER',
      },
    ]);
  });

  it('falls back to email when displayName is null', async () => {
    const mockCreateDocument = vi.fn().mockResolvedValue('doc-456');
    mockCreateDocumensoAdapter.mockReturnValue({
      createDocument: mockCreateDocument,
    });

    mockWithRls.mockImplementation(
      async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          select: () => ({
            from: () => ({
              innerJoin: () => ({
                innerJoin: () => ({
                  where: () => ({
                    limit: () =>
                      Promise.resolve([
                        {
                          email: 'writer@example.com',
                          displayName: null,
                        },
                      ]),
                  }),
                }),
              }),
            }),
          }),
        };

        mockContractServiceGetById.mockResolvedValue({
          id: 'contract-2',
          renderedBody: '<p>Body</p>',
        });

        return fn(mockTx);
      },
    );

    const mockStep = {
      run: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
      waitForEvent: vi.fn().mockResolvedValue(null),
    };

    await capturedFunction.handler({
      event: {
        data: {
          orgId: 'org-1',
          contractId: 'contract-2',
          pipelineItemId: 'pi-2',
        },
      },
      step: mockStep,
    });

    const createDocArgs = mockCreateDocument.mock.calls[0][0];
    expect(createDocArgs.signers).toEqual([
      {
        email: 'writer@example.com',
        name: 'writer@example.com',
        role: 'SIGNER',
      },
    ]);
  });

  it('uses empty signers when no submitter found', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const mockCreateDocument = vi.fn().mockResolvedValue('doc-789');
    mockCreateDocumensoAdapter.mockReturnValue({
      createDocument: mockCreateDocument,
    });

    mockWithRls.mockImplementation(
      async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          select: () => ({
            from: () => ({
              innerJoin: () => ({
                innerJoin: () => ({
                  where: () => ({
                    limit: () => Promise.resolve([]),
                  }),
                }),
              }),
            }),
          }),
        };

        mockContractServiceGetById.mockResolvedValue({
          id: 'contract-3',
          renderedBody: '<p>Body</p>',
        });

        return fn(mockTx);
      },
    );

    const mockStep = {
      run: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
      waitForEvent: vi.fn().mockResolvedValue(null),
    };

    await capturedFunction.handler({
      event: {
        data: {
          orgId: 'org-1',
          contractId: 'contract-3',
          pipelineItemId: 'pi-3',
        },
      },
      step: mockStep,
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('no submitter found'),
    );
    warnSpy.mockRestore();

    const createDocArgs = mockCreateDocument.mock.calls[0][0];
    expect(createDocArgs.signers).toEqual([]);
  });
});
