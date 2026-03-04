import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @colophony/db
const mockUpdate = vi.fn();
const mockSelectFrom = vi.fn();
vi.mock('@colophony/db', () => ({
  issues: { id: 'id', metadata: 'metadata' },
  issueSections: { id: 'id', issueId: 'issue_id', sortOrder: 'sort_order' },
  issueItems: {
    id: 'id',
    issueId: 'issue_id',
    pipelineItemId: 'pipeline_item_id',
    sortOrder: 'sort_order',
  },
  pipelineItems: { id: 'id', submissionId: 'submission_id' },
  submissions: { title: 'title' },
  eq: vi.fn((_col: unknown, val: unknown) => val),
  and: vi.fn((...args: unknown[]) => args),
  asc: vi.fn(),
  desc: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
}));

// Re-export needed for the ilike/count import
vi.mock('drizzle-orm', () => ({
  ilike: vi.fn(),
  count: vi.fn(),
  getTableColumns: vi.fn(() => ({})),
}));

import { issueService } from './issue.service.js';

describe('issueService.saveCmsPublishResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merges publish result into existing metadata', async () => {
    const existingIssue = {
      id: 'issue-1',
      metadata: { existingKey: 'value' },
    };

    // Mock getById
    mockSelectFrom.mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([existingIssue]),
      }),
    });

    const returnedRow = {
      ...existingIssue,
      metadata: {
        existingKey: 'value',
        cmsPublish: {
          'conn-1': {
            externalId: 'ext-1',
            externalUrl: 'https://example.com/post/1',
            publishedAt: expect.any(String),
            adapterType: 'GHOST',
          },
        },
      },
    };

    const mockWhere = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([returnedRow]),
    });
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    mockUpdate.mockReturnValue({ set: mockSet });

    const mockTx = {
      select: vi.fn().mockReturnValue({ from: mockSelectFrom }),
      update: mockUpdate,
    };

    const result = await issueService.saveCmsPublishResult(
      mockTx as unknown as Parameters<
        typeof issueService.saveCmsPublishResult
      >[0],
      'issue-1',
      'conn-1',
      {
        externalId: 'ext-1',
        externalUrl: 'https://example.com/post/1',
        adapterType: 'GHOST',
      },
    );

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          existingKey: 'value',
          cmsPublish: expect.objectContaining({
            'conn-1': expect.objectContaining({
              externalId: 'ext-1',
              externalUrl: 'https://example.com/post/1',
              adapterType: 'GHOST',
            }),
          }),
        }),
      }),
    );
    expect(result).toEqual(returnedRow);
  });

  it('returns null when issue not found', async () => {
    mockSelectFrom.mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    });

    const mockTx = {
      select: vi.fn().mockReturnValue({ from: mockSelectFrom }),
      update: mockUpdate,
    };

    const result = await issueService.saveCmsPublishResult(
      mockTx as unknown as Parameters<
        typeof issueService.saveCmsPublishResult
      >[0],
      'nonexistent',
      'conn-1',
      { externalId: 'ext-1', adapterType: 'GHOST' },
    );

    expect(result).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('creates cmsPublish when metadata is null', async () => {
    const existingIssue = { id: 'issue-2', metadata: null };

    mockSelectFrom.mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([existingIssue]),
      }),
    });

    const mockWhere = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([existingIssue]),
    });
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    mockUpdate.mockReturnValue({ set: mockSet });

    const mockTx = {
      select: vi.fn().mockReturnValue({ from: mockSelectFrom }),
      update: mockUpdate,
    };

    await issueService.saveCmsPublishResult(
      mockTx as unknown as Parameters<
        typeof issueService.saveCmsPublishResult
      >[0],
      'issue-2',
      'conn-2',
      { externalId: 'ext-2', adapterType: 'WORDPRESS' },
    );

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          cmsPublish: {
            'conn-2': expect.objectContaining({
              externalId: 'ext-2',
              adapterType: 'WORDPRESS',
            }),
          },
        }),
      }),
    );
  });
});
