import type {
  ProseMirrorDoc,
  ProseMirrorNode,
  ProseMirrorMark,
} from '@colophony/types';

// Abbreviations that should not trigger ellipsis conversion
const ABBREVIATIONS = new Set([
  'mr.',
  'mrs.',
  'ms.',
  'dr.',
  'sr.',
  'jr.',
  'vs.',
  'etc.',
  'i.e.',
  'e.g.',
  'prof.',
  'inc.',
  'ltd.',
  'dept.',
  'est.',
  'govt.',
  'approx.',
  'no.',
  'vol.',
  'ed.',
  'rev.',
  'gen.',
  'sgt.',
  'cpl.',
  'pvt.',
  'st.',
  'ave.',
  'blvd.',
  'ft.',
  'mt.',
]);

/**
 * Apply smart typography to a single text string.
 * Returns the normalized text and whether any changes were made.
 */
export function smartifyText(text: string): { text: string; changed: boolean } {
  let result = '';
  let changed = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const prev = i > 0 ? text[i - 1] : '';
    const next = i < text.length - 1 ? text[i + 1] : '';

    // Em dash: -- or ---
    if (ch === '-' && next === '-') {
      // Consume all consecutive dashes (-- or ---)
      let dashCount = 0;
      let j = i;
      while (j < text.length && text[j] === '-') {
        dashCount++;
        j++;
      }
      if (dashCount >= 2) {
        result += '\u2014'; // em dash
        changed = true;
        i = j - 1;
        continue;
      }
    }

    // Ellipsis: ... but not abbreviations
    if (
      ch === '.' &&
      next === '.' &&
      i + 2 < text.length &&
      text[i + 2] === '.'
    ) {
      // Check if this is part of an abbreviation by looking backward
      const beforeDots = text.slice(0, i).toLowerCase();
      let isAbbreviation = false;
      for (const abbr of ABBREVIATIONS) {
        // Check if text before the dots ends with the abbreviation prefix (without final dot)
        const prefix = abbr.slice(0, -1); // remove trailing dot
        if (beforeDots.endsWith(prefix)) {
          isAbbreviation = true;
          break;
        }
      }
      if (!isAbbreviation) {
        result += '\u2026'; // ellipsis
        changed = true;
        i += 2;
        continue;
      }
    }

    // Double quotes
    if (ch === '"') {
      const isOpening =
        !prev || /\s/.test(prev) || prev === '(' || prev === '[';
      result += isOpening ? '\u201c' : '\u201d';
      changed = true;
      continue;
    }

    // Single quotes / apostrophes
    if (ch === "'") {
      // Apostrophe: preceded by a letter and followed by a letter (contraction)
      if (/[a-zA-Z]/.test(prev) && /[a-zA-Z]/.test(next)) {
        result += '\u2019'; // right single quote (apostrophe)
        changed = true;
        continue;
      }
      // Opening quote: at start, after whitespace, or after opening bracket
      const isOpening =
        !prev || /\s/.test(prev) || prev === '(' || prev === '[';
      result += isOpening ? '\u2018' : '\u2019';
      changed = true;
      continue;
    }

    result += ch;
  }

  return { text: result, changed };
}

/**
 * Apply smart typography to a ProseMirror document.
 * Returns a new document with smart_text marks where text was modified.
 * Does not mutate the input.
 */
export function applySmartTypography(doc: ProseMirrorDoc): ProseMirrorDoc {
  return {
    ...doc,
    attrs: {
      ...doc.attrs,
      smart_typography_applied: true,
    },
    content: doc.content.map(processNode),
  };
}

function processNode(node: ProseMirrorNode): ProseMirrorNode {
  // Text nodes: apply smart typography
  if (node.text !== undefined) {
    const { text: smartText, changed } = smartifyText(node.text);
    if (changed) {
      const smartMark: ProseMirrorMark = {
        type: 'smart_text',
        attrs: { original: node.text },
      };
      return {
        ...node,
        text: smartText,
        marks: [...(node.marks ?? []), smartMark],
      };
    }
    return node;
  }

  // Nodes with content: recurse
  if (node.content) {
    return {
      ...node,
      content: node.content.map(processNode),
    };
  }

  return node;
}
