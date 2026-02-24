/**
 * Integration tests for auditService.logDirect() and auditService.log()
 * against PostgreSQL with RLS policies enforced.
 *
 * Codex review finding #4: logDirect() was only unit-tested with mocked DB.
 * These tests exercise the actual service methods as app_user with RLS.
 *
 * Requires: postgres-test container running on port 5433
 * Config:   vitest.config.rls.ts sets DATABASE_URL → app_user test DB
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  auditEvents,
  pool as colophonyPool,
  type AuditEvent,
} from '@colophony/db';
import {
  AuditActions,
  AuditResources,
  type AuthAuditParams,
} from '@colophony/types';
import { auditService, serializeValue } from '../../services/audit.service';
import {
  globalSetup,
  getAdminPool,
  getAppPool,
  type DrizzleDb,
} from '../rls/helpers/db-setup';
import { withTestRls } from '../rls/helpers/rls-context';
import {
  createOrganization,
  createUser,
  createOrgMember,
} from '../rls/helpers/factories';
import { truncateAllTables } from '../rls/helpers/cleanup';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function adminDb(): DrizzleDb {
  return drizzle(getAdminPool());
}

/** Read all audit_events via admin (bypasses RLS). */
async function allAuditEvents(): Promise<AuditEvent[]> {
  return adminDb()
    .select()
    .from(auditEvents as any) as any;
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

let orgA: { id: string };
let orgB: { id: string };
let userA: { id: string };
let userB: { id: string };

const AUTH_FAILURE_ACTIONS = [
  AuditActions.AUTH_TOKEN_INVALID,
  AuditActions.AUTH_TOKEN_EXPIRED,
  AuditActions.AUTH_USER_NOT_PROVISIONED,
  AuditActions.AUTH_USER_DEACTIVATED,
] as const;

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await globalSetup();

  [orgA, orgB] = await Promise.all([
    createOrganization(),
    createOrganization(),
  ]);
  [userA, userB] = await Promise.all([createUser(), createUser()]);
  await Promise.all([
    createOrgMember(orgA.id, userA.id),
    createOrgMember(orgB.id, userB.id),
  ]);
});

beforeEach(async () => {
  // Truncate only audit_events between tests for isolation
  await getAdminPool().query('TRUNCATE audit_events RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await truncateAllTables();
  await colophonyPool.end();
});

// ===========================================================================
// 1. logDirect() — auth failure write path
// ===========================================================================

describe('logDirect() auth failure write path', () => {
  it.each(AUTH_FAILURE_ACTIONS)(
    'inserts %s event with correct fields',
    async (action) => {
      const params: AuthAuditParams = {
        action,
        resource: AuditResources.AUTH,
        ipAddress: '192.168.1.42',
        userAgent: 'TestAgent/1.0',
      };

      await auditService.logDirect(params);

      const rows = await allAuditEvents();
      expect(rows).toHaveLength(1);

      const row = rows[0];
      expect(row.action).toBe(action);
      expect(row.resource).toBe('auth');
      expect(row.ipAddress).toBe('192.168.1.42');
      expect(row.userAgent).toBe('TestAgent/1.0');
      expect(row.organizationId).toBeNull();
      expect(row.createdAt).toBeInstanceOf(Date);
    },
  );

  it('stores actorId when provided (AUTH_USER_DEACTIVATED)', async () => {
    await auditService.logDirect({
      action: AuditActions.AUTH_USER_DEACTIVATED,
      resource: AuditResources.AUTH,
      actorId: userA.id,
      ipAddress: '10.0.0.1',
    });

    const rows = await allAuditEvents();
    expect(rows).toHaveLength(1);
    expect(rows[0].actorId).toBe(userA.id);
  });

  it('rejects params with organizationId', async () => {
    await expect(
      auditService.logDirect({
        action: AuditActions.AUTH_TOKEN_INVALID,
        resource: AuditResources.AUTH,
        organizationId: orgA.id,
      } as AuthAuditParams),
    ).rejects.toThrow('logDirect must not include organizationId');

    // Verify nothing was written
    const rows = await allAuditEvents();
    expect(rows).toHaveLength(0);
  });
});

// ===========================================================================
// 2. logDirect() and RLS interaction
// ===========================================================================

describe('logDirect() and RLS interaction', () => {
  it('direct INSERT by app_user is denied (42501 — must use insert_audit_event function)', async () => {
    const appPool = getAppPool();
    const client = await appPool.connect();
    try {
      const result = client.query(
        `INSERT INTO audit_events (action, resource)
         VALUES ('AUTH_TOKEN_INVALID', 'auth')`,
      );
      await expect(result).rejects.toMatchObject({
        code: '42501', // insufficient_privilege
      });
    } finally {
      client.release();
    }
  });

  it('insert_audit_event() function succeeds for NULL-org events', async () => {
    const appPool = getAppPool();
    const client = await appPool.connect();
    try {
      await client.query(
        `SELECT insert_audit_event(
          'AUTH_TOKEN_INVALID'::varchar, 'auth'::varchar,
          NULL::uuid, NULL::uuid, NULL::uuid,
          NULL::text, NULL::text,
          '10.0.0.1'::varchar, 'TestAgent'::text,
          NULL::varchar, NULL::varchar, NULL::varchar
        )`,
      );

      // Verify via admin pool (app_user can SELECT audit_events within RLS)
      const { rows } = await getAdminPool().query(
        `SELECT action, resource, ip_address FROM audit_events WHERE action = 'AUTH_TOKEN_INVALID'`,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].ip_address).toBe('10.0.0.1');
    } finally {
      client.release();
    }
  });
});

