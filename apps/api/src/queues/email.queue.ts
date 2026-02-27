import { Queue } from 'bullmq';
import type { Env } from '../config/env.js';

export interface EmailJobData {
  emailSendId: string;
  orgId: string;
  to: string;
  from: string;
  templateName: string;
  templateData: Record<string, unknown>;
  replyTo?: string;
  tags?: Record<string, string>;
}

let queue: Queue<EmailJobData> | null = null;

function getQueue(env: Env): Queue<EmailJobData> {
  if (!queue) {
    queue = new Queue<EmailJobData>('email', {
      connection: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
      },
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: { age: 86_400 }, // 24 hours
        removeOnFail: { age: 604_800 }, // 7 days
      },
    });
  }
  return queue;
}

export async function enqueueEmail(
  env: Env,
  data: EmailJobData,
): Promise<void> {
  await getQueue(env).add('send', data, { jobId: data.emailSendId });
}

export function getEmailQueueInstance(): Queue<EmailJobData> | null {
  return queue;
}

export async function closeEmailQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
