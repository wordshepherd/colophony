import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExecute = vi.fn().mockResolvedValue(undefined);

const { mockDbExecute } = vi.hoisted(() => {
  const mockDbExecute = vi.fn().mockResolvedValue(undefined);
  return { mockDbExecute };
});

vi.mock('@colophony/db', () => ({
  auditEvents: { _: 'audit_events_table_ref' },
  db: { execute: mockDbExecute },
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      _tag: 'sql',
      strings,
      values,
    }),
    { raw: (s: string) => ({ _tag: 'sql_raw', value: s }) },
  ),
}));

import { auditService, serializeValue } from './audit.service.js';
import type { DrizzleDb } from '@colophony/db';
import type { AuditLogParams } from '@colophony/types';

function makeTx() {
  mockExecute.mockClear().mockResolvedValue(undefined);
  return { execute: mockExecute } as unknown as DrizzleDb;
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

  it('calls insert_audit_event() via tx.execute with all fields', async () => {
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
      requestId: 'req-abc',
      method: 'POST',
      route: '/api/users',
    };

    await auditService.log(tx, params);

    expect(mockExecute).toHaveBeenCalledOnce();
    const sqlObj = mockExecute.mock.calls[0][0];
    expect(sqlObj._tag).toBe('sql');
    // Verify key values are in the sql template values
    expect(sqlObj.values).toContain('USER_CREATED');
    expect(sqlObj.values).toContain('user');
    expect(sqlObj.values).toContain('res-1');
    expect(sqlObj.values).toContain('actor-1');
    expect(sqlObj.values).toContain('org-1');
    expect(sqlObj.values).toContain('192.168.1.1');
    expect(sqlObj.values).toContain('TestAgent/1.0');
    expect(sqlObj.values).toContain('req-abc');
    expect(sqlObj.values).toContain('POST');
    expect(sqlObj.values).toContain('/api/users');
  });

  it('passes null for omitted optional fields', async () => {
    const params: AuditLogParams = {
      resource: 'user',
      action: 'USER_DEACTIVATED',
    };

    await auditService.log(tx, params);

    expect(mockExecute).toHaveBeenCalledOnce();
    const sqlObj = mockExecute.mock.calls[0][0];
    expect(sqlObj.values).toContain('USER_DEACTIVATED');
    expect(sqlObj.values).toContain('user');
    // Optional fields should be null
    const nullCount = sqlObj.values.filter((v: unknown) => v === null).length;
    expect(nullCount).toBeGreaterThanOrEqual(8); // resourceId, actorId, orgId, oldValue, newValue, ipAddress, userAgent + correlation
  });

  it('serializes object oldValue and newValue', async () => {
    const params: AuditLogParams = {
      resource: 'organization',
      action: 'ORG_UPDATED',
      oldValue: { name: 'Old Org' },
      newValue: { name: 'New Org' },
    };

    await auditService.log(tx, params);

    const sqlObj = mockExecute.mock.calls[0][0];
    expect(sqlObj.values).toContain('{"name":"Old Org"}');
    expect(sqlObj.values).toContain('{"name":"New Org"}');
  });

  it('propagates database errors', async () => {
    mockExecute.mockRejectedValue(new Error('DB write failed'));

    const params: AuditLogParams = {
      resource: 'user',
      action: 'USER_CREATED',
    };

    await expect(auditService.log(tx, params)).rejects.toThrow(
      'DB write failed',
    );
  });
});

describe('auditService.logDirect', () => {
  beforeEach(() => {
    mockDbExecute.mockClear().mockResolvedValue(undefined);
  });

  it('calls insert_audit_event() via db.execute with correct fields', async () => {
    const params: AuditLogParams = {
      resource: 'auth',
      action: 'AUTH_TOKEN_INVALID',
      ipAddress: '10.0.0.1',
      userAgent: 'TestAgent/2.0',
      newValue: { reason: 'invalid_header_format' },
      requestId: 'req-xyz',
      method: 'GET',
      route: '/protected',
    };

    await auditService.logDirect(params);

    expect(mockDbExecute).toHaveBeenCalledOnce();
    const sqlObj = mockDbExecute.mock.calls[0][0];
    expect(sqlObj._tag).toBe('sql');
    expect(sqlObj.values).toContain('AUTH_TOKEN_INVALID');
    expect(sqlObj.values).toContain('auth');
    expect(sqlObj.values).toContain('10.0.0.1');
    expect(sqlObj.values).toContain('TestAgent/2.0');
    expect(sqlObj.values).toContain('req-xyz');
    expect(sqlObj.values).toContain('GET');
    expect(sqlObj.values).toContain('/protected');
  });

  it('applies serializeValue to values', async () => {
    const params: AuditLogParams = {
      resource: 'auth',
      action: 'AUTH_USER_DEACTIVATED',
      oldValue: { name: 'before' },
      newValue: { reason: 'deactivated', secretToken: 'should-redact' },
    };

    await auditService.logDirect(params);

    const sqlObj = mockDbExecute.mock.calls[0][0];
    // Find the serialized newValue in the values array
    const newValStr = sqlObj.values.find(
      (v: unknown) => typeof v === 'string' && v.includes('deactivated'),
    );
    expect(newValStr).toBeDefined();
    const parsed = JSON.parse(newValStr);
    expect(parsed.reason).toBe('deactivated');
    expect(parsed.secretToken).toBe('[REDACTED]');
  });

  it('rejects organizationId to prevent misuse outside RLS context', async () => {
    const params = {
      resource: 'auth' as const,
      action: 'AUTH_TOKEN_INVALID' as const,
      organizationId: 'org-should-not-be-here',
    };

    await expect(auditService.logDirect(params)).rejects.toThrow(
      'logDirect must not include organizationId',
    );
    expect(mockDbExecute).not.toHaveBeenCalled();
  });

  it('propagates insertion errors', async () => {
    mockDbExecute.mockRejectedValue(new Error('connection refused'));

    const params: AuditLogParams = {
      resource: 'auth',
      action: 'AUTH_TOKEN_EXPIRED',
    };

    await expect(auditService.logDirect(params)).rejects.toThrow(
      'connection refused',
    );
  });
});
