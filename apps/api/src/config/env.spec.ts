import { describe, it, expect } from 'vitest';
import { validateEnv } from './env.js';

describe('validateEnv', () => {
  const validBase = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/colophony',
  };

  it('accepts valid config with only DATABASE_URL', () => {
    const env = validateEnv(validBase);
    expect(env.DATABASE_URL).toBe(validBase.DATABASE_URL);
  });

  it('applies correct defaults', () => {
    const env = validateEnv(validBase);
    expect(env.PORT).toBe(4000);
    expect(env.HOST).toBe('0.0.0.0');
    expect(env.NODE_ENV).toBe('development');
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.REDIS_HOST).toBe('localhost');
    expect(env.REDIS_PORT).toBe(6379);
    expect(env.REDIS_PASSWORD).toBe('');
    expect(env.CORS_ORIGIN).toBe('http://localhost:3000');
  });

  it('rejects missing DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow();
  });

  it('rejects non-postgresql URL', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: 'mysql://user:pass@localhost/db' }),
    ).toThrow('postgresql://');
  });

  it('accepts overridden values', () => {
    const env = validateEnv({
      ...validBase,
      PORT: '3000',
      NODE_ENV: 'production',
      LOG_LEVEL: 'error',
      CORS_ORIGIN: 'https://example.com',
    });
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('production');
    expect(env.LOG_LEVEL).toBe('error');
    expect(env.CORS_ORIGIN).toBe('https://example.com');
  });

  it('coerces PORT from string to number', () => {
    const env = validateEnv({ ...validBase, PORT: '8080' });
    expect(env.PORT).toBe(8080);
    expect(typeof env.PORT).toBe('number');
  });

  it('accepts optional ZITADEL_CLIENT_ID', () => {
    const env = validateEnv({
      ...validBase,
      ZITADEL_AUTHORITY: 'http://localhost:8080',
      ZITADEL_CLIENT_ID: 'my-zitadel-client',
    });
    expect(env.ZITADEL_CLIENT_ID).toBe('my-zitadel-client');
  });

  it('defaults ZITADEL_CLIENT_ID to undefined', () => {
    const env = validateEnv(validBase);
    expect(env.ZITADEL_CLIENT_ID).toBeUndefined();
  });

  it('applies rate limit defaults', () => {
    const env = validateEnv(validBase);
    expect(env.RATE_LIMIT_DEFAULT_MAX).toBe(60);
    expect(env.RATE_LIMIT_AUTH_MAX).toBe(200);
    expect(env.RATE_LIMIT_WINDOW_SECONDS).toBe(60);
    expect(env.RATE_LIMIT_KEY_PREFIX).toBe('colophony:rl');
  });

  it('coerces rate limit values from strings to numbers', () => {
    const env = validateEnv({
      ...validBase,
      RATE_LIMIT_DEFAULT_MAX: '120',
      RATE_LIMIT_AUTH_MAX: '500',
      RATE_LIMIT_WINDOW_SECONDS: '30',
    });
    expect(env.RATE_LIMIT_DEFAULT_MAX).toBe(120);
    expect(env.RATE_LIMIT_AUTH_MAX).toBe(500);
    expect(env.RATE_LIMIT_WINDOW_SECONDS).toBe(30);
  });

  it('rejects non-positive rate limit values', () => {
    expect(() =>
      validateEnv({ ...validBase, RATE_LIMIT_DEFAULT_MAX: '0' }),
    ).toThrow();
    expect(() =>
      validateEnv({ ...validBase, RATE_LIMIT_AUTH_MAX: '-1' }),
    ).toThrow();
    expect(() =>
      validateEnv({ ...validBase, RATE_LIMIT_WINDOW_SECONDS: '0' }),
    ).toThrow();
  });

  it('transforms FEDERATION_ENABLED to boolean', () => {
    const envTrue = validateEnv({
      ...validBase,
      FEDERATION_ENABLED: 'true',
    });
    expect(envTrue.FEDERATION_ENABLED).toBe(true);

    const envFalse = validateEnv({
      ...validBase,
      FEDERATION_ENABLED: 'false',
    });
    expect(envFalse.FEDERATION_ENABLED).toBe(false);
  });
});
