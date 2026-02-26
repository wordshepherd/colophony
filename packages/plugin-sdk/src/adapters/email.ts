import type { BaseAdapter } from "./common.js";

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  metadata?: Record<string, string>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailAdapter extends BaseAdapter {
  send(options: SendEmailOptions): Promise<SendEmailResult>;
  sendBulk?(
    recipients: string[],
    options: Omit<SendEmailOptions, "to">,
  ): Promise<SendEmailResult[]>;
}
