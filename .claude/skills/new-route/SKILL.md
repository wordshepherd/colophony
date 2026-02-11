---
name: new-route
description: Scaffold a new ts-rest route with Fastify handler, Drizzle queries, and tests.
---

# /new-route

Scaffold a new ts-rest route with Fastify handler, Drizzle queries, and tests.

## What this skill does

1. Creates a ts-rest contract in `packages/api-contracts/src/`
2. Creates a Fastify route handler in `apps/api/src/routes/`
3. Wires the handler into the Fastify app
4. Creates a matching test file with RLS test cases

## Usage

```
/new-route files       # Create files route
/new-route payments    # Create payments route
/new-route <name>      # Create route with given name
```

## Instructions for Claude

When the user invokes `/new-route <name>`:

1. **Create the ts-rest contract** at `packages/api-contracts/src/<name>.ts`:

```typescript
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

export const <name>Contract = c.router({
  list: {
    method: 'GET',
    path: '/<name>s',
    query: z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(20),
    }),
    responses: {
      200: z.object({
        items: z.array(z.object({
          id: z.string().uuid(),
          // TODO: Add fields
          createdAt: z.string().datetime(),
        })),
        total: z.number(),
        page: z.number(),
        limit: z.number(),
        totalPages: z.number(),
      }),
    },
    summary: 'List <name>s with pagination',
  },

  getById: {
    method: 'GET',
    path: '/<name>s/:id',
    pathParams: z.object({ id: z.string().uuid() }),
    responses: {
      200: z.object({
        id: z.string().uuid(),
        // TODO: Add fields
        createdAt: z.string().datetime(),
      }),
      404: z.object({ message: z.string() }),
    },
    summary: 'Get a single <name> by ID',
  },
});
```

2. **Export from barrel** in `packages/api-contracts/src/index.ts`:
   - Add: `export { <name>Contract } from './<name>';`

3. **Create the route handler** at `apps/api/src/routes/<name>.route.ts`:

```typescript
import { initServer } from '@ts-rest/fastify';
import { <name>Contract } from '@colophony/api-contracts';
import { db } from '@colophony/db';
import { <name>s } from '@colophony/db/schema';
import { eq, count, desc } from 'drizzle-orm';

const s = initServer();

export const <name>Router = s.router(<name>Contract, {
  /**
   * List <name>s with pagination.
   * RLS automatically filters to current organization via pgPolicy.
   */
  list: async ({ query, request }) => {
    const { page, limit } = query;
    const offset = (page - 1) * limit;

    const [items, [{ total }]] = await Promise.all([
      request.db
        .select()
        .from(<name>s)
        .orderBy(desc(<name>s.createdAt))
        .limit(limit)
        .offset(offset),
      request.db
        .select({ total: count() })
        .from(<name>s),
    ]);

    return {
      status: 200 as const,
      body: {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Get a single <name> by ID.
   * RLS ensures user can only access <name>s in their org.
   */
  getById: async ({ params, request }) => {
    const [item] = await request.db
      .select()
      .from(<name>s)
      .where(eq(<name>s.id, params.id))
      .limit(1);

    if (!item) {
      return {
        status: 404 as const,
        body: { message: '<Name> not found' },
      };
    }

    return { status: 200 as const, body: item };
  },
});
```

4. **Register in app** — add to the Fastify app setup:
   - Import: `import { <name>Router } from './routes/<name>.route';`
   - Register with `s.registerRouter(...)` or the app's route registration pattern

5. **Create test file** at `apps/api/test/integration/<name>.route.spec.ts`:

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { db, withOrgContext } from '@colophony/db';
import { <name>s } from '@colophony/db/schema';
import { createOrg, createUserWithOrg } from '../utils/factories';
import { cleanDatabase, getTestDb, disconnectTestDb } from '../utils/test-context';

describe('<Name> Route - RLS', () => {
  const testDb = getTestDb();

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  describe('Organization isolation', () => {
    it('should only return <name>s for the current organization', async () => {
      // Arrange
      const org1 = await createOrg({ name: 'Org 1' });
      const org2 = await createOrg({ name: 'Org 2' });
      const user1 = await createUserWithOrg(org1.id, 'ADMIN');

      // TODO: Create test <name>s for each org

      // Act
      const results = await withOrgContext(testDb, org1.id, user1.id, async (tx) => {
        return tx.select().from(<name>s);
      });

      // Assert
      expect(results).toHaveLength(1);
      // TODO: Add specific assertions
    });

    it('should not allow access to another org\'s <name>s', async () => {
      // Arrange
      const org1 = await createOrg({ name: 'Org 1' });
      const org2 = await createOrg({ name: 'Org 2' });
      const user2 = await createUserWithOrg(org2.id, 'ADMIN');

      // TODO: Create a <name> in org1

      // Act
      const results = await withOrgContext(testDb, org2.id, user2.id, async (tx) => {
        return tx.select().from(<name>s);
      });

      // Assert - org2 should not see org1's data
      expect(results).toHaveLength(0);
    });
  });
});
```

6. **Create factory** (if needed) at `apps/api/test/utils/factories/<name>.factory.ts`

7. Inform the user what was created and remind them to:
   - Add any Zod schemas to `packages/api-contracts/src/`
   - Run `pnpm build` to verify TypeScript compiles
   - Run `pnpm test` to verify tests pass
