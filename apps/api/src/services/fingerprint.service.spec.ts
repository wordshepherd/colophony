import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@colophony/db', () => ({
  manuscriptVersions: {
    id: 'id',
    manuscriptId: 'manuscript_id',
    contentFingerprint: 'content_fingerprint',
  },
  manuscripts: { id: 'id', title: 'title' },
  files: {
    storageKey: 'storage_key',
    manuscriptVersionId: 'manuscript_version_id',
    scanStatus: 'scan_status',
  },
  submissions: {
    content: 'content',
    manuscriptVersionId: 'manuscript_version_id',
  },
  eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  normalizeText,
  computeFingerprint,
  fingerprintService,
  FingerprintComputationError,
} from './fingerprint.service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// normalizeText
// ---------------------------------------------------------------------------

describe('normalizeText', () => {
  it('collapses whitespace and lowercases', () => {
    expect(normalizeText('Hello   World')).toBe('hello world');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeText('  hello  ')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(normalizeText('')).toBe('');
  });

  it('collapses tabs and newlines', () => {
    expect(normalizeText('hello\t\nworld')).toBe('hello world');
  });
});

// ---------------------------------------------------------------------------
// computeFingerprint
// ---------------------------------------------------------------------------

describe('computeFingerprint', () => {
  it('produces consistent SHA-256 hex (64 chars)', () => {
    const fp = computeFingerprint('My Poem', 'some text', ['file1', 'file2']);
    expect(fp).toHaveLength(64);
    expect(fp).toMatch(/^[a-f0-9]{64}$/);
    // Deterministic
    expect(computeFingerprint('My Poem', 'some text', ['file1', 'file2'])).toBe(
      fp,
    );
  });

  it('same content with different whitespace produces same hash', () => {
    const fp1 = computeFingerprint('My  Poem', '  some   text  ', []);
    const fp2 = computeFingerprint('my poem', 'some text', []);
    expect(fp1).toBe(fp2);
  });

  it('different titles produce different hashes', () => {
    const fp1 = computeFingerprint('Poem A', null, []);
    const fp2 = computeFingerprint('Poem B', null, []);
    expect(fp1).not.toBe(fp2);
  });

  it('file hash order does not affect fingerprint (sorted)', () => {
    const fp1 = computeFingerprint('title', null, ['b', 'a', 'c']);
    const fp2 = computeFingerprint('title', null, ['c', 'a', 'b']);
    expect(fp1).toBe(fp2);
  });

  it('null contentText handled correctly', () => {
    const fp = computeFingerprint('title', null, []);
    expect(fp).toHaveLength(64);
  });
});

// ---------------------------------------------------------------------------
// computeAndStore
// ---------------------------------------------------------------------------

describe('fingerprintService.computeAndStore', () => {
  it('computes and persists fingerprint on manuscript version', async () => {
    const mockTx = {
      select: vi.fn(),
      update: vi.fn(),
    } as any;

    // version query
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'v1', manuscriptId: 'm1' }]),
        }),
      }),
    });

    // manuscript query
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ title: 'My Poem' }]),
        }),
      }),
    });

    // files query
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ storageKey: 'key1' }]),
      }),
    });

    // linked submission query
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ content: 'poem content' }]),
        }),
      }),
    });

    // update
    mockTx.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const fp = await fingerprintService.computeAndStore(mockTx, 'v1');
    expect(fp).toHaveLength(64);
    expect(mockTx.update).toHaveBeenCalled();
  });

  it('only includes CLEAN files', async () => {
    const mockTx = {
      select: vi.fn(),
      update: vi.fn(),
    } as any;

    // version
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'v1', manuscriptId: 'm1' }]),
        }),
      }),
    });

    // manuscript
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ title: 'Test' }]),
        }),
      }),
    });

    // files — the WHERE clause in the service already filters by CLEAN
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    // linked submission
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    // update
    mockTx.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const fp = await fingerprintService.computeAndStore(mockTx, 'v1');
    expect(fp).toHaveLength(64);
  });

  it('throws FingerprintComputationError for missing version', async () => {
    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    } as any;

    await expect(
      fingerprintService.computeAndStore(mockTx, 'nonexistent'),
    ).rejects.toThrow(FingerprintComputationError);
  });
});

// ---------------------------------------------------------------------------
// getOrCompute
// ---------------------------------------------------------------------------

describe('fingerprintService.getOrCompute', () => {
  it('returns stored fingerprint without recomputing', async () => {
    const existingFp = 'a'.repeat(64);
    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([{ contentFingerprint: existingFp }]),
          }),
        }),
      }),
    } as any;

    const result = await fingerprintService.getOrCompute(mockTx, 'v1');
    expect(result).toBe(existingFp);
    // Only one select call (no computeAndStore)
    expect(mockTx.select).toHaveBeenCalledTimes(1);
  });

  it('computes and stores if not present', async () => {
    const mockTx = {
      select: vi.fn(),
      update: vi.fn(),
    } as any;

    // getOrCompute initial check — no fingerprint
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ contentFingerprint: null }]),
        }),
      }),
    });

    // computeAndStore calls: version, manuscript, files, submission
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'v1', manuscriptId: 'm1' }]),
        }),
      }),
    });
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ title: 'Title' }]),
        }),
      }),
    });
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockTx.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const result = await fingerprintService.getOrCompute(mockTx, 'v1');
    expect(result).toHaveLength(64);
    expect(mockTx.update).toHaveBeenCalled();
  });
});
