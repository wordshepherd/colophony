import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};

const { mockPoolConnect, mockEnqueueS3Cleanup } = vi.hoisted(() => ({
  mockPoolConnect: vi.fn(),
  mockEnqueueS3Cleanup: vi.fn(),
}));

vi.mock('@colophony/db', () => ({
  pool: { connect: mockPoolConnect },
}));

vi.mock('../queues/s3-cleanup.queue.js', () => ({
  enqueueS3Cleanup: mockEnqueueS3Cleanup,
}));

vi.mock('./audit.service.js', () => ({
  serializeValue: (v: unknown) => (v == null ? null : JSON.stringify(v)),
}));

import {
  gdprService,
  UserNotDeletableError,
  OrgNotDeletableError,
} from './gdpr.service.js';

const fakeEnv = {
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_PASSWORD: '',
  S3_BUCKET: 'submissions',
  S3_QUARANTINE_BUCKET: 'quarantine',
} as Parameters<typeof gdprService.deleteUser>[1];

const USER_ID = '00000000-0000-4000-a000-000000000001';
const ORG_ID = '00000000-0000-4000-a000-000000000010';

beforeEach(() => {
  vi.clearAllMocks();
  mockPoolConnect.mockResolvedValue(mockClient);
  mockClient.query.mockResolvedValue({ rows: [] });
});

describe('gdprService.deleteUser', () => {
  it('deletes user with manuscripts and enqueues S3 cleanup', async () => {
    // User exists
    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: USER_ID }] }) // SELECT user
      .mockResolvedValueOnce({
        rows: [
          { storage_key: 'files/abc.pdf', scan_status: 'CLEAN' },
          { storage_key: 'files/def.pdf', scan_status: 'PENDING' },
        ],
      }) // SELECT files
      .mockResolvedValueOnce({ rows: [] }) // UPDATE audit_events (scrub)
      .mockResolvedValueOnce({ rows: [] }) // SELECT insert_audit_event
      .mockResolvedValueOnce({ rows: [] }) // DELETE user
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const result = await gdprService.deleteUser(USER_ID, fakeEnv);

    expect(result.storageKeysEnqueued).toBe(2);
    expect(mockEnqueueS3Cleanup).toHaveBeenCalledWith(fakeEnv, {
      storageKeys: [
        { storageKey: 'files/abc.pdf', bucket: 'clean' },
        { storageKey: 'files/def.pdf', bucket: 'quarantine' },
      ],
      reason: 'user_gdpr_deletion',
      sourceId: USER_ID,
    });
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('throws UserNotDeletableError when user not found', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }); // SELECT user — empty

    await expect(
      gdprService.deleteUser('nonexistent', fakeEnv),
    ).rejects.toThrow(UserNotDeletableError);
    // ROLLBACK should have been called
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('scrubs audit events PII', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: USER_ID }] }) // SELECT user
      .mockResolvedValueOnce({ rows: [] }) // SELECT files (none)
      .mockResolvedValueOnce({ rows: [] }) // UPDATE audit_events
      .mockResolvedValueOnce({ rows: [] }) // SELECT insert_audit_event
      .mockResolvedValueOnce({ rows: [] }) // DELETE user
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    await gdprService.deleteUser(USER_ID, fakeEnv);

    // Third call (index 3) should be the audit scrub UPDATE
    const scrubCall = mockClient.query.mock.calls[3];
    expect(scrubCall[0]).toContain('UPDATE audit_events');
    expect(scrubCall[0]).toContain('_scrubbed');
    expect(scrubCall[0]).toContain('ip_address = NULL');
    expect(scrubCall[1]).toEqual([USER_ID]);
  });

  it('sets submitter_id to NULL via SET NULL cascade', async () => {
    // This is a DB-level behavior. We verify the DELETE is issued.
    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: USER_ID }] }) // SELECT user
      .mockResolvedValueOnce({ rows: [] }) // SELECT files
      .mockResolvedValueOnce({ rows: [] }) // UPDATE audit_events
      .mockResolvedValueOnce({ rows: [] }) // SELECT insert_audit_event
      .mockResolvedValueOnce({ rows: [] }) // DELETE user
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    await gdprService.deleteUser(USER_ID, fakeEnv);

    const deleteCall = mockClient.query.mock.calls[5];
    expect(deleteCall[0]).toContain('DELETE FROM users');
    expect(deleteCall[1]).toEqual([USER_ID]);
  });

  it('does not enqueue S3 cleanup when user has no files', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: USER_ID }] }) // SELECT user
      .mockResolvedValueOnce({ rows: [] }) // SELECT files (none)
      .mockResolvedValueOnce({ rows: [] }) // UPDATE audit_events
      .mockResolvedValueOnce({ rows: [] }) // SELECT insert_audit_event
      .mockResolvedValueOnce({ rows: [] }) // DELETE user
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const result = await gdprService.deleteUser(USER_ID, fakeEnv);

    expect(result.storageKeysEnqueued).toBe(0);
    expect(mockEnqueueS3Cleanup).not.toHaveBeenCalled();
  });

  it('logs GDPR deletion audit event before deleting user', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: USER_ID }] }) // SELECT user
      .mockResolvedValueOnce({ rows: [] }) // SELECT files
      .mockResolvedValueOnce({ rows: [] }) // UPDATE audit_events
      .mockResolvedValueOnce({ rows: [] }) // SELECT insert_audit_event
      .mockResolvedValueOnce({ rows: [] }) // DELETE user
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    await gdprService.deleteUser(USER_ID, fakeEnv);

    // Audit event call is index 4: client.query(sql, params)
    const auditCall = mockClient.query.mock.calls[4];
    const sql = auditCall[0] as string;
    const params = auditCall[1] as unknown[];
    expect(sql).toContain('insert_audit_event');
    // Verify the action and resource are in the params
    expect(params).toEqual(
      expect.arrayContaining(['USER_GDPR_DELETED', 'user']),
    );
  });
});

