// ProseMirror document types — re-exported from shared package.
// Converter functions are frontend-only (plain-text fallback before backend
// content extraction pipeline).

// --- Types (from shared package) ---

export type {
  GenreHint,
  ProseMirrorMark,
  ProseMirrorNodeType,
  ProseMirrorNode,
  SubmissionMetadata,
  ProseMirrorDoc,
  ReadingAnchor,
} from "@colophony/types";

import type {
  GenreHint,
  ProseMirrorNode,
  ProseMirrorDoc,
} from "@colophony/types";

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
