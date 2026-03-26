import type {
  ProseMirrorDoc,
  ProseMirrorNode,
  GenreHint,
} from '@colophony/types';

/**
 * Convert plain text to a ProseMirrorDoc.
 * Server-side equivalent of the frontend textToProseMirrorDoc.
 */
export function convertTextToProseMirror(
  text: string,
  genreHint?: GenreHint,
): ProseMirrorDoc {
  const hint = genreHint ?? 'prose';
  const content: ProseMirrorNode[] =
    hint === 'poetry' ? convertPoetry(text) : convertProse(text);

  return {
    type: 'doc',
    attrs: { genre_hint: hint },
    content,
  };
}

function convertProse(text: string): ProseMirrorNode[] {
  if (!text.trim()) return [];

  const nodes: ProseMirrorNode[] = [];
  const parts = text.split(/(\n{2,})/);
  let paragraphIndex = 0;

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) {
      if (part.length >= 3 && /\n{3,}/.test(part)) {
        nodes.push({ type: 'section_break' });
      }
      continue;
    }

    nodes.push({
      type: 'paragraph',
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
  const stanzas = text.split(/\n{2,}/);

  for (let i = 0; i < stanzas.length; i++) {
    if (i > 0) {
      nodes.push({ type: 'stanza_break' });
    }

    const stanza = stanzas[i];
    if (!stanza.trim()) continue;

    const lines = stanza.split('\n');
    for (const line of lines) {
      const leadingSpaces = line.match(/^(\s*)/)?.[1] ?? '';
      const depth = Math.ceil(leadingSpaces.length / 2);
      const trimmedLine = line.trimStart();

      if (!trimmedLine && !leadingSpaces) continue;

      if (depth > 0) {
        nodes.push({
          type: 'preserved_indent',
          attrs: { depth },
          text: trimmedLine,
        });
      } else {
        nodes.push({
          type: 'poem_line',
          text: trimmedLine || ' ',
        });
      }
    }
  }

  return nodes;
}
