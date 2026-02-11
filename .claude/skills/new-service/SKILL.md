---
name: new-service
description: Scaffold a new service with Drizzle queries, config, and tests.
---

# /new-service

Scaffold a new service with Drizzle queries, config, and tests.

## What this skill does

1. Creates a service file in `apps/api/src/services/`
2. Creates unit tests with Vitest
3. Registers the service in the app's dependency setup

## Usage

```
/new-service notifications    # Create notifications service
/new-service analytics        # Create analytics service
/new-service <name>           # Create service with given name
```

## Instructions for Claude

When the user invokes `/new-service <name>`:

1. **Create the service file** at `apps/api/src/services/<name>.service.ts`:

```typescript
import { type FastifyInstance } from 'fastify';
import { db } from '@colophony/db';
import { env } from '../config/env';

export class <Name>Service {
  // For tenant-scoped operations, callers must provide a transaction
  // with SET LOCAL app.current_org already executed (via withOrgContext).
  // For non-tenant operations (e.g., system-level queries), db can be used directly.
  constructor(
    private readonly db: typeof db,
  ) {}

  /**
   * Check if the service is enabled.
   */
  isEnabled(): boolean {
    return true;
  }

  // Add service methods here...
  // Tenant-scoped methods should accept a `tx` parameter instead of using this.db:
  //   async findByOrg(tx: typeof db): Promise<...> { ... }
}

/**
 * Create and return a <Name>Service instance.
 * Call this during app bootstrap.
 */
export function create<Name>Service(db: typeof db): <Name>Service {
  return new <Name>Service(db);
}
```

2. **Create barrel export** — add to `apps/api/src/services/index.ts`:

```typescript
export { <Name>Service, create<Name>Service } from './<name>.service';
```

3. **Create unit test file** at `apps/api/test/unit/<name>.service.spec.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { <Name>Service } from '../../src/services/<name>.service';

describe('<Name>Service', () => {
  let service: <Name>Service;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    };

    service = new <Name>Service(mockDb);
  });

  describe('isEnabled', () => {
    it('should return true by default', () => {
      expect(service.isEnabled()).toBe(true);
    });
  });

  // Add more tests here...
});
```

4. **Register in app bootstrap** — wire the service into the Fastify app:
   - Import: `import { create<Name>Service } from './services/<name>.service';`
   - Create instance during app setup: `const <name>Service = create<Name>Service(db);`
   - Decorate Fastify if needed: `app.decorate('<name>Service', <name>Service);`

5. **Inform the user** what was created:

```
Created:
- apps/api/src/services/<name>.service.ts
- apps/api/test/unit/<name>.service.spec.ts

Updated:
- apps/api/src/services/index.ts

Next steps:
1. Add your service methods
2. Add tests for each method
3. Wire into routes that need this service
4. Run `pnpm build` to verify
5. Run `pnpm test` to check tests pass
```
