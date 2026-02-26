import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSendMail = vi.fn();
const mockVerify = vi.fn();

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mockSendMail,
      verify: mockVerify,
    })),
  },
}));

import { createSmtpAdapter } from '../smtp.adapter.js';
import type { Env } from '../../../config/env.js';

const baseEnv = {
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: 587,
  SMTP_USER: 'user',
  SMTP_PASS: 'pass',
  SMTP_FROM: 'noreply@example.com',
  SMTP_SECURE: false,
} as Env;

describe('SMTP adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when SMTP_HOST is not configured', () => {
    const adapter = createSmtpAdapter({
      ...baseEnv,
      SMTP_HOST: undefined,
    } as Env);
    expect(adapter).toBeNull();
  });

  it('returns null when SMTP_FROM is not configured', () => {
    const adapter = createSmtpAdapter({
      ...baseEnv,
      SMTP_FROM: undefined,
    } as Env);
    expect(adapter).toBeNull();
  });

  it('sends email with correct parameters', async () => {
    mockSendMail.mockResolvedValueOnce({
      messageId: '<msg-123@example.com>',
      accepted: ['test@test.com'],
    });

    const adapter = createSmtpAdapter(baseEnv);
    expect(adapter).not.toBeNull();
    expect(adapter!.name).toBe('smtp');

    const result = await adapter!.send({
      to: 'test@test.com',
      from: 'noreply@example.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

    expect(result.messageId).toBe('<msg-123@example.com>');
    expect(result.accepted).toBe(true);
    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'noreply@example.com',
      to: 'test@test.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
      text: 'Hello',
      replyTo: undefined,
    });
  });

  it('verify returns true on success', async () => {
    mockVerify.mockResolvedValueOnce(true);

    const adapter = createSmtpAdapter(baseEnv);
    const result = await adapter!.verify();
    expect(result).toBe(true);
  });

  it('verify returns false on failure', async () => {
    mockVerify.mockRejectedValueOnce(new Error('Connection refused'));

    const adapter = createSmtpAdapter(baseEnv);
    const result = await adapter!.verify();
    expect(result).toBe(false);
  });
});
