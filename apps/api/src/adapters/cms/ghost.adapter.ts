import { createHmac } from 'node:crypto';
import type {
  CmsAdapter,
  CmsTestResult,
  CmsPublishResult,
  CmsIssuePayload,
  CmsPiecePayload,
} from './cms-adapter.interface.js';

/**
 * Ghost CMS adapter — publishes via the Ghost Admin API.
 *
 * Expected config shape:
 * ```json
 * {
 *   "apiUrl": "https://example.com",
 *   "adminApiKey": "ADMIN_KEY_ID:ADMIN_KEY_SECRET"
 * }
 * ```
 *
 * The admin API key format is `id:secret` where `id` is the API key ID and
 * `secret` is the hex-encoded secret used for JWT signing.
 */
export const ghostAdapter: CmsAdapter = {
  type: 'GHOST',

  async testConnection(
    config: Record<string, unknown>,
  ): Promise<CmsTestResult> {
    const { apiUrl, token } = parseConfigAndSign(config);

    try {
      const res = await fetch(`${apiUrl}/ghost/api/admin/site/`, {
        headers: { Authorization: `Ghost ${token}` },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return { success: false, error: `HTTP ${res.status}: ${body}` };
      }

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  },

  async publishIssue(
    config: Record<string, unknown>,
    issue: CmsIssuePayload,
  ): Promise<CmsPublishResult> {
    const { apiUrl, token } = parseConfigAndSign(config);

    const html = buildIssueHtml(issue);

    const res = await fetch(`${apiUrl}/ghost/api/admin/posts/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Ghost ${token}`,
      },
      body: JSON.stringify({
        posts: [
          {
            title: issue.title,
            html,
            status: 'published',
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Ghost publish failed: HTTP ${res.status} — ${body}`);
    }

    const data = (await res.json()) as {
      posts: { id: string; url: string }[];
    };
    const post = data.posts[0];
    return { externalId: post.id, externalUrl: post.url };
  },

  async unpublishIssue(
    config: Record<string, unknown>,
    externalId: string,
  ): Promise<void> {
    const { apiUrl, token } = parseConfigAndSign(config);

    const res = await fetch(`${apiUrl}/ghost/api/admin/posts/${externalId}/`, {
      method: 'DELETE',
      headers: {
        Authorization: `Ghost ${token}`,
      },
    });

    if (!res.ok && res.status !== 404) {
      const body = await res.text().catch(() => '');
      throw new Error(`Ghost unpublish failed: HTTP ${res.status} — ${body}`);
    }
  },

  async syncPiece(
    config: Record<string, unknown>,
    piece: CmsPiecePayload,
    externalId?: string,
  ): Promise<CmsPublishResult> {
    const { apiUrl, token } = parseConfigAndSign(config);

    const method = externalId ? 'PUT' : 'POST';
    const url = externalId
      ? `${apiUrl}/ghost/api/admin/posts/${externalId}/`
      : `${apiUrl}/ghost/api/admin/posts/`;

    const body = {
      posts: [
        {
          title: piece.title,
          html: piece.content,
          status: 'published',
        },
      ],
    };

    // Ghost PUT requires the post's updated_at for collision detection.
    // For updates, fetch current post first to get updated_at.
    if (externalId) {
      const getRes = await fetch(
        `${apiUrl}/ghost/api/admin/posts/${externalId}/`,
        { headers: { Authorization: `Ghost ${token}` } },
      );
      if (getRes.ok) {
        const current = (await getRes.json()) as {
          posts: { updated_at: string }[];
        };
        (body.posts[0] as Record<string, unknown>).updated_at =
          current.posts[0].updated_at;
      }
    }

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Ghost ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const resBody = await res.text().catch(() => '');
      throw new Error(
        `Ghost sync piece failed: HTTP ${res.status} — ${resBody}`,
      );
    }

    const data = (await res.json()) as {
      posts: { id: string; url: string }[];
    };
    const post = data.posts[0];
    return { externalId: post.id, externalUrl: post.url };
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseConfigAndSign(config: Record<string, unknown>): {
  apiUrl: string;
  token: string;
} {
  const apiUrl = config.apiUrl as string | undefined;
  const adminApiKey = config.adminApiKey as string | undefined;

  if (!apiUrl || !adminApiKey) {
    throw new Error('Ghost config requires apiUrl and adminApiKey');
  }

  const [id, secret] = adminApiKey.split(':');
  if (!id || !secret) {
    throw new Error('Ghost adminApiKey must be in "id:secret" format');
  }

  // Ghost Admin API uses short-lived JWTs signed with the admin key secret.
  // Build a minimal JWT (HS256) with 5-minute expiry.
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: id }),
  ).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' }),
  ).toString('base64url');
  const signature = createHmac('sha256', Buffer.from(secret, 'hex'))
    .update(`${header}.${payload}`)
    .digest('base64url');

  return {
    apiUrl: apiUrl.replace(/\/+$/, ''),
    token: `${header}.${payload}.${signature}`,
  };
}

function buildIssueHtml(issue: CmsIssuePayload): string {
  const parts: string[] = [];

  if (issue.description) {
    parts.push(`<p>${issue.description}</p>`);
  }

  let currentSection: string | null = null;
  for (const item of issue.items) {
    if (item.sectionTitle && item.sectionTitle !== currentSection) {
      currentSection = item.sectionTitle;
      parts.push(`<h2>${currentSection}</h2>`);
    }
    parts.push(`<h3>${item.title}</h3>`);
    parts.push(`<p><em>by ${item.author}</em></p>`);
    parts.push(item.content);
    parts.push('<hr />');
  }

  return parts.join('\n');
}
