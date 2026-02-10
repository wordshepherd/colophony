import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TRPCError } from '@trpc/server';
import { AuthService } from '../../src/modules/auth/auth.service';
import { RedisService } from '../../src/modules/redis/redis.service';
import { EmailService } from '../../src/modules/email/email.service';
import { EmailTemplateService } from '../../src/modules/email/email-template.service';
import { MockRedisService } from '../utils/mock-redis';
import { prisma } from '@prospector/db';
import * as bcrypt from 'bcrypt';

// Mock the prisma module
jest.mock('@prospector/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    organizationMember: {
      findUnique: jest.fn(),
    },
  },
}));

describe('AuthService', () => {
  let authService: AuthService;
  let mockRedis: MockRedisService;
  let mockEmailService: jest.Mocked<EmailService>;
  let mockEmailTemplateService: jest.Mocked<EmailTemplateService>;
  const mockPrisma = prisma as jest.Mocked<typeof prisma>;

  const JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

  beforeEach(async () => {
    mockRedis = new MockRedisService();

    mockEmailService = {
      sendEmail: jest
        .fn()
        .mockResolvedValue({ success: true, messageId: 'test-123' }),
      isEnabled: jest.fn().mockReturnValue(true),
      getFromAddress: jest.fn().mockReturnValue('noreply@test.com'),
    } as unknown as jest.Mocked<EmailService>;

    mockEmailTemplateService = {
      verificationEmail: jest.fn().mockReturnValue({
        subject: 'Verify your email',
        html: '<p>Verify</p>',
        text: 'Verify',
      }),
      passwordResetEmail: jest.fn().mockReturnValue({
        subject: 'Reset password',
        html: '<p>Reset</p>',
        text: 'Reset',
      }),
    } as unknown as jest.Mocked<EmailTemplateService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: unknown) => {
              if (key === 'JWT_SECRET') return JWT_SECRET;
              if (key === 'APP_URL') return 'http://localhost:3000';
              if (key === 'NODE_ENV') return 'development';
              return defaultValue;
            },
          },
        },
        {
          provide: RedisService,
          useValue: mockRedis,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: EmailTemplateService,
          useValue: mockEmailTemplateService,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);

    // Clear mocks
    jest.clearAllMocks();
    mockRedis.clear();
  });

  describe('register', () => {
    it('should create a new user and return tokens', async () => {
      const input = {
        email: 'test@example.com',
        password: 'password123',
      };

      const createdUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed',
        emailVerified: false,
        emailVerifiedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.user.create as jest.Mock).mockResolvedValue(createdUser);

      const result = await authService.register(input);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
      expect(result.expiresIn).toBe(15 * 60); // 15 minutes

      // Verify user was looked up and created
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(mockPrisma.user.create).toHaveBeenCalled();

      // Verify password was hashed
      const createCall = (mockPrisma.user.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.passwordHash).not.toBe(input.password);
    });

    it('should throw CONFLICT if email already exists', async () => {
      const input = {
        email: 'existing@example.com',
        password: 'password123',
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-user',
        email: 'existing@example.com',
      });

      await expect(authService.register(input)).rejects.toThrow(TRPCError);
      await expect(authService.register(input)).rejects.toMatchObject({
        code: 'CONFLICT',
        message: 'Email already registered',
      });
    });
  });

  describe('login', () => {
    it('should return tokens for valid credentials', async () => {
      const input = {
        email: 'test@example.com',
        password: 'password123',
      };

      const hashedPassword = await bcrypt.hash(input.password, 12);
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        emailVerified: true,
        deletedAt: null,
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      const result = await authService.login(input);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.expiresIn).toBe(15 * 60);
    });

    it('should throw UNAUTHORIZED for invalid email', async () => {
      const input = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(authService.login(input)).rejects.toThrow(TRPCError);
      await expect(authService.login(input)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password',
      });
    });

    it('should throw UNAUTHORIZED for invalid password', async () => {
      const input = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      const hashedPassword = await bcrypt.hash('correctpassword', 12);
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        deletedAt: null,
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      await expect(authService.login(input)).rejects.toThrow(TRPCError);
      await expect(authService.login(input)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password',
      });
    });

    it('should throw UNAUTHORIZED for deactivated account', async () => {
      const input = {
        email: 'deleted@example.com',
        password: 'password123',
      };

      const hashedPassword = await bcrypt.hash(input.password, 12);
      const user = {
        id: 'user-123',
        email: 'deleted@example.com',
        passwordHash: hashedPassword,
        deletedAt: new Date(), // Soft deleted
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      await expect(authService.login(input)).rejects.toThrow(TRPCError);
      await expect(authService.login(input)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Account has been deactivated',
      });
    });
  });

  describe('refresh', () => {
    it('should return new token pair for valid refresh token', async () => {
      // First login to get a valid refresh token
      const hashedPassword = await bcrypt.hash('password123', 12);
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        deletedAt: null,
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      const loginResult = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      // Now refresh
      const refreshResult = await authService.refresh(loginResult.refreshToken);

      expect(refreshResult).toHaveProperty('accessToken');
      expect(refreshResult).toHaveProperty('refreshToken');
      expect(refreshResult.refreshToken).not.toBe(loginResult.refreshToken); // Should be rotated
    });

    it('should throw UNAUTHORIZED for invalid refresh token', async () => {
      await expect(authService.refresh('invalid-token')).rejects.toThrow(
        TRPCError,
      );
      await expect(authService.refresh('invalid-token')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired refresh token',
      });
    });

    it('should throw UNAUTHORIZED for already-used refresh token (single-use)', async () => {
      const hashedPassword = await bcrypt.hash('password123', 12);
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        deletedAt: null,
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      const loginResult = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      // First refresh should succeed
      await authService.refresh(loginResult.refreshToken);

      // Second refresh with same token should fail (single-use rotation)
      await expect(
        authService.refresh(loginResult.refreshToken),
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('logout', () => {
    it('should revoke all refresh tokens for user', async () => {
      const hashedPassword = await bcrypt.hash('password123', 12);
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        deletedAt: null,
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      // Login twice to create two refresh tokens
      const login1 = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });
      const login2 = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      // Logout
      await authService.logout('user-123');

      // Both refresh tokens should now be invalid
      await expect(authService.refresh(login1.refreshToken)).rejects.toThrow(
        TRPCError,
      );
      await expect(authService.refresh(login2.refreshToken)).rejects.toThrow(
        TRPCError,
      );
    });
  });

  describe('verifyAccessToken', () => {
    it('should return payload for valid token', async () => {
      const hashedPassword = await bcrypt.hash('password123', 12);
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        deletedAt: null,
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      const loginResult = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      const payload = authService.verifyAccessToken(loginResult.accessToken);

      expect(payload).not.toBeNull();
      expect(payload?.sub).toBe('user-123');
      expect(payload?.email).toBe('test@example.com');
    });

    it('should return null for invalid token', () => {
      const payload = authService.verifyAccessToken('invalid-token');
      expect(payload).toBeNull();
    });

    it('should return null for tampered token', async () => {
      const hashedPassword = await bcrypt.hash('password123', 12);
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: hashedPassword,
        deletedAt: null,
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      const loginResult = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      // Tamper with the token
      const tamperedToken = loginResult.accessToken.slice(0, -5) + 'XXXXX';

      const payload = authService.verifyAccessToken(tamperedToken);
      expect(payload).toBeNull();
    });
  });

  describe('generateEmailVerificationToken', () => {
    it('should generate a verification token and store in Redis', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';

      const token = await authService.generateEmailVerificationToken(
        userId,
        email,
      );

      expect(token).toBeDefined();
      expect(token.length).toBe(64); // 32 bytes = 64 hex chars

      // Verify token is stored in Redis
      const stored = await mockRedis.getJSON<{ userId: string; email: string }>(
        `email_verify:${token}`,
      );
      expect(stored).not.toBeNull();
      expect(stored?.userId).toBe(userId);
      expect(stored?.email).toBe(email);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email with valid token', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        emailVerified: false,
        deletedAt: null,
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(user);
      (mockPrisma.user.update as jest.Mock).mockResolvedValue({
        ...user,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      });

      // Generate a token first
      const token = await authService.generateEmailVerificationToken(
        user.id,
        user.email,
      );

      // Verify the email
      const result = await authService.verifyEmail(token);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Email verified successfully');

      // Verify user was updated
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerifiedAt: expect.any(Date),
        },
      });

      // Verify token was deleted (single use)
      const storedAfter = await mockRedis.getJSON(`email_verify:${token}`);
      expect(storedAfter).toBeNull();
    });

    it('should return success if email is already verified', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        deletedAt: null,
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      const token = await authService.generateEmailVerificationToken(
        user.id,
        user.email,
      );

      const result = await authService.verifyEmail(token);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Email already verified');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST for invalid token', async () => {
      await expect(authService.verifyEmail('invalid-token')).rejects.toThrow(
        TRPCError,
      );
      await expect(
        authService.verifyEmail('invalid-token'),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'Invalid or expired verification token',
      });
    });

    it('should throw NOT_FOUND if user does not exist', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const token = await authService.generateEmailVerificationToken(
        'deleted-user',
        'deleted@example.com',
      );

      await expect(authService.verifyEmail(token)).rejects.toThrow(TRPCError);
      await expect(authService.verifyEmail(token)).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    });

    it('should throw BAD_REQUEST if user is deactivated', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        emailVerified: false,
        deletedAt: new Date(),
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      const token = await authService.generateEmailVerificationToken(
        user.id,
        user.email,
      );

      await expect(authService.verifyEmail(token)).rejects.toThrow(TRPCError);
      await expect(authService.verifyEmail(token)).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'Account has been deactivated',
      });
    });

    it('should throw BAD_REQUEST if email has changed since token generation', async () => {
      const user = {
        id: 'user-123',
        email: 'new-email@example.com', // Changed email
        emailVerified: false,
        deletedAt: null,
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      // Generate token with old email
      const token = await authService.generateEmailVerificationToken(
        user.id,
        'old-email@example.com',
      );

      await expect(authService.verifyEmail(token)).rejects.toThrow(TRPCError);
      await expect(authService.verifyEmail(token)).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message:
          'Email address has changed. Please request a new verification email.',
      });
    });
  });

  describe('resendVerificationEmail', () => {
    it('should send verification email for unverified user', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        emailVerified: false,
        deletedAt: null,
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      const result = await authService.resendVerificationEmail(user.email);

      expect(result.success).toBe(true);
      expect(result.message).toBe(
        'If an account exists with this email, a verification email has been sent.',
      );
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: user.email,
        }),
      );
    });

    it('should return success even if user does not exist (prevent enumeration)', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await authService.resendVerificationEmail(
        'nonexistent@example.com',
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe(
        'If an account exists with this email, a verification email has been sent.',
      );
    });

    it('should return success if email is already verified', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        emailVerified: true,
        deletedAt: null,
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      const result = await authService.resendVerificationEmail(user.email);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Email is already verified.');
    });

    it('should return success for deactivated account (prevent enumeration)', async () => {
      const user = {
        id: 'user-123',
        email: 'deleted@example.com',
        emailVerified: false,
        deletedAt: new Date(),
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      const result = await authService.resendVerificationEmail(user.email);

      expect(result.success).toBe(true);
      expect(result.message).toBe(
        'If an account exists with this email, a verification email has been sent.',
      );
    });
  });
});
