import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest';
import Fastify, {
  type FastifyInstance,
  type FastifyPluginAsync,
} from 'fastify';

// Mock DB
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();

vi.mock('@colophony/db', () => ({
  db: {
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return { from: mockFrom };
    },
  },
  trustedPeers: {
    domain: 'domain',
    status: 'status',
    publicKey: 'public_key',
    keyId: 'key_id',
  },
  eq: (a: unknown, b: unknown) => ({ op: 'eq', a, b }),
  and: (...args: unknown[]) => ({ op: 'and', args }),
}));

// Mock HTTP signatures
const mockVerifyFederationSignature = vi.fn();

vi.mock('./http-signatures.js', () => ({
  verifyFederationSignature: (...args: unknown[]) =>
    mockVerifyFederationSignature(...args),
}));

// Chain DB mock helpers
function setupDbChain(result: unknown[]) {
  mockFrom.mockReturnValue({ where: mockWhere });
  mockWhere.mockReturnValue({ limit: mockLimit });
  mockLimit.mockResolvedValue(result);
}

// Valid signature headers for testing
const VALID_KEY_ID = 'example.com#main';
const VALID_SIG_INPUT = `sig1=("@method" "@target-uri" "date");alg="ed25519";keyid="${VALID_KEY_ID}"`;
const VALID_SIG = 'sig1=:dGVzdHNpZw==:';

function makeHeaders(
  overrides: Record<string, string> = {},
): Record<string, string> {
  return {
    signature: VALID_SIG,
    'signature-input': VALID_SIG_INPUT,
    date: new Date().toUTCString(),
    'content-type': 'application/json',
    ...overrides,
  };
}

describe('federation-auth plugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const mod = await import('./federation-auth.js');

    app = Fastify({ logger: false });
    await app.register(mod.default as unknown as FastifyPluginAsync);

    // Test route that returns the decorated peer context
    app.post('/test', async (request) => {
      return { peer: request.federationPeer };
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Missing headers ---

  it('returns 401 when Signature header missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test',
      headers: { 'signature-input': VALID_SIG_INPUT },
      payload: {},
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'missing_signature' });
  });

  it('returns 401 when Signature-Input header missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test',
      headers: { signature: VALID_SIG },
      payload: {},
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'missing_signature' });
  });

  // --- Parse failures ---

  it('returns 401 when keyId cannot be parsed from Signature-Input', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test',
      headers: makeHeaders({
        'signature-input': 'sig1=(malformed-no-keyid)',
      }),
      payload: {},
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'invalid_signature_input' });
  });

  it('returns 401 when domain cannot be extracted from keyId', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test',
      headers: makeHeaders({
        'signature-input': `sig1=("@method");alg="ed25519";keyid="random-garbage"`,
      }),
      payload: {},
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'invalid_key_id' });
  });

  // --- DB lookup failures ---

  it('returns 401 when no active trusted peer found', async () => {
    setupDbChain([]);

    const response = await app.inject({
      method: 'POST',
      url: '/test',
      headers: makeHeaders(),
      payload: {},
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'untrusted_peer' });
  });

  // --- Signature verification failures ---

  it('returns 401 when signature verification fails', async () => {
    setupDbChain([{ publicKey: 'PEM-KEY', keyId: VALID_KEY_ID }]);
    mockVerifyFederationSignature.mockResolvedValueOnce({
      valid: false,
      keyId: VALID_KEY_ID,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/test',
      headers: makeHeaders(),
      payload: {},
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'signature_invalid' });
  });

  it('returns 401 when verification throws', async () => {
    setupDbChain([{ publicKey: 'PEM-KEY', keyId: VALID_KEY_ID }]);
    mockVerifyFederationSignature.mockRejectedValueOnce(
      new Error('crypto error'),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/test',
      headers: makeHeaders(),
      payload: {},
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'signature_verification_error' });
  });

  // --- Success cases ---

  it('decorates request on valid instance key', async () => {
    setupDbChain([{ publicKey: 'PEM-KEY', keyId: VALID_KEY_ID }]);
    mockVerifyFederationSignature.mockResolvedValueOnce({
      valid: true,
      keyId: VALID_KEY_ID,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/test',
      headers: makeHeaders(),
      payload: { data: 'test' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      peer: { domain: 'example.com', keyId: VALID_KEY_ID },
    });
  });

  it('decorates request on valid DID user key', async () => {
    const didKeyId = 'did:web:example.com:users:alice#key-1';
    const sigInput = `sig1=("@method");alg="ed25519";keyid="${didKeyId}"`;

    setupDbChain([{ publicKey: 'PEM-KEY', keyId: didKeyId }]);
    mockVerifyFederationSignature.mockResolvedValueOnce({
      valid: true,
      keyId: didKeyId,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/test',
      headers: makeHeaders({ 'signature-input': sigInput }),
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      peer: { domain: 'example.com', keyId: didKeyId },
    });
  });

  it('handles domain with port (instance key)', async () => {
    const portKeyId = 'localhost:4000#main';
    const sigInput = `sig1=("@method");alg="ed25519";keyid="${portKeyId}"`;

    setupDbChain([{ publicKey: 'PEM-KEY', keyId: portKeyId }]);
    mockVerifyFederationSignature.mockResolvedValueOnce({
      valid: true,
      keyId: portKeyId,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/test',
      headers: makeHeaders({ 'signature-input': sigInput }),
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      peer: { domain: 'localhost:4000', keyId: portKeyId },
    });
  });

  it('handles encoded port in DID key', async () => {
    const didKeyId = 'did:web:localhost%3A4000:users:bob#key-1';
    const sigInput = `sig1=("@method");alg="ed25519";keyid="${didKeyId}"`;

    setupDbChain([{ publicKey: 'PEM-KEY', keyId: didKeyId }]);
    mockVerifyFederationSignature.mockResolvedValueOnce({
      valid: true,
      keyId: didKeyId,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/test',
      headers: makeHeaders({ 'signature-input': sigInput }),
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      peer: { domain: 'localhost:4000', keyId: didKeyId },
    });
  });
});

