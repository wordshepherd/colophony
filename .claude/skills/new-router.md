---
name: new-router
description: Scaffold a new tRPC router with proper RLS middleware and tests.
---

# /new-router

Scaffold a new tRPC router with proper RLS middleware and tests.

## What this skill does

1. Creates a new router file in `apps/api/src/trpc/routers/`
2. Uses `orgProcedure` for RLS-protected endpoints
3. Adds the router to the root `trpc.router.ts`
4. Creates a matching test file with RLS test cases

## Usage

```
/new-router files       # Create files router
/new-router payments    # Create payments router
/new-router <name>      # Create router with given name
```

## Instructions for Claude

When the user invokes `/new-router <name>`:

1. **Create the router file** at `apps/api/src/trpc/routers/<name>.router.ts`:

```typescript
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  router,
  orgProcedure,
  orgEditorProcedure,
} from '../trpc.service';

/**
 * <Name> router handles all <name>-related operations.
 * All procedures use orgProcedure which enforces RLS via withOrgContext.
 */
export const <name>Router = router({
  /**
   * List <name>s with pagination.
   * RLS automatically filters to current organization.
   */
  list: orgProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input, ctx }) => {
      const { page, limit } = input;

      const [items, total] = await Promise.all([
        ctx.prisma.<name>.findMany({
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        ctx.prisma.<name>.count(),
      ]);

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),

  /**
   * Get a single <name> by ID.
   * RLS ensures user can only access <name>s in their org.
   */
  getById: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const item = await ctx.prisma.<name>.findUnique({
        where: { id: input.id },
      });

      if (!item) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: '<Name> not found',
        });
      }

      return item;
    }),

  // Add more procedures as needed...
});

export type <Name>Router = typeof <name>Router;
```

2. **Add to root router** in `apps/api/src/trpc/trpc.router.ts`:
   - Add import: `import { <name>Router } from './routers/<name>.router';`
   - Add to router object: `<name>: <name>Router,`

3. **Create test file** at `apps/api/test/integration/<name>.router.spec.ts`:

```typescript
import { createContextHelpers } from '@prospector/db';
import {
  cleanDatabase,
  getAppPrisma,
  disconnectTestPrisma,
} from '../utils/test-context';
import { createOrg, createUserWithOrg } from '../utils/factories';

describe('<Name> Router - RLS', () => {
  const appPrisma = getAppPrisma();
  const { withOrgContext } = createContextHelpers(appPrisma);

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  describe('Organization isolation', () => {
    it('should only return <name>s for the current organization', async () => {
      // Arrange
      const org1 = await createOrg({ name: 'Org 1' });
      const org2 = await createOrg({ name: 'Org 2' });
      const user1 = await createUserWithOrg(org1.id, 'ADMIN');

      // TODO: Create test <name>s for each org

      // Act
      const results = await withOrgContext(org1.id, user1.id, async (tx) => {
        return tx.<name>.findMany();
      });

      // Assert
      expect(results).toHaveLength(1);
      // TODO: Add specific assertions
    });
  });
});
```

4. **Create factory** (if needed) at `apps/api/test/utils/factories/<name>.factory.ts`

5. **Export factory** from `apps/api/test/utils/factories/index.ts`

6. Inform the user what was created and remind them to:
   - Add any Zod schemas to `packages/types/src/index.ts`
   - Run `pnpm build` to verify TypeScript compiles
   - Run `pnpm test` to verify tests pass
