// ProseMirror document types aligned with docs/manuscript-format.md spec.
// Shared between the backend content extraction pipeline and the frontend
// ManuscriptRenderer component.

import { z } from "zod";

// --- Genre ---

export type GenreHint = "prose" | "poetry" | "hybrid" | "creative_nonfiction";

// --- Marks ---

export interface ProseMirrorMark {
  type: "emphasis" | "strong" | "small_caps" | "smart_text";
  attrs?: { original?: string };
}

// --- Nodes ---

export type ProseMirrorNodeType =
  | "paragraph"
  | "section_break"
  | "block_quote"
  | "poem_line"
  | "stanza_break"
  | "preserved_indent"
  | "caesura"
  | "preserved_whitespace";

export interface ProseMirrorNode {
  type: ProseMirrorNodeType;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  text?: string;
  marks?: ProseMirrorMark[];
}

// --- Document ---

export interface SubmissionMetadata {
  original_filename: string;
  original_format: string;
  converted_at: string; // ISO 8601
  converter_version: string;
}

export interface ProseMirrorDoc {
  type: "doc";
  attrs?: {
    genre_hint?: GenreHint;
    submission_metadata?: SubmissionMetadata;
    smart_typography_applied?: boolean;
  };
  content: ProseMirrorNode[];
}

// --- Reading Anchor ---

export interface ReadingAnchor {
  nodeIndex: number;
  charOffset: number;
}

// --- Content Extraction Status ---

export type ContentExtractionStatus =
  | "PENDING"
  | "EXTRACTING"
  | "COMPLETE"
  | "FAILED"
  | "UNSUPPORTED";

// --- Zod Schemas (for tRPC output validation) ---

export const contentExtractionStatusSchema = z.enum([
  "PENDING",
  "EXTRACTING",
  "COMPLETE",
  "FAILED",
  "UNSUPPORTED",
]);

/**
 * Lightweight structural check for ProseMirror JSON.
 * Validates the document envelope (type + content array) without
 * recursively validating every node — full node structure is
 * guaranteed by the backend converters.
 */
export const proseMirrorDocSchema = z
  .object({
    type: z.literal("doc"),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(z.unknown()),
  })
  .passthrough();
