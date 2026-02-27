import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @sentry/node
const mockInit = vi.fn();
const mockCaptureException = vi.fn();
vi.mock('@sentry/node', () => ({
  init: (...args: unknown[]) => mockInit(...args),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  onUncaughtExceptionIntegration: vi.fn(() => 'uncaught-integration'),
  onUnhandledRejectionIntegration: vi.fn(() => 'unhandled-integration'),
}));

// Dynamic import to ensure fresh module state per describe block
async function loadModule() {
  const mod = await import('./sentry.js');
  return mod;
}

describe('sentry', () => {
  beforeEach(() => {
    vi.resetModules();
    mockInit.mockReset();
    mockCaptureException.mockReset();
  });

  it('does not init when SENTRY_DSN is undefined', async () => {
    const { initSentry, isSentryEnabled } = await loadModule();
    initSentry({
      SENTRY_ENVIRONMENT: 'test',
      SENTRY_TRACES_SAMPLE_RATE: 0,
    } as never);
    expect(mockInit).not.toHaveBeenCalled();
    expect(isSentryEnabled()).toBe(false);
  });

  it('initializes with DSN', async () => {
    const { initSentry, isSentryEnabled } = await loadModule();
    initSentry({
      SENTRY_DSN: 'https://key@sentry.io/123',
      SENTRY_ENVIRONMENT: 'test',
      SENTRY_TRACES_SAMPLE_RATE: 0.5,
      SENTRY_RELEASE: 'v1.0.0',
    } as never);
    expect(mockInit).toHaveBeenCalledOnce();
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://key@sentry.io/123',
        environment: 'test',
        release: 'v1.0.0',
        tracesSampleRate: 0.5,
      }),
    );
    expect(isSentryEnabled()).toBe(true);
  });

  it('is idempotent — second init is a no-op', async () => {
    const { initSentry } = await loadModule();
    const env = {
      SENTRY_DSN: 'https://key@sentry.io/123',
      SENTRY_ENVIRONMENT: 'test',
      SENTRY_TRACES_SAMPLE_RATE: 0,
    } as never;
    initSentry(env);
    initSentry(env);
    expect(mockInit).toHaveBeenCalledOnce();
  });

  it('captureException is a no-op when not initialized', async () => {
    const { captureException } = await loadModule();
    captureException(new Error('test'));
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('captureException forwards with context when initialized', async () => {
    const { initSentry, captureException } = await loadModule();
    initSentry({
      SENTRY_DSN: 'https://key@sentry.io/123',
      SENTRY_ENVIRONMENT: 'test',
      SENTRY_TRACES_SAMPLE_RATE: 0,
    } as never);

    const error = new Error('test error');
    captureException(error, { url: '/test', method: 'GET' });

    expect(mockCaptureException).toHaveBeenCalledWith(error, {
      extra: { url: '/test', method: 'GET' },
    });
  });

  it('beforeSend scrubs authorization headers from breadcrumbs', async () => {
    const { initSentry } = await loadModule();
    initSentry({
      SENTRY_DSN: 'https://key@sentry.io/123',
      SENTRY_ENVIRONMENT: 'test',
      SENTRY_TRACES_SAMPLE_RATE: 0,
    } as never);

    const { beforeSend } = mockInit.mock.calls[0][0] as {
      beforeSend: (event: {
        breadcrumbs?: Array<{
          data?: { headers?: Record<string, unknown> };
        }>;
      }) => unknown;
    };

    const event = {
      breadcrumbs: [
        {
          data: {
            headers: {
              authorization: 'Bearer secret',
              'x-api-key': 'col_live_abc',
              'content-type': 'application/json',
            },
          },
        },
      ],
    };

    const result = beforeSend(event) as typeof event;
    const headers = result.breadcrumbs?.[0]?.data?.headers;
    expect(headers?.authorization).toBeUndefined();
    expect(headers?.['x-api-key']).toBeUndefined();
    expect(headers?.['content-type']).toBe('application/json');
  });
});
