import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TRPCError } from '@trpc/server';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { prisma } from '@prospector/db';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../email/email.service';
import { EmailTemplateService } from '../email/email-template.service';
import type {
  LoginInput,
  RegisterInput,
  AuthResponse,
  JwtPayload,
  EmailVerificationResponse,
} from '@prospector/types';

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days
const EMAIL_VERIFICATION_EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours
const REFRESH_TOKEN_PREFIX = 'refresh:';
const EMAIL_VERIFICATION_PREFIX = 'email_verify:';

interface RefreshTokenData {
  userId: string;
  email: string;
  tokenId: string;
  createdAt: number;
}

interface EmailVerificationTokenData {
  userId: string;
  email: string;
  tokenId: string;
  createdAt: number;
}

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly appUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
    private readonly emailTemplateService: EmailTemplateService,
  ) {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters');
    }
    this.jwtSecret = secret;
    this.appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );
  }

  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<AuthResponse> {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existingUser) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Email already registered',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        emailVerified: false,
      },
    });

    // Send verification email
    await this.sendVerificationEmail(user.id, user.email);

    // Generate tokens
    return this.generateTokenPair(user.id, user.email);
  }

  /**
   * Login with email and password
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (!user || !user.passwordHash) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password',
      });
    }

    // Check if user is soft-deleted
    if (user.deletedAt) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Account has been deactivated',
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password',
      });
    }

    // Generate tokens
    return this.generateTokenPair(user.id, user.email);
  }

  /**
   * Refresh access token using refresh token
   * Implements single-use rotation: old token is revoked, new pair is issued
   */
  async refresh(refreshToken: string): Promise<AuthResponse> {
    // Validate and decode refresh token
    const tokenData = await this.validateRefreshToken(refreshToken);
    if (!tokenData) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired refresh token',
      });
    }

    // Revoke old refresh token (single-use rotation)
    await this.revokeRefreshToken(refreshToken);

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: tokenData.userId },
    });

    if (!user || user.deletedAt) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'User account is no longer active',
      });
    }

    // Generate new token pair
    return this.generateTokenPair(user.id, user.email);
  }

  /**
   * Logout - revokes all refresh tokens for the user
   */
  async logout(userId: string): Promise<void> {
    // Delete all refresh tokens for this user
    const pattern = `${REFRESH_TOKEN_PREFIX}${userId}:*`;
    await this.redisService.scanAndDelete(pattern);
  }

  /**
   * Verify access token and return payload
   */
  verifyAccessToken(token: string): JwtPayload | null {
    try {
      const payload = this.decodeJwt(token);
      if (!payload || payload.exp * 1000 < Date.now()) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Generate email verification token for a user
   * Called after registration to send verification email
   */
  async generateEmailVerificationToken(
    userId: string,
    email: string,
  ): Promise<string> {
    const tokenId = crypto.randomBytes(32).toString('hex');

    const tokenData: EmailVerificationTokenData = {
      userId,
      email,
      tokenId,
      createdAt: Date.now(),
    };

    const key = `${EMAIL_VERIFICATION_PREFIX}${tokenId}`;
    await this.redisService.setJSON(
      key,
      tokenData,
      EMAIL_VERIFICATION_EXPIRY_SECONDS,
    );

    return tokenId;
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<EmailVerificationResponse> {
    const key = `${EMAIL_VERIFICATION_PREFIX}${token}`;
    const tokenData =
      await this.redisService.getJSON<EmailVerificationTokenData>(key);

    if (!tokenData) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid or expired verification token',
      });
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { id: tokenData.userId },
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    if (user.deletedAt) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Account has been deactivated',
      });
    }

    if (user.emailVerified) {
      // Delete the token since email is already verified
      await this.redisService.del(key);
      return {
        success: true,
        message: 'Email already verified',
      };
    }

    // Verify email matches (in case user changed email)
    if (user.email !== tokenData.email) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'Email address has changed. Please request a new verification email.',
      });
    }

    // Update user's email verification status
    await prisma.user.update({
      where: { id: tokenData.userId },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    // Delete the verification token (single use)
    await this.redisService.del(key);

    return {
      success: true,
      message: 'Email verified successfully',
    };
  }

  /**
   * Resend verification email
   * Generates a new token and invalidates the old one
   */
  async resendVerificationEmail(
    email: string,
  ): Promise<EmailVerificationResponse> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Return success even if user doesn't exist to prevent email enumeration
      return {
        success: true,
        message:
          'If an account exists with this email, a verification email has been sent.',
      };
    }

    if (user.deletedAt) {
      // Return success to prevent enumeration of deleted accounts
      return {
        success: true,
        message:
          'If an account exists with this email, a verification email has been sent.',
      };
    }

    if (user.emailVerified) {
      return {
        success: true,
        message: 'Email is already verified.',
      };
    }

    // Send verification email
    await this.sendVerificationEmail(user.id, user.email);

    return {
      success: true,
      message:
        'If an account exists with this email, a verification email has been sent.',
    };
  }

  /**
   * Send verification email to user
   */
  private async sendVerificationEmail(
    userId: string,
    email: string,
  ): Promise<void> {
    // Generate verification token
    const token = await this.generateEmailVerificationToken(userId, email);

    // Build verification URL
    const verificationUrl = `${this.appUrl}/auth/verify-email?token=${token}`;

    // Get email template
    const template = this.emailTemplateService.verificationEmail({
      userName: email.split('@')[0], // Use email prefix as name if no name available
      verificationUrl,
      expiresIn: '24 hours',
    });

    // Send email
    await this.emailService.sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Generate access and refresh token pair
   */
  private async generateTokenPair(
    userId: string,
    email: string,
  ): Promise<AuthResponse> {
    const accessToken = this.generateAccessToken(userId, email);
    const refreshToken = await this.generateRefreshToken(userId, email);

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
    };
  }

  /**
   * Generate JWT access token (stateless, short-lived)
   */
  private generateAccessToken(userId: string, email: string): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: JwtPayload = {
      sub: userId,
      email,
      iat: now,
      exp: now + ACCESS_TOKEN_EXPIRY_SECONDS,
    };

    return this.encodeJwt(payload);
  }

  /**
   * Generate refresh token (stored in Redis, long-lived, single-use)
   */
  private async generateRefreshToken(
    userId: string,
    email: string,
  ): Promise<string> {
    // Generate a random token ID
    const tokenId = crypto.randomBytes(32).toString('hex');

    // Create token data
    const tokenData: RefreshTokenData = {
      userId,
      email,
      tokenId,
      createdAt: Date.now(),
    };

    // Store in Redis with TTL
    const key = `${REFRESH_TOKEN_PREFIX}${userId}:${tokenId}`;
    await this.redisService.setJSON(
      key,
      tokenData,
      REFRESH_TOKEN_EXPIRY_SECONDS,
    );

    // Return the token (userId:tokenId format for easy lookup)
    return Buffer.from(JSON.stringify({ userId, tokenId })).toString(
      'base64url',
    );
  }

  /**
   * Validate refresh token and return token data
   */
  private async validateRefreshToken(
    token: string,
  ): Promise<RefreshTokenData | null> {
    try {
      // Decode token
      const decoded = JSON.parse(Buffer.from(token, 'base64url').toString());
      const { userId, tokenId } = decoded;

      if (!userId || !tokenId) {
        return null;
      }

      // Look up in Redis
      const key = `${REFRESH_TOKEN_PREFIX}${userId}:${tokenId}`;
      const tokenData = await this.redisService.getJSON<RefreshTokenData>(key);

      if (!tokenData || tokenData.tokenId !== tokenId) {
        return null;
      }

      return tokenData;
    } catch {
      return null;
    }
  }

  /**
   * Revoke a refresh token
   */
  private async revokeRefreshToken(token: string): Promise<void> {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64url').toString());
      const { userId, tokenId } = decoded;

      if (userId && tokenId) {
        const key = `${REFRESH_TOKEN_PREFIX}${userId}:${tokenId}`;
        await this.redisService.del(key);
      }
    } catch {
      // Ignore errors during revocation
    }
  }

  /**
   * Simple JWT encoding using HMAC-SHA256
   * Note: In production, consider using a proper JWT library for additional features
   */
  private encodeJwt(payload: JwtPayload): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );
    const signature = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    return `${headerB64}.${payloadB64}.${signature}`;
  }

  /**
   * Decode and verify JWT
   */
  private decodeJwt(token: string): JwtPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const [headerB64, payloadB64, signature] = parts;

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', this.jwtSecret)
        .update(`${headerB64}.${payloadB64}`)
        .digest('base64url');

      if (signature !== expectedSignature) {
        return null;
      }

      // Decode payload
      const payload = JSON.parse(
        Buffer.from(payloadB64, 'base64url').toString(),
      );
      return payload as JwtPayload;
    } catch {
      return null;
    }
  }
}
