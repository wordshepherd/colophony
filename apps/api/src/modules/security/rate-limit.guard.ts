import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { RateLimitService, RateLimitConfig } from './rate-limit.service';

export const RATE_LIMIT_KEY = 'rateLimit';
export const SKIP_RATE_LIMIT_KEY = 'skipRateLimit';

/**
 * Decorator to apply custom rate limit config to a route
 */
export function RateLimit(config: Partial<RateLimitConfig>) {
  return (
    target: object,
    _key?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {
    if (descriptor) {
      Reflect.defineMetadata(RATE_LIMIT_KEY, config, descriptor.value);
      return descriptor;
    }
    Reflect.defineMetadata(RATE_LIMIT_KEY, config, target);
    return target;
  };
}

/**
 * Decorator to skip rate limiting for a route
 */
export function SkipRateLimit() {
  return (
    target: object,
    _key?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {
    if (descriptor) {
      Reflect.defineMetadata(SKIP_RATE_LIMIT_KEY, true, descriptor.value);
      return descriptor;
    }
    Reflect.defineMetadata(SKIP_RATE_LIMIT_KEY, true, target);
    return target;
  };
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Check if rate limiting should be skipped
    const skipRateLimit = this.reflector.getAllAndOverride<boolean>(
      SKIP_RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipRateLimit) {
      return true;
    }

    // Get client IP
    const ip = this.getClientIp(request);

    // Check for custom rate limit config
    const customConfig = this.reflector.getAllAndOverride<
      Partial<RateLimitConfig>
    >(RATE_LIMIT_KEY, [context.getHandler(), context.getClass()]);

    // Determine which config to use
    let result;
    if (customConfig) {
      const config = {
        ...this.rateLimitService.getDefaultConfig(),
        ...customConfig,
      };
      result = await this.rateLimitService.checkRateLimit(
        `custom:${ip}`,
        config,
      );
    } else {
      // Use stricter auth limits for auth-related paths
      const path = request.path.toLowerCase();
      if (
        path.includes('/auth/') ||
        path.includes('auth.login') ||
        path.includes('auth.register')
      ) {
        result = await this.rateLimitService.checkAuthLimit(ip);
      } else {
        result = await this.rateLimitService.checkDefaultLimit(ip);
      }
    }

    // Set rate limit headers
    response.setHeader(
      'X-RateLimit-Limit',
      this.rateLimitService.getDefaultConfig().maxRequests,
    );
    response.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));
    response.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      response.setHeader('Retry-After', result.retryAfter || 60);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          retryAfter: result.retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  /**
   * Get client IP from request, handling proxies
   */
  private getClientIp(request: Request): string {
    // Check for forwarded headers (reverse proxy)
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      // Take the first IP (original client)
      return ips.split(',')[0].trim();
    }

    // Check for real IP header (nginx)
    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Fall back to socket address
    return request.ip || request.socket.remoteAddress || 'unknown';
  }
}
