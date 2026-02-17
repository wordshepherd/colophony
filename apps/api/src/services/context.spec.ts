import { describe, it, expect, vi } from 'vitest';
import type { DrizzleDb } from '@colophony/db';
import type { AuditFn } from './types.js';
import { toServiceContext } from './context.js';

describe('toServiceContext', () => {
  it('maps tRPC/Fastify context fields to ServiceContext', () => {
    const tx = {} as DrizzleDb;
    const audit: AuditFn = vi.fn();
    const ctx = {
      dbTx: tx,
      authContext: { userId: 'u1', orgId: 'o1', role: 'ADMIN' as const },
      audit,
    };

    const svc = toServiceContext(ctx);

    expect(svc.tx).toBe(tx);
    expect(svc.actor).toEqual({ userId: 'u1', orgId: 'o1', role: 'ADMIN' });
    expect(svc.audit).toBe(audit);
  });

  it('copies actor fields by value (not reference to authContext)', () => {
    const ctx = {
      dbTx: {} as DrizzleDb,
      authContext: { userId: 'u2', orgId: 'o2', role: 'EDITOR' as const },
      audit: vi.fn() as AuditFn,
    };

    const svc = toServiceContext(ctx);

    expect(svc.actor).not.toBe(ctx.authContext);
    expect(svc.actor.userId).toBe('u2');
    expect(svc.actor.orgId).toBe('o2');
    expect(svc.actor.role).toBe('EDITOR');
  });
});
