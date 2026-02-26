import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { z } from 'zod';
import type {
  EmailAdapter,
  SendEmailOptions,
  SendEmailResult,
  AdapterHealthResult,
} from '@colophony/plugin-sdk';

export class SmtpEmailAdapter implements EmailAdapter {
  readonly id = 'colophony-smtp';
  readonly name = 'SMTP Email';
  readonly version = '1.0.0';
  readonly configSchema = z.object({
    host: z.string(),
    port: z.coerce.number().int().positive().default(587),
    secure: z.boolean().default(false),
    user: z.string().optional(),
    pass: z.string().optional(),
    from: z.string(),
  });

  private transporter: Transporter | null = null;
  private defaultFrom = '';

  async initialize(config: Record<string, unknown>): Promise<void> {
    const parsed = this.configSchema.parse(config);
    this.defaultFrom = parsed.from;
    this.transporter = nodemailer.createTransport({
      host: parsed.host,
      port: parsed.port,
      secure: parsed.secure,
      ...(parsed.user && parsed.pass
        ? { auth: { user: parsed.user, pass: parsed.pass } }
        : {}),
    });
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    if (!this.transporter) {
      throw new Error('SmtpEmailAdapter not initialized');
    }

    try {
      const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;

      const info = await this.transporter.sendMail({
        from: options.from ?? this.defaultFrom,
        to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        attachments: options.attachments?.map(
          (a: {
            filename: string;
            content: Buffer | string;
            contentType?: string;
          }) => ({
            filename: a.filename,
            content: a.content,
            contentType: a.contentType,
          }),
        ),
      });

      return {
        success: Array.isArray(info.accepted) && info.accepted.length > 0,
        messageId: info.messageId ?? undefined,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async healthCheck(): Promise<AdapterHealthResult> {
    if (!this.transporter) {
      return { healthy: false, message: 'Not initialized' };
    }

    const start = Date.now();
    try {
      await this.transporter.verify();
      return {
        healthy: true,
        message: 'SMTP connection verified',
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        healthy: false,
        message: err instanceof Error ? err.message : 'Verification failed',
        latencyMs: Date.now() - start,
      };
    }
  }

  async destroy(): Promise<void> {
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
    }
  }
}
