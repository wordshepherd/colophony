---
name: new-processor
description: Scaffold a new BullMQ job processor with service, processor, queue registration, and tests.
---

# /new-processor

Scaffold a new BullMQ job processor with service, processor, queue registration, and tests.

## What this skill does

1. Creates a processor file in `apps/api/src/modules/jobs/processors/`
2. Creates a service file for the job logic
3. Registers the queue in `jobs.module.ts`
4. Creates unit tests for the processor
5. Exports from the jobs module

## Usage

```
/new-processor email-send        # Create email sending processor
/new-processor thumbnail         # Create thumbnail generation processor
/new-processor <name>            # Create processor with given name
```

## Instructions for Claude

When the user invokes `/new-processor <name>`:

1. **Add queue constant** to `apps/api/src/modules/jobs/jobs.constants.ts` (create if not exists):

```typescript
export const <NAME_UPPER>_QUEUE = '<name-kebab>-queue';
```

2. **Create the service file** at `apps/api/src/modules/jobs/services/<name>.service.ts`:

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { <NAME_UPPER>_QUEUE } from '../jobs.constants';

export interface <Name>JobData {
  // Define job data interface here
  id: string;
}

export interface <Name>JobResult {
  success: boolean;
  message?: string;
}

@Injectable()
export class <Name>Service implements OnModuleInit {
  private readonly logger = new Logger(<Name>Service.name);
  private enabled = false;

  constructor(
    @InjectQueue(<NAME_UPPER>_QUEUE)
    private readonly queue: Queue<<Name>JobData>,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    // Configure based on environment
    const shouldEnable = this.configService.get<string>('<NAME_UPPER>_ENABLED', 'true') === 'true';
    this.enabled = shouldEnable;

    if (!this.enabled) {
      this.logger.warn('<Name> processing is disabled');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Queue a new <name> job.
   */
  async queueJob(data: <Name>JobData): Promise<string | null> {
    if (!this.enabled) {
      this.logger.debug(`<Name> disabled, skipping job for ${data.id}`);
      return null;
    }

    const job = await this.queue.add('<name>-process', data, {
      jobId: `<name>-${data.id}`,
      removeOnComplete: 100,
      removeOnFail: 50,
    });

    this.logger.log(`Queued <name> job ${job.id} for ${data.id}`);
    return job.id ?? null;
  }
}
```

3. **Create the processor file** at `apps/api/src/modules/jobs/processors/<name>.processor.ts`:

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { prisma } from '@prospector/db';
import { <NAME_UPPER>_QUEUE } from '../jobs.constants';
import { <Name>JobData, <Name>JobResult } from '../services/<name>.service';

@Processor(<NAME_UPPER>_QUEUE)
export class <Name>Processor extends WorkerHost {
  private readonly logger = new Logger(<Name>Processor.name);

  async process(job: Job<<Name>JobData>): Promise<<Name>JobResult> {
    this.logger.log(`Processing <name> job ${job.id}`);

    try {
      const { id } = job.data;

      // TODO: Implement job processing logic here
      this.logger.log(`Processing item ${id}`);

      // Example: Update progress
      await job.updateProgress(50);

      // TODO: Do the actual work

      await job.updateProgress(100);

      this.logger.log(`Completed <name> job ${job.id}`);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`<Name> job ${job.id} failed: ${message}`);
      return { success: false, message };
    }
  }
}
```

4. **Register in jobs.module.ts** at `apps/api/src/modules/jobs/jobs.module.ts`:
   - Add import for constant: `import { <NAME_UPPER>_QUEUE } from './jobs.constants';`
   - Add import for service: `import { <Name>Service } from './services/<name>.service';`
   - Add import for processor: `import { <Name>Processor } from './processors/<name>.processor';`
   - Add queue registration:
     ```typescript
     BullModule.registerQueue({
       name: <NAME_UPPER>_QUEUE,
       defaultJobOptions: {
         attempts: 3,
         backoff: {
           type: 'exponential',
           delay: 5000,
         },
       },
     }),
     ```
   - Add to providers: `<Name>Service, <Name>Processor`
   - Add to exports: `<Name>Service`

5. **Create test file** at `apps/api/test/unit/<name>.processor.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { <Name>Service } from '../../src/modules/jobs/services/<name>.service';
import { <NAME_UPPER>_QUEUE } from '../../src/modules/jobs/jobs.constants';

describe('<Name>Service', () => {
  let service: <Name>Service;
  let mockQueue: { add: jest.Mock };
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    };

    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          '<NAME_UPPER>_ENABLED': 'true',
        };
        return config[key] ?? defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        <Name>Service,
        {
          provide: getQueueToken(<NAME_UPPER>_QUEUE),
          useValue: mockQueue,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<<Name>Service>(<Name>Service);
    service.onModuleInit();
  });

  describe('isEnabled', () => {
    it('should be enabled by default', () => {
      expect(service.isEnabled()).toBe(true);
    });

    it('should be disabled when config says so', async () => {
      mockConfigService.get = jest.fn((key: string, defaultValue?: string) => {
        if (key === '<NAME_UPPER>_ENABLED') return 'false';
        return defaultValue;
      }) as typeof mockConfigService.get;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          <Name>Service,
          { provide: getQueueToken(<NAME_UPPER>_QUEUE), useValue: mockQueue },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const disabledService = module.get<<Name>Service>(<Name>Service);
      disabledService.onModuleInit();

      expect(disabledService.isEnabled()).toBe(false);
    });
  });

  describe('queueJob', () => {
    it('should queue a job when enabled', async () => {
      const result = await service.queueJob({ id: 'test-123' });

      expect(result).toBe('job-123');
      expect(mockQueue.add).toHaveBeenCalledWith(
        '<name>-process',
        { id: 'test-123' },
        expect.objectContaining({
          jobId: '<name>-test-123',
        }),
      );
    });

    it('should return null when disabled', async () => {
      mockConfigService.get = jest.fn(() => 'false') as typeof mockConfigService.get;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          <Name>Service,
          { provide: getQueueToken(<NAME_UPPER>_QUEUE), useValue: mockQueue },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const disabledService = module.get<<Name>Service>(<Name>Service);
      disabledService.onModuleInit();

      const result = await disabledService.queueJob({ id: 'test-123' });

      expect(result).toBeNull();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });
});
```

6. **Inform the user** what was created:

```
Created the following files:
- apps/api/src/modules/jobs/services/<name>.service.ts
- apps/api/src/modules/jobs/processors/<name>.processor.ts
- apps/api/test/unit/<name>.processor.spec.ts

Updated:
- apps/api/src/modules/jobs/jobs.constants.ts
- apps/api/src/modules/jobs/jobs.module.ts

Next steps:
1. Define your job data interface in the service
2. Implement the processing logic in the processor
3. Add more tests for your specific use case
4. Run `pnpm build` to verify
5. Run `pnpm test` to check tests pass
```
