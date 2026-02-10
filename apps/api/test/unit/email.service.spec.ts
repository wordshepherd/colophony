import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../src/modules/email/email.service';
import { EmailTemplateService } from '../../src/modules/email/email-template.service';

describe('EmailService', () => {
  let service: EmailService;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          SMTP_HOST: '', // Empty to disable in dev
          SMTP_PORT: 587,
          SMTP_SECURE: false,
          SMTP_USER: '',
          SMTP_PASSWORD: '',
          EMAIL_FROM: 'noreply@test.com',
          NODE_ENV: 'development',
        };
        return config[key] ?? defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    service.onModuleInit();
  });

  describe('isEnabled', () => {
    it('should be disabled in development when SMTP_HOST is not set', () => {
      expect(service.isEnabled()).toBe(false);
    });

    it('should be enabled when SMTP_HOST is configured', async () => {
      mockConfigService.get = jest.fn((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          SMTP_HOST: 'smtp.test.com',
          SMTP_PORT: 587,
          SMTP_SECURE: false,
          SMTP_USER: 'user',
          SMTP_PASSWORD: 'pass',
          EMAIL_FROM: 'noreply@test.com',
          NODE_ENV: 'production',
        };
        return config[key] ?? defaultValue;
      }) as unknown as typeof mockConfigService.get;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const enabledService = module.get<EmailService>(EmailService);
      enabledService.onModuleInit();

      expect(enabledService.isEnabled()).toBe(true);
    });
  });

  describe('sendEmail (disabled mode)', () => {
    it('should return success with dev messageId when disabled', async () => {
      const result = await service.sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
        text: 'Test content',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toMatch(/^dev-\d+$/);
    });

    it('should handle multiple recipients', async () => {
      const result = await service.sendEmail({
        to: ['user1@example.com', 'user2@example.com'],
        subject: 'Test Subject',
        html: '<p>Test content</p>',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('sendBulkEmail (disabled mode)', () => {
    it('should return results for each recipient', async () => {
      const results = await service.sendBulkEmail(
        ['user1@example.com', 'user2@example.com', 'user3@example.com'],
        'Bulk Test',
        '<p>Bulk content</p>',
        'Bulk content',
      );

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
    });
  });

  describe('getFromAddress', () => {
    it('should return configured from address', () => {
      expect(service.getFromAddress()).toBe('noreply@test.com');
    });
  });
});

describe('EmailTemplateService', () => {
  let service: EmailTemplateService;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          APP_NAME: 'Test App',
          APP_URL: 'http://localhost:3000',
        };
        return config[key] ?? defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailTemplateService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EmailTemplateService>(EmailTemplateService);
  });

  describe('verificationEmail', () => {
    it('should generate verification email template', () => {
      const template = service.verificationEmail({
        userName: 'John',
        verificationUrl: 'http://localhost:3000/verify?token=abc123',
        expiresIn: '24 hours',
      });

      expect(template.subject).toContain('Verify your email');
      expect(template.html).toContain('John');
      expect(template.html).toContain('http://localhost:3000/verify?token=abc123');
      expect(template.html).toContain('24 hours');
      expect(template.text).toContain('John');
      expect(template.text).toContain('http://localhost:3000/verify?token=abc123');
    });

    it('should escape HTML in user name', () => {
      const template = service.verificationEmail({
        userName: '<script>alert("xss")</script>',
        verificationUrl: 'http://localhost:3000/verify',
        expiresIn: '24 hours',
      });

      expect(template.html).not.toContain('<script>');
      expect(template.html).toContain('&lt;script&gt;');
    });
  });

  describe('passwordResetEmail', () => {
    it('should generate password reset email template', () => {
      const template = service.passwordResetEmail({
        userName: 'Jane',
        resetUrl: 'http://localhost:3000/reset?token=xyz789',
        expiresIn: '1 hour',
      });

      expect(template.subject).toContain('Reset your password');
      expect(template.html).toContain('Jane');
      expect(template.html).toContain('http://localhost:3000/reset?token=xyz789');
      expect(template.text).toContain('1 hour');
    });
  });

  describe('submissionConfirmationEmail', () => {
    it('should generate submission confirmation email template', () => {
      const template = service.submissionConfirmationEmail({
        userName: 'Author',
        submissionTitle: 'My Great Story',
        submissionId: 'sub-123',
        organizationName: 'Literary Magazine',
      });

      expect(template.subject).toContain('Submission received');
      expect(template.html).toContain('Author');
      expect(template.html).toContain('My Great Story');
      expect(template.html).toContain('sub-123');
      expect(template.html).toContain('Literary Magazine');
    });
  });

  describe('submissionStatusChangeEmail', () => {
    it('should generate status change email for acceptance', () => {
      const template = service.submissionStatusChangeEmail({
        userName: 'Author',
        submissionTitle: 'My Story',
        submissionId: 'sub-123',
        previousStatus: 'UNDER_REVIEW',
        newStatus: 'ACCEPTED',
        organizationName: 'Magazine',
      });

      expect(template.subject).toContain('accepted');
      expect(template.html).toContain('ACCEPTED');
      expect(template.html).toContain('#16a34a'); // Green color for accepted
    });

    it('should generate status change email for rejection', () => {
      const template = service.submissionStatusChangeEmail({
        userName: 'Author',
        submissionTitle: 'My Story',
        submissionId: 'sub-123',
        previousStatus: 'UNDER_REVIEW',
        newStatus: 'REJECTED',
        organizationName: 'Magazine',
      });

      expect(template.subject).toContain('rejected');
      expect(template.html).toContain('#dc2626'); // Red color for rejected
    });

    it('should include comment when provided', () => {
      const template = service.submissionStatusChangeEmail({
        userName: 'Author',
        submissionTitle: 'My Story',
        submissionId: 'sub-123',
        previousStatus: 'UNDER_REVIEW',
        newStatus: 'HOLD',
        organizationName: 'Magazine',
        comment: 'We need more time to review this.',
      });

      expect(template.html).toContain('We need more time to review this.');
      expect(template.text).toContain('We need more time to review this.');
    });
  });

  describe('paymentConfirmationEmail', () => {
    it('should generate payment confirmation email template', () => {
      const template = service.paymentConfirmationEmail({
        userName: 'Payer',
        submissionTitle: 'My Submission',
        amount: '$25.00',
        currency: 'usd',
        organizationName: 'Magazine',
      });

      expect(template.subject).toContain('Payment confirmed');
      expect(template.html).toContain('$25.00');
      expect(template.html).toContain('USD');
    });
  });

  describe('infectedFileAlertEmail', () => {
    it('should generate infected file alert email template', () => {
      const template = service.infectedFileAlertEmail({
        userName: 'User',
        fileName: 'malicious.pdf',
        submissionTitle: 'My Submission',
        virusName: 'Eicar-Test-Signature',
      });

      expect(template.subject).toContain('Security alert');
      expect(template.html).toContain('malicious.pdf');
      expect(template.html).toContain('Eicar-Test-Signature');
      expect(template.html).toContain('#dc2626'); // Red alert color
    });

    it('should escape HTML in virus name', () => {
      const template = service.infectedFileAlertEmail({
        userName: 'User',
        fileName: 'file.pdf',
        submissionTitle: 'Submission',
        virusName: '<script>bad</script>',
      });

      expect(template.html).not.toContain('<script>bad</script>');
      expect(template.html).toContain('&lt;script&gt;');
    });
  });
});
