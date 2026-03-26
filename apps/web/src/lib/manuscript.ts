// ProseMirror document types aligned with docs/manuscript-format.md spec
// and a plain-text-to-ProseMirror converter for immediate use before
// the backend content extraction pipeline ships.

// --- Types ---

export type GenreHint = "prose" | "poetry" | "hybrid" | "creative_nonfiction";

export interface ProseMirrorMark {
  type: "emphasis" | "strong" | "small_caps" | "smart_text";
  attrs?: { original?: string };
}

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

export interface ReadingAnchor {
  nodeIndex: number;
  charOffset: number;
}

// --- Converter ---

/**
 * Convert plain text to a basic ProseMirrorDoc.
 *
 * Prose mode (default):
 *   - Double newlines (\n\n) → paragraph breaks
 *   - Triple+ newlines (\n\n\n+) → section_break between paragraphs
 *   - First paragraph: indent false; subsequent: indent true
 *
 * Poetry mode:
 *   - Single newlines → poem_line nodes
 *   - Double+ newlines → stanza_break nodes
 */
export function textToProseMirrorDoc(
  text: string,
  genreHint?: GenreHint,
): ProseMirrorDoc {
  const hint = genreHint ?? "prose";
  const content: ProseMirrorNode[] =
    hint === "poetry" ? convertPoetry(text) : convertProse(text);

  return {
    type: "doc",
    attrs: { genre_hint: hint },
    content,
  };
}

function convertProse(text: string): ProseMirrorNode[] {
  if (!text.trim()) return [];

  const nodes: ProseMirrorNode[] = [];
  // Split on 2+ newlines, keeping the delimiter to detect section breaks (3+)
  const parts = text.split(/(\n{2,})/);
  let paragraphIndex = 0;

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) {
      // This is a delimiter — check if it's a section break (3+ newlines)
      if (part.length >= 3 && /\n{3,}/.test(part)) {
        nodes.push({ type: "section_break" });
      }
      continue;
    }

    nodes.push({
      type: "paragraph",
      attrs: { indent: paragraphIndex > 0 },
      text: trimmed,
    });
    paragraphIndex++;
  }

  return nodes;
}

function convertPoetry(text: string): ProseMirrorNode[] {
  if (!text.trim()) return [];

  const nodes: ProseMirrorNode[] = [];
  // Split into stanzas on double+ newlines
  const stanzas = text.split(/\n{2,}/);

  for (let i = 0; i < stanzas.length; i++) {
    if (i > 0) {
      nodes.push({ type: "stanza_break" });
    }

    const stanza = stanzas[i];
    if (!stanza.trim()) continue;

    const lines = stanza.split("\n");
    for (const line of lines) {
      // Preserve leading whitespace as preserved_indent
      const leadingSpaces = line.match(/^(\s*)/)?.[1] ?? "";
      const depth = Math.ceil(leadingSpaces.length / 2); // 2 spaces = 1 depth
      const trimmedLine = line.trimStart();

      if (!trimmedLine && !leadingSpaces) continue;

      if (depth > 0) {
        nodes.push({
          type: "preserved_indent",
          attrs: { depth },
          text: trimmedLine,
        });
      } else {
        nodes.push({
          type: "poem_line",
          text: trimmedLine || " ", // preserve intentional blank lines within stanza
        });
      }
    }
  }

  return nodes;
}
