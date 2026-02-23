import type { CmsAdapterType } from '@colophony/types';

// ---------------------------------------------------------------------------
// CMS adapter interface — implemented per CMS platform
// ---------------------------------------------------------------------------

export interface CmsTestResult {
  success: boolean;
  error?: string;
}

export interface CmsPublishResult {
  externalId: string;
  externalUrl?: string;
}

export interface CmsIssuePayload {
  title: string;
  volume?: number | null;
  issueNumber?: number | null;
  description?: string | null;
  coverImageUrl?: string | null;
  publicationDate?: Date | null;
  items: CmsPiecePayload[];
}

export interface CmsPiecePayload {
  title: string;
  content: string;
  author: string;
  sortOrder: number;
  sectionTitle?: string | null;
}

export interface CmsAdapter {
  readonly type: CmsAdapterType;

  /** Test that the connection config is valid and reachable. */
  testConnection(config: Record<string, unknown>): Promise<CmsTestResult>;

  /** Publish an issue to the CMS. Returns the external ID/URL. */
  publishIssue(
    config: Record<string, unknown>,
    issue: CmsIssuePayload,
  ): Promise<CmsPublishResult>;

  /** Unpublish/remove an issue from the CMS by its external ID. */
  unpublishIssue(
    config: Record<string, unknown>,
    externalId: string,
  ): Promise<void>;

  /** Publish or update a single piece in the CMS. */
  syncPiece(
    config: Record<string, unknown>,
    piece: CmsPiecePayload,
    externalId?: string,
  ): Promise<CmsPublishResult>;
}
