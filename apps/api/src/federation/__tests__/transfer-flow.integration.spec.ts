import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import * as jose from 'jose';

// ---------------------------------------------------------------------------
// Mock dependencies (must be before service import)
// ---------------------------------------------------------------------------

const mockAuditLog = vi.fn();
const mockAuditLogDirect = vi.fn();

vi.mock('@colophony/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue([]),
        }),
      }),
    }),
  },
  withRls: vi.fn(),
  submissions: {},
  manuscriptVersions: {},
  files: {},
  pieceTransfers: {},
  inboundTransfers: {},
  trustedPeers: {},
  users: {},
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  count: vi.fn(),
}));

vi.mock('../../services/audit.service.js', () => ({
  auditService: {
    log: (...args: unknown[]) => mockAuditLog(...args),
    logDirect: (...args: unknown[]) => mockAuditLogDirect(...args),
  },
}));

const mockGetOrInitConfig = vi.fn();

vi.mock('../../services/federation.service.js', () => ({
  federationService: {
    getOrInitConfig: (...args: unknown[]) => mockGetOrInitConfig(...args),
  },
  domainToDid: (domain: string) => encodeURIComponent(domain),
}));

vi.mock('../../federation/http-signatures.js', () => ({
  signFederationRequest: vi.fn().mockReturnValue({
    headers: { signature: 'mock-sig', date: new Date().toUTCString() },
  }),
}));

vi.mock('../../lib/url-validation.js', () => ({
  validateOutboundUrl: vi.fn(),
  resolveAndCheckPrivateIp: vi.fn(),
  SsrfValidationError: class extends Error {},
}));

vi.mock('../../adapters/registry-accessor.js', () => ({
  getGlobalRegistry: vi.fn().mockReturnValue({
    storage: { getObject: vi.fn() },
  }),
}));

vi.mock('../../queues/transfer-fetch.queue.js', () => ({
  enqueueTransferFetch: vi.fn(),
}));

