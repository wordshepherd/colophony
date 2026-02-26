import sgMail from '@sendgrid/mail';
import { z } from 'zod';
import type {
  EmailAdapter,
  SendEmailOptions,
  SendEmailResult,
  AdapterHealthResult,
} from '@colophony/plugin-sdk';

export class SendGridEmailAdapter implements EmailAdapter {
  readonly id = 'colophony-sendgrid';
  readonly name = 'SendGrid Email';
  readonly version = '1.0.0';
  readonly configSchema = z.object({
    apiKey: z.string().min(1),
    from: z.string().min(1),
  });

  private defaultFrom = '';

  async initialize(config: Record<string, unknown>): Promise<void> {
    const parsed = this.configSchema.parse(config);
    sgMail.setApiKey(parsed.apiKey);
    this.defaultFrom = parsed.from;
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    try {
      const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;

      const [response] = await sgMail.send({
        to,
        from: options.from ?? this.defaultFrom,
        subject: options.subject,
        html: options.html,
        text: options.text ?? undefined,
        replyTo: options.replyTo,
      });

      return {
        success: response?.statusCode >= 200 && response?.statusCode < 300,
        messageId: response?.headers?.['x-message-id'] ?? undefined,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async healthCheck(): Promise<AdapterHealthResult> {
    // SendGrid doesn't have a verify endpoint
    return { healthy: true, message: 'SendGrid API key configured' };
  }

  async destroy(): Promise<void> {
    // No-op
  }
}
