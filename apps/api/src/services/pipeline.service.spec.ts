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
});
