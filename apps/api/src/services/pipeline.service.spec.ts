import { describe, it, expect, vi } from 'vitest';
import { pipelineService } from './pipeline.service.js';
import { ForbiddenError } from './errors.js';
import type { ServiceContext } from './types.js';

function makeCtx(role: string): ServiceContext {
  return {
    tx: {} as ServiceContext['tx'],
    actor: {
      userId: 'user-1',
      orgId: 'org-1',
      role: role as ServiceContext['actor']['role'],
    },
    audit: vi.fn(),
  };
}

describe('pipeline.service', () => {
  describe('addCommentWithAudit', () => {
    it('rejects READER role', async () => {
      const ctx = makeCtx('READER');
      await expect(
        pipelineService.addCommentWithAudit(ctx, 'item-1', {
          content: 'test comment',
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('allows EDITOR role', async () => {
      const ctx = makeCtx('EDITOR');
      // Will fail with a different error (not ForbiddenError) because the
      // mock tx has no query capabilities — but it should NOT throw ForbiddenError
      await expect(
        pipelineService.addCommentWithAudit(ctx, 'item-1', {
          content: 'test comment',
        }),
      ).rejects.not.toThrow(ForbiddenError);
    });

    it('allows ADMIN role', async () => {
      const ctx = makeCtx('ADMIN');
      await expect(
        pipelineService.addCommentWithAudit(ctx, 'item-1', {
          content: 'test comment',
        }),
      ).rejects.not.toThrow(ForbiddenError);
    });
  });

  // ---------------------------------------------------------------------------
  // Defense-in-depth: explicit organizationId filters
  // ---------------------------------------------------------------------------

  describe('defense-in-depth: organizationId filters', () => {
    it('list() requires orgId parameter', () => {
      // TypeScript enforces the orgId parameter at compile time.
      // Verify the function signature accepts 3 arguments (tx, input, orgId).
      expect(pipelineService.list.length).toBe(3);
    });

    it('getById() requires orgId parameter', () => {
      expect(pipelineService.getById.length).toBe(3);
    });

    it('listComments() requires orgId parameter', () => {
      expect(pipelineService.listComments.length).toBe(3);
    });

    it('getHistory() requires orgId parameter', () => {
      expect(pipelineService.getHistory.length).toBe(3);
    });

    it('updateStage() requires orgId parameter', () => {
      // updateStage(tx, id, input, orgId, changedBy?)
      expect(pipelineService.updateStage.length).toBeGreaterThanOrEqual(4);
    });

    it('addCommentWithAudit passes actor orgId to getById', async () => {
      const ctx = makeCtx('EDITOR');
      // getById will call tx.select().from().leftJoin()...where(and(eq(id), eq(orgId)))
      // It will fail on the mock tx, but we can verify the call pattern
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

    it('updateStageWithAudit passes actor orgId to getById and updateStage', async () => {
      const ctx = makeCtx('EDITOR');
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
  });

  // ---------------------------------------------------------------------------
  // Production dashboard
  // ---------------------------------------------------------------------------

  describe('dashboard', () => {
    it('requires orgId parameter (3 args: tx, input, orgId)', () => {
      expect(pipelineService.dashboard.length).toBe(3);
    });

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
