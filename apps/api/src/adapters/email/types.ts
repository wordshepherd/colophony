export interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  tags?: Record<string, string>;
}

export interface EmailSendResult {
  messageId: string | null;
  accepted: boolean;
}

export interface EmailAdapter {
  send(msg: EmailMessage): Promise<EmailSendResult>;
  verify(): Promise<boolean>;
  readonly name: string;
}
