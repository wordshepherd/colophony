import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface VerificationEmailData {
  userName: string;
  verificationUrl: string;
  expiresIn: string;
}

export interface PasswordResetEmailData {
  userName: string;
  resetUrl: string;
  expiresIn: string;
}

export interface SubmissionConfirmationData {
  userName: string;
  submissionTitle: string;
  submissionId: string;
  organizationName: string;
}

export interface SubmissionStatusChangeData {
  userName: string;
  submissionTitle: string;
  submissionId: string;
  previousStatus: string;
  newStatus: string;
  organizationName: string;
  comment?: string;
}

export interface PaymentConfirmationData {
  userName: string;
  submissionTitle: string;
  amount: string;
  currency: string;
  organizationName: string;
}

export interface InfectedFileAlertData {
  userName: string;
  fileName: string;
  submissionTitle: string;
  virusName: string;
}

@Injectable()
export class EmailTemplateService {
  private appName: string;
  private appUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.appName = this.configService.get<string>('APP_NAME', 'Prospector');
    this.appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );
  }

  /**
   * Email verification template
   */
  verificationEmail(data: VerificationEmailData): EmailTemplate {
    return {
      subject: `Verify your email address - ${this.appName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb;">Verify your email address</h1>
          <p>Hi ${this.escapeHtml(data.userName)},</p>
          <p>Thank you for signing up! Please verify your email address by clicking the button below:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${this.escapeHtml(data.verificationUrl)}"
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Verify Email Address
            </a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${this.escapeHtml(data.verificationUrl)}</p>
          <p>This link will expire in ${data.expiresIn}.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #666; font-size: 14px;">
            If you didn't create an account, you can safely ignore this email.
          </p>
        </body>
        </html>
      `,
      text: `
Verify your email address

Hi ${data.userName},

Thank you for signing up! Please verify your email address by clicking the link below:

${data.verificationUrl}

This link will expire in ${data.expiresIn}.

If you didn't create an account, you can safely ignore this email.
      `.trim(),
    };
  }

  /**
   * Password reset template
   */
  passwordResetEmail(data: PasswordResetEmailData): EmailTemplate {
    return {
      subject: `Reset your password - ${this.appName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb;">Reset your password</h1>
          <p>Hi ${this.escapeHtml(data.userName)},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${this.escapeHtml(data.resetUrl)}"
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${this.escapeHtml(data.resetUrl)}</p>
          <p>This link will expire in ${data.expiresIn}.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #666; font-size: 14px;">
            If you didn't request a password reset, you can safely ignore this email.
          </p>
        </body>
        </html>
      `,
      text: `
Reset your password

Hi ${data.userName},

We received a request to reset your password. Click the link below to create a new password:

${data.resetUrl}

This link will expire in ${data.expiresIn}.

If you didn't request a password reset, you can safely ignore this email.
      `.trim(),
    };
  }

  /**
   * Submission confirmation template
   */
  submissionConfirmationEmail(data: SubmissionConfirmationData): EmailTemplate {
    return {
      subject: `Submission received - ${data.organizationName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #16a34a;">Submission Received</h1>
          <p>Hi ${this.escapeHtml(data.userName)},</p>
          <p>Thank you for your submission! We have received:</p>
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Title:</strong> ${this.escapeHtml(data.submissionTitle)}</p>
            <p style="margin: 8px 0 0;"><strong>Reference ID:</strong> ${data.submissionId}</p>
          </div>
          <p>Our editorial team will review your submission and get back to you as soon as possible.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${this.appUrl}/submissions/${data.submissionId}"
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Submission
            </a>
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #666; font-size: 14px;">
            ${this.escapeHtml(data.organizationName)}
          </p>
        </body>
        </html>
      `,
      text: `
Submission Received

Hi ${data.userName},

Thank you for your submission! We have received:

Title: ${data.submissionTitle}
Reference ID: ${data.submissionId}

Our editorial team will review your submission and get back to you as soon as possible.

View your submission: ${this.appUrl}/submissions/${data.submissionId}

${data.organizationName}
      `.trim(),
    };
  }

  /**
   * Submission status change template
   */
  submissionStatusChangeEmail(data: SubmissionStatusChangeData): EmailTemplate {
    const statusColors: Record<string, string> = {
      ACCEPTED: '#16a34a',
      REJECTED: '#dc2626',
      UNDER_REVIEW: '#2563eb',
      HOLD: '#d97706',
    };

    const statusColor = statusColors[data.newStatus] || '#2563eb';

    return {
      subject: `Submission update: ${data.newStatus.toLowerCase().replace('_', ' ')} - ${data.organizationName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: ${statusColor};">Submission Update</h1>
          <p>Hi ${this.escapeHtml(data.userName)},</p>
          <p>The status of your submission has been updated:</p>
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Title:</strong> ${this.escapeHtml(data.submissionTitle)}</p>
            <p style="margin: 8px 0 0;"><strong>New Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${data.newStatus.replace('_', ' ')}</span></p>
            ${data.comment ? `<p style="margin: 8px 0 0;"><strong>Comment:</strong> ${this.escapeHtml(data.comment)}</p>` : ''}
          </div>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${this.appUrl}/submissions/${data.submissionId}"
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Submission
            </a>
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #666; font-size: 14px;">
            ${this.escapeHtml(data.organizationName)}
          </p>
        </body>
        </html>
      `,
      text: `
Submission Update

Hi ${data.userName},

The status of your submission has been updated:

Title: ${data.submissionTitle}
New Status: ${data.newStatus.replace('_', ' ')}
${data.comment ? `Comment: ${data.comment}` : ''}

View your submission: ${this.appUrl}/submissions/${data.submissionId}

${data.organizationName}
      `.trim(),
    };
  }

  /**
   * Payment confirmation template
   */
  paymentConfirmationEmail(data: PaymentConfirmationData): EmailTemplate {
    return {
      subject: `Payment confirmed - ${data.organizationName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #16a34a;">Payment Confirmed</h1>
          <p>Hi ${this.escapeHtml(data.userName)},</p>
          <p>Thank you for your payment! Your submission has been received.</p>
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Submission:</strong> ${this.escapeHtml(data.submissionTitle)}</p>
            <p style="margin: 8px 0 0;"><strong>Amount:</strong> ${data.amount} ${data.currency.toUpperCase()}</p>
          </div>
          <p>A receipt has been sent to your email address from Stripe.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #666; font-size: 14px;">
            ${this.escapeHtml(data.organizationName)}
          </p>
        </body>
        </html>
      `,
      text: `
Payment Confirmed

Hi ${data.userName},

Thank you for your payment! Your submission has been received.

Submission: ${data.submissionTitle}
Amount: ${data.amount} ${data.currency.toUpperCase()}

A receipt has been sent to your email address from Stripe.

${data.organizationName}
      `.trim(),
    };
  }

  /**
   * Infected file alert template
   */
  infectedFileAlertEmail(data: InfectedFileAlertData): EmailTemplate {
    return {
      subject: `Security alert: File quarantined - ${this.appName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #dc2626;">Security Alert</h1>
          <p>Hi ${this.escapeHtml(data.userName)},</p>
          <p>A file you uploaded has been quarantined because it may contain malicious content:</p>
          <div style="background-color: #fef2f2; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #fecaca;">
            <p style="margin: 0;"><strong>File:</strong> ${this.escapeHtml(data.fileName)}</p>
            <p style="margin: 8px 0 0;"><strong>Submission:</strong> ${this.escapeHtml(data.submissionTitle)}</p>
            <p style="margin: 8px 0 0;"><strong>Detected threat:</strong> ${this.escapeHtml(data.virusName)}</p>
          </div>
          <p>Please upload a clean version of this file to complete your submission.</p>
          <p>If you believe this is an error, please contact support.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #666; font-size: 14px;">
            This is an automated security alert from ${this.appName}.
          </p>
        </body>
        </html>
      `,
      text: `
Security Alert

Hi ${data.userName},

A file you uploaded has been quarantined because it may contain malicious content:

File: ${data.fileName}
Submission: ${data.submissionTitle}
Detected threat: ${data.virusName}

Please upload a clean version of this file to complete your submission.

If you believe this is an error, please contact support.

This is an automated security alert from ${this.appName}.
      `.trim(),
    };
  }

  /**
   * Escape HTML special characters to prevent XSS
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  }
}
