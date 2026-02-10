import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72), // bcrypt max
  name: z.string().min(1).max(255).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

export const emailVerificationSchema = z.object({
  token: z.string().min(1),
});

export type EmailVerificationInput = z.infer<typeof emailVerificationSchema>;

export const resendVerificationSchema = z.object({
  email: z.string().email(),
});

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export const emailVerificationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type EmailVerificationResponse = z.infer<typeof emailVerificationResponseSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8).max(72),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(72),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export interface JwtPayload {
  sub: string; // user ID
  email: string;
  iat: number;
  exp: number;
}

export interface AuthContext {
  userId: string;
  email: string;
  orgId?: string;
  role?: 'ADMIN' | 'EDITOR' | 'READER';
}
