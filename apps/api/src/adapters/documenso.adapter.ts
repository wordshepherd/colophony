import crypto from 'node:crypto';
import type { Env } from '../config/env.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocumensoSigner {
  email: string;
  name: string;
  role?: 'SIGNER' | 'APPROVER' | 'CC';
}

export interface CreateDocumentParams {
  title: string;
  body: string;
  signers: DocumensoSigner[];
  metadata?: Record<string, string>;
}

export interface DocumensoDocument {
  id: string;
  status: string;
  title: string;
  createdAt: string;
  completedAt?: string;
}

export interface DocumensoAdapter {
  createDocument(params: CreateDocumentParams): Promise<string>;
  getDocument(documensoDocumentId: string): Promise<DocumensoDocument>;
  voidDocument(documensoDocumentId: string): Promise<void>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function createDocumensoAdapter(env: Env): DocumensoAdapter | null {
  if (!env.DOCUMENSO_API_URL || !env.DOCUMENSO_API_KEY) {
    return null;
  }

  const baseUrl = env.DOCUMENSO_API_URL.replace(/\/$/, '');
  const apiKey = env.DOCUMENSO_API_KEY;
  const webhookSecret = env.DOCUMENSO_WEBHOOK_SECRET;

  async function apiRequest<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown error');
      throw new Error(
        `Documenso API error: ${response.status} ${response.statusText} — ${text}`,
      );
    }

    return response.json() as Promise<T>;
  }

  return {
    async createDocument(params: CreateDocumentParams): Promise<string> {
      const result = await apiRequest<{ id: string }>('/api/v1/documents', {
        method: 'POST',
        body: JSON.stringify({
          title: params.title,
          recipients: params.signers.map((s) => ({
            email: s.email,
            name: s.name,
            role: s.role ?? 'SIGNER',
          })),
          meta: {
            ...params.metadata,
          },
        }),
      });

      return result.id;
    },

    async getDocument(documensoDocumentId: string): Promise<DocumensoDocument> {
      return apiRequest<DocumensoDocument>(
        `/api/v1/documents/${encodeURIComponent(documensoDocumentId)}`,
      );
    },

    async voidDocument(documensoDocumentId: string): Promise<void> {
      await apiRequest(
        `/api/v1/documents/${encodeURIComponent(documensoDocumentId)}`,
        { method: 'DELETE' },
      );
    },

    verifyWebhookSignature(payload: string, signature: string): boolean {
      if (!webhookSecret) return false;

      const expected = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected),
      );
    },
  };
}
