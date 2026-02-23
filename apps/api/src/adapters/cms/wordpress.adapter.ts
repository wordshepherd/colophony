import type {
  CmsAdapter,
  CmsTestResult,
  CmsPublishResult,
  CmsIssuePayload,
  CmsPiecePayload,
} from './cms-adapter.interface.js';

/**
 * WordPress CMS adapter — publishes via the WP REST API v2.
 *
 * Expected config shape:
 * ```json
 * {
 *   "siteUrl": "https://example.com",
 *   "username": "admin",
 *   "applicationPassword": "xxxx xxxx xxxx xxxx"
 * }
 * ```
 */
export const wordpressAdapter: CmsAdapter = {
  type: 'WORDPRESS',

  async testConnection(
    config: Record<string, unknown>,
  ): Promise<CmsTestResult> {
    const { siteUrl, username, applicationPassword } = parseConfig(config);

    try {
      const res = await fetch(`${siteUrl}/wp-json/wp/v2/users/me`, {
        headers: { Authorization: basicAuth(username, applicationPassword) },
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
    const { siteUrl, username, applicationPassword } = parseConfig(config);

    // Build combined HTML content from issue items
    const html = buildIssueHtml(issue);

    const res = await fetch(`${siteUrl}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: basicAuth(username, applicationPassword),
      },
      body: JSON.stringify({
        title: issue.title,
        content: html,
        status: 'publish',
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`WordPress publish failed: HTTP ${res.status} — ${body}`);
    }

    const data = (await res.json()) as { id: number; link: string };
    return { externalId: String(data.id), externalUrl: data.link };
  },

  async unpublishIssue(
    config: Record<string, unknown>,
    externalId: string,
  ): Promise<void> {
    const { siteUrl, username, applicationPassword } = parseConfig(config);

    const res = await fetch(`${siteUrl}/wp-json/wp/v2/posts/${externalId}`, {
      method: 'DELETE',
      headers: {
        Authorization: basicAuth(username, applicationPassword),
      },
    });

    if (!res.ok && res.status !== 404) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `WordPress unpublish failed: HTTP ${res.status} — ${body}`,
      );
    }
  },

  async syncPiece(
    config: Record<string, unknown>,
    piece: CmsPiecePayload,
    externalId?: string,
  ): Promise<CmsPublishResult> {
    const { siteUrl, username, applicationPassword } = parseConfig(config);

    const method = externalId ? 'PUT' : 'POST';
    const url = externalId
      ? `${siteUrl}/wp-json/wp/v2/posts/${externalId}`
      : `${siteUrl}/wp-json/wp/v2/posts`;

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: basicAuth(username, applicationPassword),
      },
      body: JSON.stringify({
        title: piece.title,
        content: piece.content,
        status: 'publish',
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `WordPress sync piece failed: HTTP ${res.status} — ${body}`,
      );
    }

    const data = (await res.json()) as { id: number; link: string };
    return { externalId: String(data.id), externalUrl: data.link };
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseConfig(config: Record<string, unknown>): {
  siteUrl: string;
  username: string;
  applicationPassword: string;
} {
  const siteUrl = config.siteUrl as string | undefined;
  const username = config.username as string | undefined;
  const applicationPassword = config.applicationPassword as string | undefined;

  if (!siteUrl || !username || !applicationPassword) {
    throw new Error(
      'WordPress config requires siteUrl, username, and applicationPassword',
    );
  }

  // Strip trailing slash
  return {
    siteUrl: siteUrl.replace(/\/+$/, ''),
    username,
    applicationPassword,
  };
}

function basicAuth(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
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
