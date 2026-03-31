import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFindFirst = vi.fn();
const mockExecute = vi.fn();

vi.mock('@colophony/db', () => ({
  db: {
    query: {
      organizations: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
  },
  organizations: { id: 'organizations.id', slug: 'organizations.slug' },
  withRls: vi.fn(
    async (
      _ctx: { orgId?: string },
      fn: (tx: { execute: typeof mockExecute }) => Promise<unknown>,
    ) => fn({ execute: mockExecute }),
  ),
}));

vi.mock('drizzle-orm', () => ({
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values,
    }),
    { raw: (s: string) => s },
  ),
  eq: vi.fn(),
}));

import { responseTimeTransparencyService } from './response-time-transparency.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = '11111111-1111-1111-1111-111111111111';

function makeStatsRow(overrides: Record<string, unknown> = {}) {
  return {
    sample_size: 25,
    median_days: 18.5,
    bucket_0: 2,
    bucket_1: 3,
    bucket_2: 8,
    bucket_3: 7,
    bucket_4: 3,
    bucket_5: 2,
    ...overrides,
  };
}

function makeTrendRows() {
  return [
    { month: '2026-01-01', median_days: 20.0 },
    { month: '2026-02-01', median_days: 17.5 },
    { month: '2026-03-01', median_days: 15.0 },
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('responseTimeTransparencyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    responseTimeTransparencyService.invalidateCache(ORG_ID);
  });

  afterEach(() => {
    responseTimeTransparencyService.invalidateCache(ORG_ID);
  });

  it('returns null when org has opted out', async () => {
    mockFindFirst.mockResolvedValue({
      settings: { responseTimeTransparencyEnabled: false },
    });

    const result = await responseTimeTransparencyService.getPublicStats(ORG_ID);

    expect(result).toBeNull();
    // Should not query submissions
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('returns null when org does not exist', async () => {
    mockFindFirst.mockResolvedValue(undefined);

    const result = await responseTimeTransparencyService.getPublicStats(ORG_ID);

    expect(result).toBeNull();
  });

  it('returns null when sample size is below threshold', async () => {
    mockFindFirst.mockResolvedValue({
      settings: { responseTimeTransparencyEnabled: true },
    });
    mockExecute.mockResolvedValueOnce({
      rows: [makeStatsRow({ sample_size: 5 })],
    });

    const result = await responseTimeTransparencyService.getPublicStats(ORG_ID);

    expect(result).toBeNull();
  });

  it('returns stats with correct structure when sufficient data', async () => {
    mockFindFirst.mockResolvedValue({
      settings: { responseTimeTransparencyEnabled: true },
    });
    mockExecute
      .mockResolvedValueOnce({ rows: [makeStatsRow()] })
      .mockResolvedValueOnce({ rows: makeTrendRows() });

    const result = await responseTimeTransparencyService.getPublicStats(ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.medianDays).toBe(18.5);
    expect(result!.sampleSize).toBe(25);
    expect(result!.source).toBe('local');
    expect(result!.buckets).toHaveLength(6);
    expect(result!.trend).toHaveLength(3);
    expect(result!.updatedAt).toBeDefined();
  });

  it('bucket percentages sum to approximately 100', async () => {
    mockFindFirst.mockResolvedValue({
      settings: { responseTimeTransparencyEnabled: true },
    });
    mockExecute
      .mockResolvedValueOnce({ rows: [makeStatsRow()] })
      .mockResolvedValueOnce({ rows: makeTrendRows() });

    const result = await responseTimeTransparencyService.getPublicStats(ORG_ID);

    const totalPercentage = result!.buckets.reduce(
      (sum, b) => sum + b.percentage,
      0,
    );
    expect(totalPercentage).toBeCloseTo(100, 0);
  });

  it('always returns source as local', async () => {
    mockFindFirst.mockResolvedValue({
      settings: { responseTimeTransparencyEnabled: true },
    });
    mockExecute
      .mockResolvedValueOnce({ rows: [makeStatsRow()] })
      .mockResolvedValueOnce({ rows: makeTrendRows() });

    const result = await responseTimeTransparencyService.getPublicStats(ORG_ID);

    expect(result!.source).toBe('local');
  });

  it('returns cached result within TTL', async () => {
    mockFindFirst.mockResolvedValue({
      settings: { responseTimeTransparencyEnabled: true },
    });
    mockExecute
      .mockResolvedValueOnce({ rows: [makeStatsRow()] })
      .mockResolvedValueOnce({ rows: makeTrendRows() });

    const first = await responseTimeTransparencyService.getPublicStats(ORG_ID);
    const second = await responseTimeTransparencyService.getPublicStats(ORG_ID);

    expect(first).toEqual(second);
    // findFirst called once for first call, not for cached call
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
  });

  it('invalidateCache forces fresh query', async () => {
    mockFindFirst.mockResolvedValue({
      settings: { responseTimeTransparencyEnabled: true },
    });
    mockExecute
      .mockResolvedValueOnce({ rows: [makeStatsRow()] })
      .mockResolvedValueOnce({ rows: makeTrendRows() })
      .mockResolvedValueOnce({
        rows: [makeStatsRow({ median_days: 22.0 })],
      })
      .mockResolvedValueOnce({ rows: makeTrendRows() });

    await responseTimeTransparencyService.getPublicStats(ORG_ID);
    responseTimeTransparencyService.invalidateCache(ORG_ID);
    const second = await responseTimeTransparencyService.getPublicStats(ORG_ID);

    expect(second!.medianDays).toBe(22.0);
    expect(mockFindFirst).toHaveBeenCalledTimes(2);
  });

  it('defaults to enabled when settings are empty', async () => {
    mockFindFirst.mockResolvedValue({ settings: {} });
    mockExecute
      .mockResolvedValueOnce({ rows: [makeStatsRow()] })
      .mockResolvedValueOnce({ rows: makeTrendRows() });

    const result = await responseTimeTransparencyService.getPublicStats(ORG_ID);

    expect(result).not.toBeNull();
  });
});
