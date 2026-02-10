import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private transporter!: Transporter<SMTPTransport.SentMessageInfo>;
  private config!: EmailConfig;
  private enabled: boolean = true;
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.config = {
      host: this.configService.get<string>('SMTP_HOST', ''),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: this.configService.get<boolean>('SMTP_SECURE', false),
      user: this.configService.get<string>('SMTP_USER', ''),
      password: this.configService.get<string>('SMTP_PASSWORD', ''),
      from: this.configService.get<string>('EMAIL_FROM', 'noreply@example.com'),
    };

    // Disable email in development if not configured
    if (!this.config.host || !this.config.user) {
      const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
      if (nodeEnv === 'development') {
        this.enabled = false;
        this.logger.warn(
          'Email disabled in development (SMTP_HOST not configured)',
        );
        return;
      }
    }

    this.createTransporter();
  }

  /**
   * Create the nodemailer transporter
   */
  private createTransporter(): void {
    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure, // true for 465, false for other ports
      auth: {
        user: this.config.user,
        pass: this.config.password,
      },
    });

    this.logger.log(
      `Email transporter configured: ${this.config.host}:${this.config.port}`,
    );
  }

  /**
   * Check if email service is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Verify SMTP connection
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified');
      return true;
    } catch (error) {
      this.logger.error('SMTP connection failed:', error);
      return false;
    }
  }

  /**
   * Send an email
   */
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    if (!this.enabled) {
      this.logger.warn(`Email disabled, would send to: ${options.to}`);
      this.logger.debug(`Subject: ${options.subject}`);
      // In development, log the email content for debugging
      if (this.configService.get('NODE_ENV') === 'development') {
        this.logger.debug(`HTML: ${options.html.substring(0, 200)}...`);
      }
      return {
        success: true,
        messageId: `dev-${Date.now()}`,
      };
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.config.from,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        attachments: options.attachments,
      });

      this.logger.log(`Email sent: ${info.messageId} to ${options.to}`);

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to send email to ${options.to}: ${errorMessage}`,
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send email to multiple recipients (BCC for privacy)
   */
  async sendBulkEmail(
    recipients: string[],
    subject: string,
    html: string,
    text?: string,
  ): Promise<SendEmailResult[]> {
    // Send individually to avoid exposing recipient list
    const results = await Promise.all(
      recipients.map((to) => this.sendEmail({ to, subject, html, text })),
    );

    const failed = results.filter((r) => !r.success);
    if (failed.length > 0) {
      this.logger.warn(
        `${failed.length}/${recipients.length} emails failed to send`,
      );
    }

    return results;
  }

  /**
   * Get the configured "from" address
   */
  getFromAddress(): string {
    return this.config.from;
  }
}