vi.mock('../../config/logger.js', () => ({
  getLogger: () => ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  transferService,
  TransferCapabilityError,
  TransferTokenError,
} from '../../services/transfer.service.js';
import { db, withRls } from '@colophony/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Generate real Ed25519 keypair for JWT tests
async function generateKeypair() {
  const { publicKey, privateKey } = await jose.generateKeyPair('EdDSA', {
    extractable: true,
  });
  return { publicKey, privateKey };
}

async function signTransferToken(
  privateKey: CryptoKey,
  claims: {
    iss: string;
    aud: string;
    exp?: number;
    jti: string;
    sub?: string;
    fileIds?: string[];
    submissionId?: string;
    manuscriptVersionId?: string;
  },
): Promise<string> {
  const builder = new jose.SignJWT({
    submissionId: claims.submissionId ?? 'sub-1',
    manuscriptVersionId: claims.manuscriptVersionId ?? 'ver-1',
    fileIds: claims.fileIds ?? ['file-1'],
  })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuer(claims.iss)
    .setAudience(claims.aud)
    .setJti(claims.jti);

  if (claims.sub) builder.setSubject(claims.sub);

  if (claims.exp !== undefined) {
    builder.setExpirationTime(claims.exp);
  } else {
    builder.setExpirationTime('72h');
  }

  return builder.sign(privateKey);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('transfer flow integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ───────────────────────────────────────────────
  // handleInboundTransfer tests
  // ───────────────────────────────────────────────

  it('handleInboundTransfer: valid initiation creates record', async () => {
    const { publicKey, privateKey } = await generateKeypair();
    const publicKeyPem = (await jose.exportSPKI(publicKey as CryptoKey)).trim();
    const transferId = crypto.randomUUID();

    const jwt = await signTransferToken(privateKey as CryptoKey, {
      iss: 'origin.example.com',
      aud: 'local.example.com',
      jti: transferId,
      sub: 'did:web:origin.example.com:users:alice',
      fileIds: ['file-1'],
    });

    // db.select(trustedPeers) → peer with transfer.initiate
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue([
            {
              organizationId: 'org-1',
              publicKey: publicKeyPem,
            },
          ]),
        }),
      }),
    } as any);

    // withRls → create submission + inbound transfer
    const mockWithRls = vi.mocked(withRls);
    mockWithRls.mockImplementation(async (_ctx: unknown, fn: unknown) => {
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue([]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi
              .fn()
              .mockReturnValueOnce([{ id: 'new-submission-1' }])
              .mockReturnValueOnce([{ id: 'inbound-transfer-1' }]),
          }),
        }),
      };
      return (fn as (tx: unknown) => Promise<unknown>)(mockTx);
    });

    const result = await transferService.handleInboundTransfer(
      { FEDERATION_DOMAIN: 'local.example.com' } as any,
      'origin.example.com',
      {
        transferToken: jwt,
        submitterDid: 'did:web:origin.example.com:users:alice',
        pieceMetadata: {
          title: 'Test Piece',
          coverLetter: 'A cover letter',
        },
        fileManifest: [
          {
            fileId: 'file-1',
            filename: 'test.pdf',
            mimeType: 'application/pdf',
            size: 1024,
          },
        ],
        protocolVersion: '1.0',
      },
    );

    expect(result.transferId).toBe('new-submission-1');
    expect(result.status).toBe('accepted');
  });

  it('handleInboundTransfer: rejects peer without capability', async () => {
    // db.select(trustedPeers) → empty (no matching peer)
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue([]),
        }),
      }),
    } as any);

    await expect(
      transferService.handleInboundTransfer(
        { FEDERATION_DOMAIN: 'local.example.com' } as any,
        'unknown-peer.example.com',
        {
          transferToken: 'fake-jwt',
          submitterDid: 'did:web:unknown-peer.example.com:users:bob',
          pieceMetadata: { title: 'Test' },
          fileManifest: [],
          protocolVersion: '1.0',
        },
      ),
    ).rejects.toThrow(TransferCapabilityError);
  });

  it('handleInboundTransfer: rejects expired JWT', async () => {
    const { publicKey, privateKey } = await generateKeypair();
    const publicKeyPem = (await jose.exportSPKI(publicKey as CryptoKey)).trim();
    const transferId = crypto.randomUUID();

    // JWT expired 1 hour ago
    const expiredTime = Math.floor(Date.now() / 1000) - 3600;
    const jwt = await signTransferToken(privateKey as CryptoKey, {
      iss: 'origin.example.com',
      aud: 'local.example.com',
      jti: transferId,
      exp: expiredTime,
    });

    // db.select(trustedPeers) → peer exists
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue([
            {
              organizationId: 'org-1',
              publicKey: publicKeyPem,
            },
          ]),
        }),
      }),
    } as any);

    await expect(
      transferService.handleInboundTransfer(
        { FEDERATION_DOMAIN: 'local.example.com' } as any,
        'origin.example.com',
        {
          transferToken: jwt,
          submitterDid: 'did:web:origin.example.com:users:alice',
          pieceMetadata: { title: 'Test' },
          fileManifest: [],
          protocolVersion: '1.0',
        },
      ),
    ).rejects.toThrow(TransferTokenError);
  });

  it('handleInboundTransfer: rejects wrong audience JWT', async () => {
    const { publicKey, privateKey } = await generateKeypair();
    const publicKeyPem = (await jose.exportSPKI(publicKey as CryptoKey)).trim();
    const transferId = crypto.randomUUID();

    // JWT audience is wrong-domain.com, not local.example.com
    const jwt = await signTransferToken(privateKey as CryptoKey, {
      iss: 'origin.example.com',
      aud: 'wrong-domain.com',
      jti: transferId,
    });

    // db.select(trustedPeers) → peer exists
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue([
            {
              organizationId: 'org-1',
              publicKey: publicKeyPem,
            },
          ]),
        }),
      }),
    } as any);

    await expect(
      transferService.handleInboundTransfer(
        { FEDERATION_DOMAIN: 'local.example.com' } as any,
        'origin.example.com',
        {
          transferToken: jwt,
          submitterDid: 'did:web:origin.example.com:users:alice',
          pieceMetadata: { title: 'Test' },
          fileManifest: [],
          protocolVersion: '1.0',
        },
      ),
    ).rejects.toThrow(TransferTokenError);
  });

  // ───────────────────────────────────────────────
  // verifyTransferToken test
  // ───────────────────────────────────────────────

  it('verifyTransferToken: validates correct token', async () => {
    const { publicKey, privateKey } = await generateKeypair();
    const publicKeyPem = (await jose.exportSPKI(publicKey as CryptoKey)).trim();
    const privateKeyPem = (
      await jose.exportPKCS8(privateKey as CryptoKey)
    ).trim();
    const transferId = crypto.randomUUID();
    const fileId = 'file-1';

    const jwt = await signTransferToken(privateKey as CryptoKey, {
      iss: 'local.example.com',
      aud: 'remote.example.com',
      jti: transferId,
      fileIds: [fileId],
      submissionId: 'sub-1',
      manuscriptVersionId: 'ver-1',
    });

    mockGetOrInitConfig.mockResolvedValue({
      enabled: true,
      publicKey: publicKeyPem,
      privateKey: privateKeyPem,
      keyId: 'local.example.com#main',
    });

    // db.select(pieceTransfers) → transfer exists in PENDING state
    // db.select(submissions) → submission exists with org context
    const dbSelectMock = vi.mocked(db.select);
    let callCount = 0;
    dbSelectMock.mockImplementation((_fields?: any) => {
      callCount++;
      if (callCount === 1) {
        // pieceTransfers lookup
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue([
                {
                  id: transferId,
                  submissionId: 'sub-1',
                  manuscriptVersionId: 'ver-1',
                  status: 'PENDING',
                },
              ]),
            }),
          }),
        } as any;
      }
      // submissions lookup
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue([{ organizationId: 'org-1' }]),
          }),
        }),
      } as any;
    });

    // withRls for status update — just resolve
    vi.mocked(withRls).mockResolvedValue(undefined);

    const result = await transferService.verifyTransferToken(
      { FEDERATION_DOMAIN: 'local.example.com' } as any,
      jwt,
      transferId,
      fileId,
    );

    expect(result.submissionId).toBe('sub-1');
    expect(result.manuscriptVersionId).toBe('ver-1');
    expect(result.orgId).toBe('org-1');
  });
});
