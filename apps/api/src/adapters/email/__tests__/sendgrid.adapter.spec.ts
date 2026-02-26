import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sendgrid/mail', () => {
  const mockSend = vi.fn();
  const mockSetApiKey = vi.fn();
  return {
    default: {
      setApiKey: mockSetApiKey,
      send: mockSend,
    },
    __mockSend: mockSend,
    __mockSetApiKey: mockSetApiKey,
  };
});

import sgMail from '@sendgrid/mail';
import { createSendGridAdapter } from '../sendgrid.adapter.js';
import type { Env } from '../../../config/env.js';

// Access mocks through the module
const mockSend = (sgMail as unknown as { send: ReturnType<typeof vi.fn> }).send;

const baseEnv = {
  SENDGRID_API_KEY: 'SG.test-key',
  SENDGRID_FROM: 'noreply@example.com',
} as Env;

describe('SendGrid adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when SENDGRID_API_KEY is not configured', () => {
    const adapter = createSendGridAdapter({
      ...baseEnv,
      SENDGRID_API_KEY: undefined,
    } as Env);
    expect(adapter).toBeNull();
  });

  it('returns null when SENDGRID_FROM is not configured', () => {
    const adapter = createSendGridAdapter({
      ...baseEnv,
      SENDGRID_FROM: undefined,
    } as Env);
    expect(adapter).toBeNull();
  });

  it('sends email with correct parameters', async () => {
    mockSend.mockResolvedValueOnce([
      {
        statusCode: 202,
        headers: { 'x-message-id': 'sg-msg-123' },
      },
    ]);

    const adapter = createSendGridAdapter(baseEnv);
    expect(adapter).not.toBeNull();
    expect(adapter!.name).toBe('sendgrid');

    const result = await adapter!.send({
      to: 'test@test.com',
      from: 'noreply@example.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

    expect(result.messageId).toBe('sg-msg-123');
    expect(result.accepted).toBe(true);
  });

  it('verify always returns true', async () => {
    const adapter = createSendGridAdapter(baseEnv);
    const result = await adapter!.verify();
    expect(result).toBe(true);
  });
});