// ===========================================================================
// 3. log() — org-scoped write via RLS transaction
// ===========================================================================

describe('log() org-scoped write via RLS transaction', () => {
  it('inserts event visible within same org context', async () => {
    await withTestRls({ orgId: orgA.id, userId: userA.id }, (tx: any) =>
      auditService.log(tx, {
        action: AuditActions.ORG_UPDATED,
        resource: AuditResources.ORGANIZATION,
        resourceId: orgA.id,
        actorId: userA.id,
        organizationId: orgA.id,
        ipAddress: '172.16.0.1',
      }),
    );

    // Verify via admin pool (bypasses RLS)
    const rows = await allAuditEvents();
    expect(rows).toHaveLength(1);
    expect(rows[0].organizationId).toBe(orgA.id);
    expect(rows[0].actorId).toBe(userA.id);
    expect(rows[0].action).toBe('ORG_UPDATED');
    expect(rows[0].resource).toBe('organization');

    // Also verify tenant isolation: org A event visible in org A context

    const orgARows = await withTestRls(
      { orgId: orgA.id, userId: userA.id },
      (tx) => tx.select().from(auditEvents as any),
    );
    expect(orgARows).toHaveLength(1);
    expect((orgARows[0] as any).id).toBe(rows[0].id);
  });

  it('org A audit event is invisible to org B (tenant isolation)', async () => {
    // Insert via org A

    await withTestRls({ orgId: orgA.id, userId: userA.id }, (tx: any) =>
      auditService.log(tx, {
        action: AuditActions.ORG_CREATED,
        resource: AuditResources.ORGANIZATION,
        actorId: userA.id,
        organizationId: orgA.id,
      }),
    );

    // Org B sees nothing
    const orgBRows = await withTestRls(
      { orgId: orgB.id, userId: userB.id },

      (tx) => tx.select().from(auditEvents as any),
    );
    expect(orgBRows).toHaveLength(0);
  });
});

// ===========================================================================
// 4. Transaction rollback atomicity
// ===========================================================================

describe('transaction rollback atomicity', () => {
  it('rolled-back audit event produces 0 rows', async () => {
    const appPool = getAppPool();
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT set_config($1, $2, true)', [
        'app.current_org',
        orgA.id,
      ]);
      await client.query('SELECT set_config($1, $2, true)', [
        'app.user_id',
        userA.id,
      ]);

      const tx = drizzle(client) as any;
      await auditService.log(tx, {
        action: AuditActions.ORG_DELETED,
        resource: AuditResources.ORGANIZATION,
        actorId: userA.id,
        organizationId: orgA.id,
      });

      // Rollback instead of commit
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    const rows = await allAuditEvents();
    expect(rows).toHaveLength(0);
  });
});

// ===========================================================================
// 5. Serialized values round-trip
// ===========================================================================

describe('serialized values round-trip', () => {
  it('serializeValue() output with [REDACTED] markers survives PostgreSQL text column', async () => {
    const sensitivePayload = {
      username: 'testuser',
      token: 'should-be-scrubbed',
      password: 'also-scrubbed',
      details: { nested: true },
    };

    const serialized = serializeValue(sensitivePayload);
    expect(serialized).toContain('[REDACTED]');
    expect(serialized).not.toContain('should-be-scrubbed');

    // Write via logDirect with newValue containing redacted data
    await auditService.logDirect({
      action: AuditActions.AUTH_TOKEN_INVALID,
      resource: AuditResources.AUTH,
      newValue: sensitivePayload,
      ipAddress: '127.0.0.1',
    });

    // Read back via admin
    const rows = await allAuditEvents();
    expect(rows).toHaveLength(1);
    expect(rows[0].newValue).toBe(serialized);

    // Parse and verify redaction markers survived the round-trip
    const parsed = JSON.parse(rows[0].newValue!);
    expect(parsed.username).toBe('testuser');
    expect(parsed.token).toBe('[REDACTED]');
    expect(parsed.password).toBe('[REDACTED]');
    expect(parsed.details).toEqual({ nested: true });
  });
});