describe('gdprService.deleteOrganization', () => {
  it('deletes organization when user is admin', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ roles: ['ADMIN'] }] }) // SELECT member
      .mockResolvedValueOnce({ rows: [] }) // UPDATE audit_events (scrub)
      .mockResolvedValueOnce({ rows: [] }) // SELECT insert_audit_event
      .mockResolvedValueOnce({ rows: [] }) // DELETE organization
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    await gdprService.deleteOrganization(ORG_ID, USER_ID, fakeEnv);

    const deleteCall = mockClient.query.mock.calls[4];
    expect(deleteCall[0]).toContain('DELETE FROM organizations');
    expect(deleteCall[1]).toEqual([ORG_ID]);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('throws OrgNotDeletableError when user is not admin', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ roles: ['EDITOR'] }] }); // SELECT member

    await expect(
      gdprService.deleteOrganization(ORG_ID, USER_ID, fakeEnv),
    ).rejects.toThrow(OrgNotDeletableError);
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('throws OrgNotDeletableError when user is not a member', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }); // SELECT member — empty

    await expect(
      gdprService.deleteOrganization(ORG_ID, USER_ID, fakeEnv),
    ).rejects.toThrow(OrgNotDeletableError);
  });

  it('scrubs audit events for the organization', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ roles: ['ADMIN'] }] }) // SELECT member
      .mockResolvedValueOnce({ rows: [] }) // UPDATE audit_events
      .mockResolvedValueOnce({ rows: [] }) // SELECT insert_audit_event
      .mockResolvedValueOnce({ rows: [] }) // DELETE organization
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    await gdprService.deleteOrganization(ORG_ID, USER_ID, fakeEnv);

    const scrubCall = mockClient.query.mock.calls[2];
    expect(scrubCall[0]).toContain('UPDATE audit_events');
    expect(scrubCall[0]).toContain('org_deleted');
    expect(scrubCall[1]).toEqual([ORG_ID]);
  });
});
