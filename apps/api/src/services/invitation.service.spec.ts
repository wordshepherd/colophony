import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPoolQuery = vi.fn();

vi.mock('@colophony/db', () => ({
  organizationInvitations: {
    id: 'oi.id',
    organizationId: 'oi.organization_id',
    email: 'oi.email',
    roles: 'oi.roles',
    tokenHash: 'oi.token_hash',
    tokenPrefix: 'oi.token_prefix',
    status: 'oi.status',
    invitedBy: 'oi.invited_by',
    acceptedBy: 'oi.accepted_by',
    expiresAt: 'oi.expires_at',
    acceptedAt: 'oi.accepted_at',
    revokedAt: 'oi.revoked_at',
    createdAt: 'oi.created_at',
  },
  organizations: { id: 'o.id', name: 'o.name' },
  users: { id: 'u.id', email: 'u.email' },
  pool: { query: (...args: unknown[]) => mockPoolQuery(...args) },
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

vi.mock('./email.service.js', () => ({
  emailService: {
    create: vi.fn().mockResolvedValue({ id: 'email-send-1' }),
  },
}));

vi.mock('../queues/email.queue.js', () => ({
  enqueueEmail: vi.fn().mockResolvedValue(undefined),
}));

// Chain builder for Drizzle ORM queries
function createChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.leftJoin = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.offset = vi.fn().mockReturnValue(chain);
  chain.returning = vi
    .fn()
    .mockResolvedValue(Array.isArray(result) ? result : [result]);
  // For queries that resolve directly (no .returning())
  chain.then = vi
    .fn()
    .mockImplementation((resolve: (v: unknown) => void) =>
      resolve(Array.isArray(result) ? result : [result]),
    );
  return chain;
}

function createMockTx() {
  const insertChain = createChain({
    id: 'inv-1',
    organizationId: 'org-1',
    email: 'test@example.com',
    roles: ['READER'],
    tokenHash: 'hash123',
    tokenPrefix: 'col_inv_',
    status: 'PENDING',
    invitedBy: 'user-1',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  });

  const updateChain = createChain({
    id: 'inv-1',
    status: 'REVOKED',
    revokedAt: new Date(),
  });

  const selectChain = createChain([]);

  return {
    insert: vi.fn().mockReturnValue(insertChain),
    update: vi.fn().mockReturnValue(updateChain),
    select: vi.fn().mockReturnValue(selectChain),
    _insertChain: insertChain,
    _updateChain: updateChain,
    _selectChain: selectChain,
  };
}

// Import after mocks
import {
  invitationService,
  InvitationNotFoundError,
  InvitationExpiredError,
  InvitationAlreadyAcceptedError,
  InvitationEmailMismatchError,
} from './invitation.service.js';

describe('invitation.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('token generation', () => {
    it('generates tokens with col_inv_ prefix', async () => {
      const tx = createMockTx();
      const { plainTextToken } = await invitationService.create(
        tx as never,
        'org-1',
        'test@example.com',
        ['READER'],
        'user-1',
      );

      expect(plainTextToken).toMatch(/^col_inv_[a-f0-9]{32}$/);
    });

    it('stores SHA-256 hash, not plaintext', async () => {
      const tx = createMockTx();
      const { plainTextToken } = await invitationService.create(
        tx as never,
        'org-1',
        'test@example.com',
        ['READER'],
        'user-1',
      );

      // Verify the hash was computed correctly
      const expectedHash = crypto
        .createHash('sha256')
        .update(plainTextToken)
        .digest('hex');

      const insertCall = tx.insert.mock.results[0]?.value;
      const valuesCall = insertCall?.values;
      expect(valuesCall).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenHash: expectedHash,
          tokenPrefix: 'col_inv_',
        }),
      );
    });
  });

  describe('verifyToken', () => {
    it('returns invitation details for valid token', async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'inv-1',
            organization_id: 'org-1',
            email: 'test@example.com',
            roles: ['EDITOR'],
            status: 'PENDING',
            invited_by: 'user-1',
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            created_at: new Date(),
            organization_name: 'Test Org',
          },
        ],
      });

      const result = await invitationService.verifyToken('col_inv_abc123');

      expect(result).toEqual({
        id: 'inv-1',
        organizationId: 'org-1',
        email: 'test@example.com',
        roles: ['EDITOR'],
        status: 'PENDING',
        invitedBy: 'user-1',
        expiresAt: expect.any(Date),
        createdAt: expect.any(Date),
        organizationName: 'Test Org',
      });
    });

    it('returns null for non-existent token', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      const result = await invitationService.verifyToken('col_inv_nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('acceptToken', () => {
    it('returns result for valid token and matching email', async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          {
            invitation_id: 'inv-1',
            organization_id: 'org-1',
            member_id: 'mem-1',
            roles: ['EDITOR'],
          },
        ],
      });

      const result = await invitationService.acceptToken(
        'col_inv_abc123',
        'user-1',
        'test@example.com',
      );

      expect(result).toEqual({
        invitationId: 'inv-1',
        organizationId: 'org-1',
        memberId: 'mem-1',
        roles: ['EDITOR'],
      });

      expect(mockPoolQuery).toHaveBeenCalledWith(
        'SELECT * FROM accept_invitation($1, $2, $3)',
        [expect.any(String), 'user-1', 'test@example.com'],
      );
    });

    it('returns null when email does not match', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      const result = await invitationService.acceptToken(
        'col_inv_abc123',
        'user-1',
        'wrong@example.com',
      );

      expect(result).toBeNull();
    });

    it('returns null for expired token', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      const result = await invitationService.acceptToken(
        'col_inv_expired',
        'user-1',
        'test@example.com',
      );

      expect(result).toBeNull();
    });
  });

  describe('acceptWithAudit', () => {
    it('throws InvitationNotFoundError for invalid token', async () => {
      // acceptToken returns null
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });
      // verifyToken also returns null
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      const mockSvc = {
        tx: createMockTx() as never,
        userId: 'user-1',
        audit: vi.fn(),
      };

      // Mock user lookup
      const userChain = createChain([{ email: 'test@example.com' }]);
      (mockSvc.tx as ReturnType<typeof createMockTx>).select = vi
        .fn()
        .mockReturnValue(userChain);

      await expect(
        invitationService.acceptWithAudit(mockSvc, 'col_inv_invalid'),
      ).rejects.toThrow(InvitationNotFoundError);
    });

    it('throws InvitationAlreadyAcceptedError for accepted token', async () => {
      // acceptToken returns null
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });
      // verifyToken returns accepted invitation
      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'inv-1',
            organization_id: 'org-1',
            email: 'test@example.com',
            roles: ['EDITOR'],
            status: 'ACCEPTED',
            invited_by: 'user-1',
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            created_at: new Date(),
            organization_name: 'Test Org',
          },
        ],
      });

      const mockSvc = {
        tx: createMockTx() as never,
        userId: 'user-1',
        audit: vi.fn(),
      };

      const userChain = createChain([{ email: 'test@example.com' }]);
      (mockSvc.tx as ReturnType<typeof createMockTx>).select = vi
        .fn()
        .mockReturnValue(userChain);

      await expect(
        invitationService.acceptWithAudit(mockSvc, 'col_inv_accepted'),
      ).rejects.toThrow(InvitationAlreadyAcceptedError);
    });

    it('throws InvitationExpiredError for expired token', async () => {
      // acceptToken returns null
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });
      // verifyToken returns expired invitation
      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'inv-1',
            organization_id: 'org-1',
            email: 'test@example.com',
            roles: ['EDITOR'],
            status: 'PENDING',
            invited_by: 'user-1',
            expires_at: new Date('2020-01-01'), // expired
            created_at: new Date('2019-12-25'),
            organization_name: 'Test Org',
          },
        ],
      });

      const mockSvc = {
        tx: createMockTx() as never,
        userId: 'user-1',
        audit: vi.fn(),
      };

      const userChain = createChain([{ email: 'test@example.com' }]);
      (mockSvc.tx as ReturnType<typeof createMockTx>).select = vi
        .fn()
        .mockReturnValue(userChain);

      await expect(
        invitationService.acceptWithAudit(mockSvc, 'col_inv_expired'),
      ).rejects.toThrow(InvitationExpiredError);
    });

    it('throws InvitationEmailMismatchError when emails differ', async () => {
      // acceptToken returns null
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });
      // verifyToken returns invitation with different email (not expired)
      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'inv-1',
            organization_id: 'org-1',
            email: 'other@example.com',
            roles: ['EDITOR'],
            status: 'PENDING',
            invited_by: 'user-1',
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            created_at: new Date(),
            organization_name: 'Test Org',
          },
        ],
      });

      const mockSvc = {
        tx: createMockTx() as never,
        userId: 'user-1',
        audit: vi.fn(),
      };

      const userChain = createChain([{ email: 'test@example.com' }]);
      (mockSvc.tx as ReturnType<typeof createMockTx>).select = vi
        .fn()
        .mockReturnValue(userChain);

      await expect(
        invitationService.acceptWithAudit(mockSvc, 'col_inv_mismatch'),
      ).rejects.toThrow(InvitationEmailMismatchError);
    });
  });

  describe('error classes', () => {
    it('has correct names', () => {
      expect(new InvitationNotFoundError().name).toBe(
        'InvitationNotFoundError',
      );
      expect(new InvitationExpiredError().name).toBe('InvitationExpiredError');
      expect(new InvitationAlreadyAcceptedError().name).toBe(
        'InvitationAlreadyAcceptedError',
      );
      expect(new InvitationEmailMismatchError().name).toBe(
        'InvitationEmailMismatchError',
      );
    });
  });
});
