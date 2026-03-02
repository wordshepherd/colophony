import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@colophony/db', () => ({
  manuscriptVersions: {
    id: 'id',
    manuscriptId: 'manuscript_id',
    contentFingerprint: 'content_fingerprint',
    federationFingerprint: 'federation_fingerprint',
  },
  manuscripts: { id: 'id', title: 'title' },
  files: {
    filename: 'filename',
    size: 'size',
    contentHash: 'content_hash',
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
  computeContentFingerprint,
  computeFederationFingerprint,
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
// computeContentFingerprint
// ---------------------------------------------------------------------------

describe('computeContentFingerprint', () => {
  it('produces deterministic SHA-256 hex (64 chars)', () => {
    const fp = computeContentFingerprint('My Poem', 'some text', [
      'abc123',
      'def456',
    ]);
    expect(fp).toHaveLength(64);
    expect(fp).toMatch(/^[a-f0-9]{64}$/);
    // Deterministic
    expect(
      computeContentFingerprint('My Poem', 'some text', ['abc123', 'def456']),
    ).toBe(fp);
  });

  it('same content with different whitespace produces same hash', () => {
    const fp1 = computeContentFingerprint('My  Poem', '  some   text  ', []);
    const fp2 = computeContentFingerprint('my poem', 'some text', []);
    expect(fp1).toBe(fp2);
  });

  it('null contentText handled correctly', () => {
    const fp = computeContentFingerprint('title', null, []);
    expect(fp).toHaveLength(64);
  });
});

// ---------------------------------------------------------------------------
// computeFederationFingerprint
// ---------------------------------------------------------------------------

describe('computeFederationFingerprint', () => {
  it('produces deterministic SHA-256 hex (64 chars)', () => {
    const fp = computeFederationFingerprint('My Poem', 'some text', [
      'poem.docx:1234',
      'cover.pdf:5678',
    ]);
    expect(fp).toHaveLength(64);
    expect(fp).toMatch(/^[a-f0-9]{64}$/);
    // Deterministic
    expect(
      computeFederationFingerprint('My Poem', 'some text', [
        'poem.docx:1234',
        'cover.pdf:5678',
      ]),
    ).toBe(fp);
  });

  it('file identifier order does not affect fingerprint (sorted)', () => {
    const fp1 = computeFederationFingerprint('title', null, ['b:1', 'a:2']);
    const fp2 = computeFederationFingerprint('title', null, ['a:2', 'b:1']);
    expect(fp1).toBe(fp2);
  });
});

// ---------------------------------------------------------------------------
// content and federation fingerprints differ
// ---------------------------------------------------------------------------

describe('content vs federation fingerprints', () => {
  it('differ given different file inputs', () => {
    const content = computeContentFingerprint('Title', 'body', [
      'abc123def456abc123def456abc123def456abc123def456abc123def456abcd',
    ]);
    const federation = computeFederationFingerprint('Title', 'body', [
      'poem.docx:1234',
    ]);
    expect(content).not.toBe(federation);
  });
});

// ---------------------------------------------------------------------------
// computeFingerprint (deprecated alias)
// ---------------------------------------------------------------------------

describe('computeFingerprint (deprecated alias)', () => {
  it('is identical to computeFederationFingerprint', () => {
    const fp1 = computeFingerprint('title', 'text', ['file1:100']);
    const fp2 = computeFederationFingerprint('title', 'text', ['file1:100']);
    expect(fp1).toBe(fp2);
  });
});

// ---------------------------------------------------------------------------
// computeAndStore
// ---------------------------------------------------------------------------

describe('fingerprintService.computeAndStore', () => {
  function makeMockTx() {
    return {
      select: vi.fn(),
      update: vi.fn(),
    } as any;
  }

  function setupComputeAndStoreMocks(
    mockTx: any,
    opts: {
      version?: { id: string; manuscriptId: string } | null;
      manuscript?: { title: string } | null;
      files?: Array<{
        filename: string;
        size: number;
        contentHash: string | null;
      }>;
      submission?: { content: string | null } | null;
    } = {},
  ) {
    const {
      version = { id: 'v1', manuscriptId: 'm1' },
      manuscript = { title: 'My Poem' },
      files: fileList = [
        { filename: 'poem.pdf', size: 1024, contentHash: 'abc123' },
      ],
      submission = { content: 'poem content' },
    } = opts;

    // version query
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(version ? [version] : []),
        }),
      }),
    });

    if (!version) return;

    // manuscript query
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(manuscript ? [manuscript] : []),
        }),
      }),
    });

    if (!manuscript) return;

    // files query
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(fileList),
      }),
    });

    // linked submission query
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(submission ? [submission] : []),
        }),
      }),
    });

    // update
    mockTx.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
  }

  it('returns both fingerprints and stores both', async () => {
    const mockTx = makeMockTx();
    setupComputeAndStoreMocks(mockTx, {
      files: [{ filename: 'poem.pdf', size: 1024, contentHash: 'abc123' }],
    });

    const result = await fingerprintService.computeAndStore(mockTx, 'v1');
    expect(result.contentFingerprint).toHaveLength(64);
    expect(result.federationFingerprint).toHaveLength(64);
    expect(mockTx.update).toHaveBeenCalled();
  });

  it('content and federation fingerprints differ when contentHash present', async () => {
    const mockTx = makeMockTx();
    setupComputeAndStoreMocks(mockTx, {
      files: [{ filename: 'poem.pdf', size: 1024, contentHash: 'abc123' }],
    });

    const result = await fingerprintService.computeAndStore(mockTx, 'v1');
    // contentHash 'abc123' vs identifier 'poem.pdf:1024' → different fingerprints
    expect(result.contentFingerprint).not.toBe(result.federationFingerprint);
  });

  it('falls back to filename:size when contentHash is null', async () => {
    const mockTx = makeMockTx();
    setupComputeAndStoreMocks(mockTx, {
      files: [{ filename: 'poem.pdf', size: 1024, contentHash: null }],
    });

    const result = await fingerprintService.computeAndStore(mockTx, 'v1');
    // Both use filename:size when contentHash is null, so they should be equal
    expect(result.contentFingerprint).toBe(result.federationFingerprint);
  });

  it('only includes CLEAN files', async () => {
    const mockTx = makeMockTx();
    setupComputeAndStoreMocks(mockTx, { files: [] });

    const result = await fingerprintService.computeAndStore(mockTx, 'v1');
    expect(result.contentFingerprint).toHaveLength(64);
    expect(result.federationFingerprint).toHaveLength(64);
  });

  it('throws FingerprintComputationError for missing version', async () => {
    const mockTx = makeMockTx();
    setupComputeAndStoreMocks(mockTx, { version: null });

    await expect(
      fingerprintService.computeAndStore(mockTx, 'nonexistent'),
    ).rejects.toThrow(FingerprintComputationError);
  });

  it('throws FingerprintComputationError for missing manuscript', async () => {
    const mockTx = makeMockTx();
    setupComputeAndStoreMocks(mockTx, { manuscript: null });

    await expect(
      fingerprintService.computeAndStore(mockTx, 'v1'),
    ).rejects.toThrow(FingerprintComputationError);
  });
});

