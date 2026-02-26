import nodemailer from 'nodemailer';
import type { Env } from '../../config/env.js';
import type { EmailAdapter, EmailMessage, EmailSendResult } from './types.js';

export function createSmtpAdapter(env: Env): EmailAdapter | null {
  if (!env.SMTP_HOST || !env.SMTP_FROM) {
    return null;
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_SECURE,
    ...(env.SMTP_USER && env.SMTP_PASS
      ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } }
      : {}),
  });

  const defaultFrom = env.SMTP_FROM;

  return {
    name: 'smtp',

    async send(msg: EmailMessage): Promise<EmailSendResult> {
      const info = await transporter.sendMail({
        from: msg.from || defaultFrom,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        replyTo: msg.replyTo,
      });

      return {
        messageId: info.messageId ?? null,
        accepted: Array.isArray(info.accepted) && info.accepted.length > 0,
      };
    },

    async verify(): Promise<boolean> {
      try {
        await transporter.verify();
        return true;
      } catch {
        return false;
      }
    },
  };
}
