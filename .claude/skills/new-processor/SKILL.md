---
name: new-processor
description: Scaffold a new BullMQ job processor with worker, service, queue setup, and tests.
---

# /new-processor

Scaffold a new BullMQ job processor with worker, service, queue setup, and tests.

## What this skill does

1. Creates a worker file in `apps/api/src/workers/`
2. Creates a service file for enqueuing jobs
3. Registers the queue in the queue setup module
4. Creates unit tests with Vitest

## Usage

```
/new-processor email-send        # Create email sending processor
/new-processor thumbnail         # Create thumbnail generation processor
/new-processor <name>            # Create processor with given name
```

## Instructions for Claude

When the user invokes `/new-processor <name>`:

1. **Add queue constant** to `apps/api/src/queues/constants.ts`:

```typescript
export const <NAME_UPPER>_QUEUE = '<name-kebab>-queue';
```

2. **Create the service file** at `apps/api/src/services/<name>.service.ts`:

```typescript
import { Queue } from 'bullmq';
import { env } from '../config/env';
import { <NAME_UPPER>_QUEUE } from '../queues/constants';

export interface <Name>JobData {
  id: string;
  // Define job data interface here
}

export interface <Name>JobResult {
  success: boolean;
  message?: string;
}

export class <Name>Service {
  private readonly enabled: boolean;
  private readonly queue: Queue<<Name>JobData>;

  constructor(queue: Queue<<Name>JobData>) {
    this.queue = queue;
    this.enabled = env.<NAME_UPPER>_ENABLED !== 'false';

    if (!this.enabled) {
      console.warn('<Name> processing is disabled');
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
      return null;
    }

    const job = await this.queue.add('<name>-process', data, {
      jobId: `<name>-${data.id}`,
      removeOnComplete: 100,
      removeOnFail: 50,
    });

    return job.id ?? null;
  }
}
```

3. **Create the worker file** at `apps/api/src/workers/<name>.worker.ts`:

```typescript
import { Worker, Job } from 'bullmq';
import { db } from '@colophony/db';
import { <NAME_UPPER>_QUEUE } from '../queues/constants';
import type { <Name>JobData, <Name>JobResult } from '../services/<name>.service';

export function create<Name>Worker(connection: { host: string; port: number; password?: string }): Worker {
  return new Worker<<Name>JobData, <Name>JobResult>(
    <NAME_UPPER>_QUEUE,
    async (job: Job<<Name>JobData>): Promise<<Name>JobResult> => {
      console.log(`Processing <name> job ${job.id}`);

      try {
        const { id } = job.data;

        // TODO: Implement job processing logic here
        await job.updateProgress(50);

        // TODO: Do the actual work with db

        await job.updateProgress(100);

        console.log(`Completed <name> job ${job.id}`);
        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`<Name> job ${job.id} failed: ${message}`);
        return { success: false, message };
      }
    },
    {
      connection,
      concurrency: 5,
    },
  );
}
```

4. **Register the queue** in `apps/api/src/queues/setup.ts` (or wherever queues are initialized):
   - Import: `import { <NAME_UPPER>_QUEUE } from './constants';`
   - Create queue: `const <name>Queue = new Queue(<NAME_UPPER>_QUEUE, { connection, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } } });`
   - Export: the queue instance and create the service

5. **Create test file** at `apps/api/test/unit/<name>.service.spec.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { <Name>Service } from '../../src/services/<name>.service';

describe('<Name>Service', () => {
  let service: <Name>Service;
  let mockQueue: { add: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockQueue = {
      add: vi.fn().mockResolvedValue({ id: 'job-123' }),
    };

    service = new <Name>Service(mockQueue as any);
  });

  describe('isEnabled', () => {
    it('should be enabled by default', () => {
      expect(service.isEnabled()).toBe(true);
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
  });
});
```

6. **Inform the user** what was created:

```
Created:
- apps/api/src/services/<name>.service.ts
- apps/api/src/workers/<name>.worker.ts
- apps/api/test/unit/<name>.service.spec.ts

Updated:
- apps/api/src/queues/constants.ts

Next steps:
1. Define your job data interface in the service
2. Implement the processing logic in the worker
3. Register the queue and worker during app bootstrap
4. Add more tests for your specific use case
5. Run `pnpm build` to verify
6. Run `pnpm test` to check tests pass
```
