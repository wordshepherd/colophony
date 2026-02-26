import type { Env } from '../../config/env.js';
import type { EmailAdapter } from './types.js';
import { createSmtpAdapter } from './smtp.adapter.js';
import { createSendGridAdapter } from './sendgrid.adapter.js';

export type { EmailAdapter, EmailMessage, EmailSendResult } from './types.js';

export function createEmailAdapter(env: Env): EmailAdapter | null {
  switch (env.EMAIL_PROVIDER) {
    case 'smtp':
      return createSmtpAdapter(env);
    case 'sendgrid':
      return createSendGridAdapter(env);
    case 'none':
      return null;
  }
}
