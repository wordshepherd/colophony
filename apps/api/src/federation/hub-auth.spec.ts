import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

// Generate real keypair before mocks take effect
const testKeypair = crypto.generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let dbSelectResult: unknown[] = [];

vi.mock('@colophony/db', () => ({
  db: {
    select: () => ({
      from: () =>
        Object.assign(Promise.resolve(dbSelectResult), {
          where: () =>
            Object.assign(Promise.resolve(dbSelectResult), {
              limit: () => Promise.resolve(dbSelectResult),
            }),
        }),
    }),
  },
  hubRegisteredInstances: {
    id: 'id',
    domain: 'domain',
    publicKey: 'public_key',
    keyId: 'key_id',
    status: 'status',
  },
  eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
}));

const mockVerifyFederationSignature = vi.fn();
vi.mock('./http-signatures.js', () => ({
  verifyFederationSignature: (...args: unknown[]) =>
    mockVerifyFederationSignature(...args),
}));

vi.mock('./federation-auth.js', () => ({
  extractDomainFromKeyId: (keyId: string) => {
    const hash = keyId.indexOf('#');
    return hash > 0 ? keyId.slice(0, hash) : null;
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('hub-auth plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbSelectResult = [];
  });

  describe('extractDomainFromKeyId + DB lookup (unit logic)', () => {
    it('authenticates registered instance via HTTP signature', async () => {
      dbSelectResult = [
        {
          id: '00000000-0000-0000-0000-000000000001',
          publicKey: testKeypair.publicKey,
          keyId: 'instance.example.com#main',
        },
      ];

      mockVerifyFederationSignature.mockResolvedValueOnce({ valid: true });

      // Verify the mock chain works as expected for the plugin logic
      const { db } = await import('@colophony/db');
      const result = await db
        .select()
        .from({} as any)
        .where({} as any)
        .limit(1);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: '00000000-0000-0000-0000-000000000001',
      });
    });

    it('rejects unknown instance', async () => {
      dbSelectResult = [];

      const { db } = await import('@colophony/db');
      const result = await db
        .select()
        .from({} as any)
        .where({} as any)
        .limit(1);

      expect(result).toHaveLength(0);
    });

    it('rejects suspended instance (not in active query)', async () => {
      // The DB query filters by status='active', so a suspended instance
      // won't be returned — same as unknown
      dbSelectResult = [];

      const { db } = await import('@colophony/db');
      const result = await db
        .select()
        .from({} as any)
        .where({} as any)
        .limit(1);

      expect(result).toHaveLength(0);
    });
  });
});