// --- extractDomainFromKeyId unit tests ---

describe('extractDomainFromKeyId', () => {
  let extractDomainFromKeyId: (keyId: string) => string | null;

  beforeAll(async () => {
    const mod = await import('./federation-auth.js');
    extractDomainFromKeyId = mod.extractDomainFromKeyId;
  });

  it('extracts domain from instance key (domain#fragment)', () => {
    expect(extractDomainFromKeyId('example.com#main')).toBe('example.com');
  });

  it('extracts domain with port from instance key', () => {
    expect(extractDomainFromKeyId('localhost:4000#main')).toBe(
      'localhost:4000',
    );
  });

  it('extracts domain from instance DID key', () => {
    expect(extractDomainFromKeyId('did:web:example.com#main')).toBe(
      'example.com',
    );
  });

  it('extracts domain from user DID key', () => {
    expect(
      extractDomainFromKeyId('did:web:example.com:users:alice#key-1'),
    ).toBe('example.com');
  });

  it('decodes percent-encoded port in DID key', () => {
    expect(extractDomainFromKeyId('did:web:localhost%3A4000#main')).toBe(
      'localhost:4000',
    );
  });

  it('decodes percent-encoded port in user DID key', () => {
    expect(
      extractDomainFromKeyId('did:web:localhost%3A4000:users:bob#key-1'),
    ).toBe('localhost:4000');
  });

  it('returns null for random garbage', () => {
    expect(extractDomainFromKeyId('random-garbage')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractDomainFromKeyId('')).toBeNull();
  });

  it('returns null for bare fragment without domain', () => {
    expect(extractDomainFromKeyId('#main')).toBeNull();
  });

  it('returns null for did:web: with empty domain', () => {
    expect(extractDomainFromKeyId('did:web:#main')).toBeNull();
  });

  it('returns null for malformed percent-encoding in DID key', () => {
    expect(extractDomainFromKeyId('did:web:%ZZ#main')).toBeNull();
  });
});
