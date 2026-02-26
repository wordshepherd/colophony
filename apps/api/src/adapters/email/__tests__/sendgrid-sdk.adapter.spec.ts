import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SendGridEmailAdapter } from '../sendgrid-sdk.adapter.js';

const mockSgSend = vi.fn();
const mockSetApiKey = vi.fn();

vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: (...args: unknown[]) => mockSetApiKey(...args),
    send: (...args: unknown[]) => mockSgSend(...args),
  },
}));

describe('SendGridEmailAdapter', () => {
  let adapter: SendGridEmailAdapter;

  beforeEach(async () => {
    vi.clearAllMocks();
    adapter = new SendGridEmailAdapter();
    await adapter.initialize({
      apiKey: 'SG.test-key',
      from: 'noreply@example.com',
    });
  });

  it('initialize sets API key', () => {
    expect(mockSetApiKey).toHaveBeenCalledWith('SG.test-key');
  });

  it('send returns success with messageId from x-message-id header', async () => {
    mockSgSend.mockResolvedValueOnce([
      { statusCode: 202, headers: { 'x-message-id': 'sg-msg-123' } },
    ]);

    const result = await adapter.send({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('sg-msg-123');
  });

  it('send returns success=false on API error', async () => {
    mockSgSend.mockRejectedValueOnce(new Error('Forbidden'));

    const result = await adapter.send({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden');
  });

  it('healthCheck returns healthy', async () => {
    const result = await adapter.healthCheck();
    expect(result.healthy).toBe(true);
  });

  it('configSchema rejects missing apiKey', () => {
    const result = adapter.configSchema.safeParse({ from: 'a@b.com' });
    expect(result.success).toBe(false);
  });
});
