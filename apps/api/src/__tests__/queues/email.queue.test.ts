import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import { Queue } from 'bullmq';

// Mock metrics, sentry, logger
vi.mock('../../config/metrics.js', () => ({
  bullmqJobDuration: { observe: vi.fn() },
  bullmqJobTotal: { inc: vi.fn() },
}));
vi.mock('../../config/sentry.js', () => ({
  captureException: vi.fn(),
}));
vi.mock('../../config/logger.js', () => ({
  getLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock email template rendering
const mockRenderEmailTemplate = vi.fn();
const mockRenderCustomTemplate = vi.fn();
vi.mock('../../templates/email/index.js', () => ({
  renderEmailTemplate: (...args: unknown[]) => mockRenderEmailTemplate(...args),
  renderCustomTemplate: (...args: unknown[]) =>
    mockRenderCustomTemplate(...args),
}));

// Mock email template service (for custom org templates)
const mockGetActiveTemplate = vi.fn();
vi.mock('../../services/email-template.service.js', () => ({
  emailTemplateService: {
    getActiveTemplate: (...args: unknown[]) => mockGetActiveTemplate(...args),
  },
}));

import type { EmailJobData } from '../../queues/email.queue';
import { startEmailWorker, stopEmailWorker } from '../../workers/email.worker';
import { globalSetup } from '../rls/helpers/db-setup';
import { truncateAllTables } from '../rls/helpers/cleanup';
import { flushRedis, closeRedis, getRedisConfig } from './helpers/redis-setup';
import {
  waitForJobCompletion,
  waitForJobFailure,
  closeAllQueueEvents,
} from './helpers/job-helpers';
import {
  createMockEmailAdapter,
  createMockRegistry,
  createTestEnv,
} from './helpers/mock-adapters';
import {
  createOrganization,
  createUser,
  createOrgMember,
} from '../rls/helpers/factories';
import { createEmailSend } from './helpers/queue-factories';
import { emailSends, eq } from '@colophony/db';
import { drizzle } from 'drizzle-orm/node-postgres';
import { getAdminPool } from '../rls/helpers/db-setup';

function adminDb(): any {
  return drizzle(getAdminPool());
}

describe('email queue integration', () => {
  const env = createTestEnv();
  const mockEmailAdapter = createMockEmailAdapter();
  const mockRegistry = createMockRegistry({ email: mockEmailAdapter });
  let queue: Queue<EmailJobData>;

  beforeAll(async () => {
    await globalSetup();
    await flushRedis();
    startEmailWorker(env, mockRegistry as any);
    queue = new Queue<EmailJobData>('email', {
      connection: getRedisConfig(),
    });
  });

  afterAll(async () => {
    await stopEmailWorker();
    await queue.close();
    await closeAllQueueEvents();
    await closeRedis();
  });

  beforeEach(async () => {
    await truncateAllTables();
    vi.clearAllMocks();

    // Default: no custom template, use built-in
    mockGetActiveTemplate.mockResolvedValue(null);
    mockRenderEmailTemplate.mockReturnValue({
      html: '<p>Test email</p>',
      text: 'Test email',
      subject: 'Test Subject',
    });
  });

  it('enqueue → email_sends transitions QUEUED → SENDING → SENT', async () => {
    const org = await createOrganization();
    const user = await createUser();
    await createOrgMember(org.id, user.id);
    const emailSend = await createEmailSend(org.id, {
      recipientEmail: 'test@example.com',
      recipientUserId: user.id,
    });

    mockEmailAdapter.send.mockResolvedValue({
      success: true,
      messageId: 'provider-msg-001',
    });

    const jobData: EmailJobData = {
      emailSendId: emailSend.id,
      orgId: org.id,
      to: 'test@example.com',
      from: 'noreply@colophony.dev',
      templateName: 'submission-confirmation',
      templateData: { title: 'My Submission' },
    };

    await queue.add('send', jobData, { jobId: emailSend.id });
    await waitForJobCompletion(queue, emailSend.id);

    const db = adminDb();
    const [updated] = await db
      .select()
      .from(emailSends)
      .where(eq(emailSends.id, emailSend.id));

    expect(updated.status).toBe('SENT');
    expect(updated.providerMessageId).toBe('provider-msg-001');
    expect(updated.sentAt).toBeTruthy();
    expect(mockEmailAdapter.send).toHaveBeenCalledTimes(1);
  });

  it('marks FAILED on adapter error after retries exhausted', async () => {
    const org = await createOrganization();
    const user = await createUser();
    await createOrgMember(org.id, user.id);
    const emailSend = await createEmailSend(org.id);

    mockEmailAdapter.send.mockRejectedValue(
      new Error('SMTP connection refused'),
    );

    const jobData: EmailJobData = {
      emailSendId: emailSend.id,
      orgId: org.id,
      to: emailSend.recipientEmail,
      from: 'noreply@colophony.dev',
      templateName: 'submission-confirmation',
      templateData: { title: 'Test' },
    };

    await queue.add('send', jobData, {
      jobId: emailSend.id,
      attempts: 1,
      backoff: { type: 'fixed', delay: 100 },
    });
    await waitForJobFailure(queue, emailSend.id);

    // Allow onFailed callback to complete (it runs async after job failure)
    await new Promise((r) => setTimeout(r, 500));

    const db = adminDb();
    const [updated] = await db
      .select()
      .from(emailSends)
      .where(eq(emailSends.id, emailSend.id));

    expect(updated.status).toBe('FAILED');
    expect(updated.errorMessage).toContain('SMTP connection refused');
  });

  it('marks FAILED immediately on template render error (no retry)', async () => {
    const org = await createOrganization();
    const user = await createUser();
    await createOrgMember(org.id, user.id);
    const emailSend = await createEmailSend(org.id);

    mockRenderEmailTemplate.mockImplementation(() => {
      throw new Error('Invalid template variable');
    });

    const jobData: EmailJobData = {
      emailSendId: emailSend.id,
      orgId: org.id,
      to: emailSend.recipientEmail,
      from: 'noreply@colophony.dev',
      templateName: 'submission-confirmation',
      templateData: { title: 'Test' },
    };

    await queue.add('send', jobData, { jobId: emailSend.id });
    // Template errors don't throw — job completes (returns early)
    await waitForJobCompletion(queue, emailSend.id);

    const db = adminDb();
    const [updated] = await db
      .select()
      .from(emailSends)
      .where(eq(emailSends.id, emailSend.id));

    expect(updated.status).toBe('FAILED');
    expect(updated.errorMessage).toContain('Template render error');
    // Email adapter should NOT have been called
    expect(mockEmailAdapter.send).not.toHaveBeenCalled();
  });
});
