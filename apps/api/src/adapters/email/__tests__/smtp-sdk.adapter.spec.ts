import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SmtpEmailAdapter } from '../smtp-sdk.adapter.js';

const mockSendMail = vi.fn();
const mockVerify = vi.fn();
const mockClose = vi.fn();

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: (...args: unknown[]) => mockSendMail(...args),
      verify: () => mockVerify(),
      close: () => mockClose(),
    })),
  },
}));

describe('SmtpEmailAdapter', () => {
  let adapter: SmtpEmailAdapter;

  const baseConfig = {
    host: 'smtp.example.com',
    port: 587,
    secure: false,
    user: 'user@example.com',
    pass: 'password',
    from: 'noreply@example.com',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    adapter = new SmtpEmailAdapter();
    await adapter.initialize(baseConfig);
  });

  it('initialize creates transporter with auth config', async () => {
    const nodemailer = await import('nodemailer');
    expect(nodemailer.default.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: { user: 'user@example.com', pass: 'password' },
      }),
    );
  });

  it('initialize creates transporter without auth when user/pass omitted', async () => {
    const nodemailer = await import('nodemailer');
    vi.mocked(nodemailer.default.createTransport).mockClear();

    const noAuthAdapter = new SmtpEmailAdapter();
    await noAuthAdapter.initialize({
      host: 'smtp.example.com',
      from: 'a@b.com',
    });

    expect(nodemailer.default.createTransport).toHaveBeenCalledWith(
      expect.not.objectContaining({ auth: expect.anything() }),
    );
  });

  it('send returns success with messageId', async () => {
    mockSendMail.mockResolvedValueOnce({
      accepted: ['test@example.com'],
      messageId: '<abc@example.com>',
    });

    const result = await adapter.send({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('<abc@example.com>');
  });

  it('send returns success=false on sendMail rejection', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('Connection refused'));

    const result = await adapter.send({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Connection refused');
  });

  it('send maps array to field to comma-separated string', async () => {
    mockSendMail.mockResolvedValueOnce({
      accepted: ['a@b.com'],
      messageId: 'x',
    });

    await adapter.send({
      to: ['a@b.com', 'c@d.com'],
      subject: 'Test',
      html: '<p>Hi</p>',
    });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'a@b.com, c@d.com' }),
    );
  });

  it('send uses defaultFrom when options.from is undefined', async () => {
    mockSendMail.mockResolvedValueOnce({
      accepted: ['a@b.com'],
      messageId: 'x',
    });

    await adapter.send({
      to: 'a@b.com',
      subject: 'Test',
      html: '<p>Hi</p>',
    });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'noreply@example.com' }),
    );
  });

  it('send maps attachments to nodemailer format', async () => {
    mockSendMail.mockResolvedValueOnce({
      accepted: ['a@b.com'],
      messageId: 'x',
    });

    await adapter.send({
      to: 'a@b.com',
      subject: 'Test',
      html: '<p>Hi</p>',
      attachments: [
        {
          filename: 'file.pdf',
          content: Buffer.from('data'),
          contentType: 'application/pdf',
        },
      ],
    });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          {
            filename: 'file.pdf',
            content: Buffer.from('data'),
            contentType: 'application/pdf',
          },
        ],
      }),
    );
  });

  it('healthCheck returns healthy on verify success', async () => {
    mockVerify.mockResolvedValueOnce(true);

    const result = await adapter.healthCheck();
    expect(result.healthy).toBe(true);
  });

  it('healthCheck returns unhealthy on verify failure', async () => {
    mockVerify.mockRejectedValueOnce(new Error('Timeout'));

    const result = await adapter.healthCheck();
    expect(result.healthy).toBe(false);
    expect(result.message).toBe('Timeout');
  });

  it('destroy closes transporter', async () => {
    await adapter.destroy();
    expect(mockClose).toHaveBeenCalled();
  });

  it('configSchema rejects missing host', () => {
    const result = adapter.configSchema.safeParse({ from: 'a@b.com' });
    expect(result.success).toBe(false);
  });

  it('configSchema applies default port=587 and secure=false', () => {
    const result = adapter.configSchema.parse({
      host: 'smtp.test.com',
      from: 'a@b.com',
    });
    expect(result.port).toBe(587);
    expect(result.secure).toBe(false);
  });
});
