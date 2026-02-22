import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockEmbedTokenService, mockEmbedSubmissionService } = vi.hoisted(() => {
  const mockEmbedTokenService = {
    verifyToken: vi.fn(),
  };
  const mockEmbedSubmissionService = {
    submitFromEmbed: vi.fn(),
    loadFormForEmbed: vi.fn(),
  };
  return { mockEmbedTokenService, mockEmbedSubmissionService };
});

vi.mock('../services/embed-token.service.js', () => ({
  embedTokenService: mockEmbedTokenService,
}));

vi.mock('../services/embed-submission.service.js', () => ({
  embedSubmissionService: mockEmbedSubmissionService,
  PeriodClosedError: class PeriodClosedError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'PeriodClosedError';
    }
  },
}));

// Mock ioredis
vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      eval: vi.fn().mockResolvedValue([1, 60000]),
      quit: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

import Fastify from 'fastify';
import { registerEmbedRoutes } from './embed.routes.js';
import type { VerifiedEmbedToken } from '../services/embed-token.service.js';

function makeVerifiedToken(
  overrides: Partial<VerifiedEmbedToken> = {},
): VerifiedEmbedToken {
  const now = new Date();
  return {
    id: 'token-1',
    organizationId: 'org-1',
    submissionPeriodId: 'period-1',
    allowedOrigins: [],
    themeConfig: null,
    active: true,
    expiresAt: null,
    period: {
      name: 'Fall 2026',
      opensAt: new Date(now.getTime() - 86400000),
      closesAt: new Date(now.getTime() + 86400000),
      formDefinitionId: null,
      maxSubmissions: null,
      fee: null,
    },
    ...overrides,
  };
}

const testEnv = {
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_PASSWORD: '',
  RATE_LIMIT_WINDOW_SECONDS: 60,
  RATE_LIMIT_KEY_PREFIX: 'test:rl',
} as any;

async function buildTestApp() {
  const app = Fastify({ logger: false });
  await app.register(async (scope) => {
    await registerEmbedRoutes(scope, { env: testEnv });
  });
  return app;
}

describe('embed routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /embed/:token', () => {
    it('returns 404 for invalid token', async () => {
      mockEmbedTokenService.verifyToken.mockResolvedValueOnce(null);

      const app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: '/embed/col_emb_invalidtokenvalue1234567890',
      });

      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body)).toMatchObject({ error: 'not_found' });
    });

    it('returns form definition for valid token', async () => {
      const token = makeVerifiedToken();
      mockEmbedTokenService.verifyToken.mockResolvedValueOnce(token);
      mockEmbedSubmissionService.loadFormForEmbed.mockResolvedValueOnce(null);

      const app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: '/embed/col_emb_abcdef1234567890abcdef1234567890',
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.period.name).toBe('Fall 2026');
      expect(body.form).toBeNull();
      expect(body.organizationId).toBe('org-1');
    });

    it('returns 410 for closed period', async () => {
      const closedToken = makeVerifiedToken({
        period: {
          name: 'Expired',
          opensAt: new Date('2020-01-01'),
          closesAt: new Date('2020-12-31'),
          formDefinitionId: null,
          maxSubmissions: null,
          fee: null,
        },
      });
      mockEmbedTokenService.verifyToken.mockResolvedValueOnce(closedToken);

      const app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: '/embed/col_emb_abcdef1234567890abcdef1234567890',
      });

      expect(res.statusCode).toBe(410);
    });

    it('sets frame-ancestors CSP header from allowedOrigins', async () => {
      const token = makeVerifiedToken({
        allowedOrigins: ['https://magazine.com', 'https://blog.example.org'],
      });
      mockEmbedTokenService.verifyToken.mockResolvedValueOnce(token);
      mockEmbedSubmissionService.loadFormForEmbed.mockResolvedValueOnce(null);

      const app = await buildTestApp();
      const res = await app.inject({
        method: 'GET',
        url: '/embed/col_emb_abcdef1234567890abcdef1234567890',
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-security-policy']).toBe(
        'frame-ancestors https://magazine.com https://blog.example.org',
      );
    });
  });

  describe('POST /embed/:token/submit', () => {
    it('creates guest user and submission', async () => {
      const token = makeVerifiedToken();
      mockEmbedTokenService.verifyToken.mockResolvedValueOnce(token);
      mockEmbedSubmissionService.submitFromEmbed.mockResolvedValueOnce({
        submissionId: 'sub-1',
        userId: 'user-1',
      });

      const app = await buildTestApp();
      const res = await app.inject({
        method: 'POST',
        url: '/embed/col_emb_abcdef1234567890abcdef1234567890/submit',
        payload: {
          email: 'writer@example.com',
          title: 'My Poem',
          content: 'Roses are red...',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.submissionId).toBe('sub-1');
    });

    it('returns 400 for invalid email', async () => {
      const token = makeVerifiedToken();
      mockEmbedTokenService.verifyToken.mockResolvedValueOnce(token);

      const app = await buildTestApp();
      const res = await app.inject({
        method: 'POST',
        url: '/embed/col_emb_abcdef1234567890abcdef1234567890/submit',
        payload: {
          email: 'not-an-email',
          title: 'My Poem',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('validation_error');
    });

    it('returns 403 for disallowed origin', async () => {
      const token = makeVerifiedToken({
        allowedOrigins: ['https://allowed.com'],
      });
      mockEmbedTokenService.verifyToken.mockResolvedValueOnce(token);

      const app = await buildTestApp();
      const res = await app.inject({
        method: 'POST',
        url: '/embed/col_emb_abcdef1234567890abcdef1234567890/submit',
        headers: {
          origin: 'https://evil.com',
        },
        payload: {
          email: 'writer@example.com',
          title: 'My Poem',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('forbidden');
    });

    it('returns 404 for invalid token', async () => {
      mockEmbedTokenService.verifyToken.mockResolvedValueOnce(null);

      const app = await buildTestApp();
      const res = await app.inject({
        method: 'POST',
        url: '/embed/col_emb_invalidtokenvalue1234567890/submit',
        payload: {
          email: 'writer@example.com',
          title: 'My Poem',
        },
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
