import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockValues = vi.fn().mockResolvedValue(undefined);
const mockInsert = vi.fn(() => ({ values: mockValues }));

vi.mock('@colophony/db', () => ({
  auditEvents: { _: 'audit_events_table_ref' },
}));

import { auditService, serializeValue } from './audit.service.js';
import type { DrizzleDb } from '@colophony/db';
import type { AuditLogParams } from '@prospector/types';

function makeTx() {
  mockInsert.mockClear();
  mockValues.mockClear().mockResolvedValue(undefined);
  return { insert: mockInsert } as unknown as DrizzleDb;
}

describe('serializeValue', () => {
  it('returns null for null/undefined', () => {
    expect(serializeValue(null)).toBeNull();
    expect(serializeValue(undefined)).toBeNull();
  });

  it('serializes objects to JSON', () => {
    expect(serializeValue({ a: 1 })).toBe('{"a":1}');
  });

  it('serializes strings', () => {
    expect(serializeValue('hello')).toBe('"hello"');
  });

  it('scrubs secret keys', () => {
    const input = {
      email: 'test@example.com',
      password: 's3cret',
      accessToken: 'tok_123',
      authorization: 'Bearer xxx',
      secretKey: 'key_456',
    };
    const result = JSON.parse(serializeValue(input)!);
    expect(result.email).toBe('test@example.com');
    expect(result.password).toBe('[REDACTED]');
    expect(result.accessToken).toBe('[REDACTED]');
    expect(result.authorization).toBe('[REDACTED]');
    expect(result.secretKey).toBe('[REDACTED]');
  });

  it('truncates values exceeding 8KB', () => {
    const large = { data: 'x'.repeat(10_000) };
    const result = JSON.parse(serializeValue(large)!);
    expect(result._truncated).toBe(true);
    expect(result._originalSize).toBeGreaterThan(8192);
  });

  it('handles circular references without throwing', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    const result = JSON.parse(serializeValue(obj)!);
    expect(result.a).toBe(1);
    expect(result.self).toBe('[Circular]');
  });
});

describe('auditService.log', () => {
  let tx: DrizzleDb;

  beforeEach(() => {
    tx = makeTx();
  });

  it('inserts with all fields populated', async () => {
    const params: AuditLogParams = {
      resource: 'user',
      action: 'USER_CREATED',
      resourceId: 'res-1',
      actorId: 'actor-1',
      organizationId: 'org-1',
      oldValue: null,
      newValue: { email: 'alice@example.com' },
      ipAddress: '192.168.1.1',
      userAgent: 'TestAgent/1.0',
    };

    await auditService.log(tx, params);

    expect(mockInsert).toHaveBeenCalledOnce();
    expect(mockValues).toHaveBeenCalledOnce();
    const row = mockValues.mock.calls[0][0];
    expect(row.action).toBe('USER_CREATED');
    expect(row.resource).toBe('user');
    expect(row.resourceId).toBe('res-1');
    expect(row.actorId).toBe('actor-1');
    expect(row.organizationId).toBe('org-1');
    expect(row.oldValue).toBeNull();
    expect(JSON.parse(row.newValue)).toEqual({ email: 'alice@example.com' });
    expect(row.ipAddress).toBe('192.168.1.1');
    expect(row.userAgent).toBe('TestAgent/1.0');
  });

  it('inserts with null optional fields', async () => {
    const params: AuditLogParams = {
      resource: 'user',
      action: 'USER_DEACTIVATED',
    };

    await auditService.log(tx, params);

    const row = mockValues.mock.calls[0][0];
    expect(row.action).toBe('USER_DEACTIVATED');
    expect(row.resource).toBe('user');
    expect(row.resourceId).toBeUndefined();
    expect(row.actorId).toBeUndefined();
    expect(row.organizationId).toBeUndefined();
    expect(row.oldValue).toBeNull();
    expect(row.newValue).toBeNull();
    expect(row.ipAddress).toBeUndefined();
    expect(row.userAgent).toBeUndefined();
  });

  it('serializes object oldValue and newValue', async () => {
    const params: AuditLogParams = {
      resource: 'organization',
      action: 'ORG_UPDATED',
      oldValue: { name: 'Old Org' },
      newValue: { name: 'New Org' },
    };

    await auditService.log(tx, params);

    const row = mockValues.mock.calls[0][0];
    expect(JSON.parse(row.oldValue)).toEqual({ name: 'Old Org' });
    expect(JSON.parse(row.newValue)).toEqual({ name: 'New Org' });
  });

  it('propagates database errors', async () => {
    mockValues.mockRejectedValue(new Error('DB write failed'));

    const params: AuditLogParams = {
      resource: 'user',
      action: 'USER_CREATED',
    };

    await expect(auditService.log(tx, params)).rejects.toThrow(
      'DB write failed',
    );
  });
});
