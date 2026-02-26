import sgMail from '@sendgrid/mail';
import type { Env } from '../../config/env.js';
import type { EmailAdapter, EmailMessage, EmailSendResult } from './types.js';

export function createSendGridAdapter(env: Env): EmailAdapter | null {
  if (!env.SENDGRID_API_KEY || !env.SENDGRID_FROM) {
    return null;
  }

  sgMail.setApiKey(env.SENDGRID_API_KEY);
  const defaultFrom = env.SENDGRID_FROM;

  return {
    name: 'sendgrid',

    async send(msg: EmailMessage): Promise<EmailSendResult> {
      const [response] = await sgMail.send({
        to: msg.to,
        from: msg.from || defaultFrom,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        replyTo: msg.replyTo,
      });

      return {
        messageId: response?.headers?.['x-message-id'] ?? null,
        accepted: response?.statusCode >= 200 && response?.statusCode < 300,
      };
    },

    async verify(): Promise<boolean> {
      // SendGrid doesn't have a verify endpoint; return true if API key is configured
      return true;
    },
  };
}
