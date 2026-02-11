---
name: new-module
description: Scaffold a new NestJS module with service, controller, tests, and barrel exports.
---

# /new-module

Scaffold a new NestJS module with service, controller, tests, and barrel exports.

## What this skill does

1. Creates a new module directory in `apps/api/src/modules/`
2. Creates the module file with proper NestJS decorators
3. Creates a service with basic CRUD operations
4. Creates unit tests for the service
5. Creates a barrel export (index.ts)
6. Registers the module in `app.module.ts`

## Usage

```
/new-module notifications    # Create notifications module
/new-module analytics        # Create analytics module
/new-module <name>           # Create module with given name
```

## Options

- `--global` - Makes the module global (available everywhere without importing)
- `--no-controller` - Skip creating a controller (for service-only modules)

## Instructions for Claude

When the user invokes `/new-module <name>`:

1. **Create the module directory**: `apps/api/src/modules/<name>/`

2. **Create the module file** at `apps/api/src/modules/<name>/<name>.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { <Name>Service } from './<name>.service';

@Module({
  providers: [<Name>Service],
  exports: [<Name>Service],
})
export class <Name>Module {}
```

If `--global` flag is provided, add `@Global()` decorator:

```typescript
import { Global, Module } from '@nestjs/common';
import { <Name>Service } from './<name>.service';

@Global()
@Module({
  providers: [<Name>Service],
  exports: [<Name>Service],
})
export class <Name>Module {}
```

3. **Create the service file** at `apps/api/src/modules/<name>/<name>.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class <Name>Service {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Check if the service is enabled.
   * Override this in subclass or modify based on config.
   */
  isEnabled(): boolean {
    return true;
  }

  // Add service methods here...
}
```

4. **Create barrel export** at `apps/api/src/modules/<name>/index.ts`:

```typescript
export { <Name>Module } from './<name>.module';
export { <Name>Service } from './<name>.service';
```

5. **Create unit test file** at `apps/api/test/unit/<name>.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { <Name>Service } from '../../src/modules/<name>/<name>.service';

describe('<Name>Service', () => {
  let service: <Name>Service;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          // Add default config values here
        };
        return config[key] ?? defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        <Name>Service,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<<Name>Service>(<Name>Service);
  });

  describe('isEnabled', () => {
    it('should return true by default', () => {
      expect(service.isEnabled()).toBe(true);
    });
  });

  // Add more tests here...
});
```

6. **Register in app.module.ts**:
   - Add import: `import { <Name>Module } from './modules/<name>';`
   - Add to imports array: `<Name>Module,`

7. **Inform the user** what was created and remind them to:
   - Add any types to `packages/types/src/index.ts`
   - Run `pnpm build` to verify TypeScript compiles
   - Run `pnpm test` to verify tests pass

## Example Output

```
Created the following files:
- apps/api/src/modules/notifications/notifications.module.ts
- apps/api/src/modules/notifications/notifications.service.ts
- apps/api/src/modules/notifications/index.ts
- apps/api/test/unit/notifications.service.spec.ts

Updated:
- apps/api/src/app.module.ts

Next steps:
1. Add your service methods to notifications.service.ts
2. Add tests in notifications.service.spec.ts
3. Run `pnpm build` to verify
4. Run `pnpm test` to check tests pass
```
