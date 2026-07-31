import { describe, it, expect, vi } from 'vitest';
import { pipelineService } from './pipeline.service.js';
import { ForbiddenError } from './errors.js';
import type { ServiceContext } from './types.js';

function makeCtx(roles: string[]): ServiceContext {
  return {
    tx: {} as ServiceContext['tx'],
    actor: {
      userId: 'user-1',
      orgId: 'org-1',
      roles: roles as ServiceContext['actor']['roles'],
    },
    audit: vi.fn(),
  };
}

describe('pipeline.service', () => {
  describe('addCommentWithAudit', () => {
    it('rejects READER role', async () => {
      const ctx = makeCtx(['READER']);
      await expect(
        pipelineService.addCommentWithAudit(ctx, 'item-1', {
          content: 'test comment',
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('allows EDITOR role', async () => {
      const ctx = makeCtx(['EDITOR']);
      // Will fail with a different error (not ForbiddenError) because the
      // mock tx has no query capabilities — but it should NOT throw ForbiddenError
      await expect(
        pipelineService.addCommentWithAudit(ctx, 'item-1', {
          content: 'test comment',
        }),
      ).rejects.not.toThrow(ForbiddenError);
    });

    it('allows ADMIN role', async () => {
      const ctx = makeCtx(['ADMIN']);
      await expect(
        pipelineService.addCommentWithAudit(ctx, 'item-1', {
          content: 'test comment',
        }),
      ).rejects.not.toThrow(ForbiddenError);
    });
  });

  // ---------------------------------------------------------------------------
  // Org-id threading at the call site
  // ---------------------------------------------------------------------------

  /**
   * These assert that each `*WithAudit` wrapper hands `ctx.actor.orgId` to its
   * collaborator — the property the routers depend on, since they pass only a
   * ServiceContext and never an org id of their own.
   *
   * They say nothing about the WHERE clauses themselves. This spec's `tx` is
   * `{}`, so no query is ever assembled, let alone run. The predicates are proved
   * in `src/__tests__/rls/pipeline-service.test.ts`, which drives the service
   * over the RLS-bypassing admin pool where the WHERE clause is the only
   * isolation in play.
   *
   * This block previously asserted org scoping via `Function.prototype.length`
   * — `expect(pipelineService.updateStage.length).toBeGreaterThanOrEqual(4)` and
   * five siblings. Those were deleted rather than kept: arity cannot distinguish
   * a method that uses `orgId` from one that merely accepts it, which was the
   * exact state of `updateStage`'s UPDATE and of every `assign*` caller. They
   * passed throughout, which is part of why this went unnoticed.
   */
  describe('threads actor.orgId to the collaborator', () => {
    it('addCommentWithAudit → getById', async () => {
      const ctx = makeCtx(['EDITOR']);
      const getByIdSpy = vi.spyOn(pipelineService, 'getById');
      try {
        await pipelineService.addCommentWithAudit(ctx, 'item-1', {
          content: 'test',
        });
      } catch {
        // Expected: mock tx throws
      }
      expect(getByIdSpy).toHaveBeenCalledWith(ctx.tx, 'item-1', 'org-1');
      getByIdSpy.mockRestore();
    });

    it('updateStageWithAudit → getById', async () => {
      const ctx = makeCtx(['EDITOR']);
      const getByIdSpy = vi.spyOn(pipelineService, 'getById');
      try {
        await pipelineService.updateStageWithAudit(ctx, 'item-1', {
          stage: 'PROOFREAD',
        });
      } catch {
        // Expected: mock tx throws
      }
      expect(getByIdSpy).toHaveBeenCalledWith(ctx.tx, 'item-1', 'org-1');
      getByIdSpy.mockRestore();
    });

    it('assignCopyeditorWithAudit → assignCopyeditor', async () => {
      const ctx = makeCtx(['EDITOR']);
      const spy = vi.spyOn(pipelineService, 'assignCopyeditor');
      try {
        await pipelineService.assignCopyeditorWithAudit(ctx, 'item-1', {
          userId: 'user-2',
        });
      } catch {
        // Expected: mock tx throws
      }
      expect(spy).toHaveBeenCalledWith(
        ctx.tx,
        'item-1',
        { userId: 'user-2' },
        'org-1',
      );
      spy.mockRestore();
    });

    it('assignProofreaderWithAudit → assignProofreader', async () => {
      const ctx = makeCtx(['EDITOR']);
      const spy = vi.spyOn(pipelineService, 'assignProofreader');
      try {
        await pipelineService.assignProofreaderWithAudit(ctx, 'item-1', {
          userId: 'user-2',
        });
      } catch {
        // Expected: mock tx throws
      }
      expect(spy).toHaveBeenCalledWith(
        ctx.tx,
        'item-1',
        { userId: 'user-2' },
        'org-1',
      );
      spy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // Production dashboard
  // ---------------------------------------------------------------------------

  describe('dashboard', () => {
    it('returns null when no active issues exist', async () => {
      // Create a mock tx that returns empty results for the issue query
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      };

      const result = await pipelineService.dashboard(
        mockTx as unknown as ServiceContext['tx'],
        {},
        'org-1',
      );

      expect(result).toBeNull();
    });
  });
});