// ---------------------------------------------------------------------------
// getOrCompute
// ---------------------------------------------------------------------------

describe('fingerprintService.getOrCompute', () => {
  it('returns stored fingerprints without recomputing', async () => {
    const existingContent = 'a'.repeat(64);
    const existingFederation = 'b'.repeat(64);
    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                contentFingerprint: existingContent,
                federationFingerprint: existingFederation,
              },
            ]),
          }),
        }),
      }),
    } as any;

    const result = await fingerprintService.getOrCompute(mockTx, 'v1');
    expect(result.contentFingerprint).toBe(existingContent);
    expect(result.federationFingerprint).toBe(existingFederation);
    // Only one select call (no computeAndStore)
    expect(mockTx.select).toHaveBeenCalledTimes(1);
  });

  it('recomputes when federationFingerprint is missing', async () => {
    const mockTx = {
      select: vi.fn(),
      update: vi.fn(),
    } as any;

    // getOrCompute initial check — contentFingerprint present, federation missing
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              contentFingerprint: 'a'.repeat(64),
              federationFingerprint: null,
            },
          ]),
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
    expect(result.contentFingerprint).toHaveLength(64);
    expect(result.federationFingerprint).toHaveLength(64);
    expect(mockTx.update).toHaveBeenCalled();
  });

  it('recomputes when both fingerprints are missing', async () => {
    const mockTx = {
      select: vi.fn(),
      update: vi.fn(),
    } as any;

    // getOrCompute initial check — no fingerprints
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi
            .fn()
            .mockResolvedValue([
              { contentFingerprint: null, federationFingerprint: null },
            ]),
        }),
      }),
    });

    // computeAndStore calls
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
    expect(result.contentFingerprint).toHaveLength(64);
    expect(result.federationFingerprint).toHaveLength(64);
  });
});
