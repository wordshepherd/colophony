/**
 * Custom TipTap extensions for Colophony's ProseMirror manuscript format.
 *
 * Maps between the flat Colophony format (text/marks on block nodes)
 * and TipTap's standard format (text as nested { type: "text" } children).
 */

import { Node, Mark, mergeAttributes } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import type {
  ProseMirrorDoc,
  ProseMirrorNode,
  ProseMirrorMark,
  GenreHint,
} from "@colophony/types";

// ---------------------------------------------------------------------------
// Custom Node Extensions
// ---------------------------------------------------------------------------

export const PoemLine = Node.create({
  name: "poem_line",
  group: "block",
  content: "inline*",

  parseHTML() {
    return [{ tag: "div[data-poem-line]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-poem-line": "",
        class: "whitespace-pre",
      }),
      0,
    ];
  },
});

export const StanzaBreak = Node.create({
  name: "stanza_break",
  group: "block",
  atom: true,

  parseHTML() {
    return [{ tag: "div[data-stanza-break]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-stanza-break": "",
        class: "my-6",
        "aria-hidden": "true",
      }),
    ];
  },
});

export const PreservedIndent = Node.create({
  name: "preserved_indent",
  group: "block",
  content: "inline*",

  addAttributes() {
    return { depth: { default: 1 } };
  },

  parseHTML() {
    return [{ tag: "div[data-preserved-indent]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const depth = (node.attrs.depth as number) ?? 1;
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-preserved-indent": "",
        class: "whitespace-pre",
        style: `padding-left: ${depth * 2}em`,
      }),
      0,
    ];
  },
});

export const SectionBreak = Node.create({
  name: "section_break",
  group: "block",
  atom: true,

  parseHTML() {
    return [{ tag: "div[data-section-break]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-section-break": "",
        class: "my-8 border-t border-muted-foreground/20",
        "aria-hidden": "true",
      }),
    ];
  },
});

export const Caesura = Node.create({
  name: "caesura",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return { width: { default: 2 } };
  },

  parseHTML() {
    return [{ tag: "span[data-caesura]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const width = (node.attrs.width as number) ?? 2;
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-caesura": "",
        style: `display: inline-block; width: ${width}em`,
      }),
    ];
  },
});

// ---------------------------------------------------------------------------
// Custom Mark Extensions
// ---------------------------------------------------------------------------

export const SmallCaps = Mark.create({
  name: "small_caps",

  parseHTML() {
    return [{ tag: "span.font-variant-small-caps" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "font-variant-small-caps",
      }),
      0,
    ];
  },
});

export const SmartText = Mark.create({
  name: "smart_text",

  addAttributes() {
    return { original: { default: null } };
  },

  parseHTML() {
    return [{ tag: "span[data-smart-text]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-smart-text": "" }),
      0,
    ];
  },
});

// ---------------------------------------------------------------------------
// All manuscript extensions as a single array for editor setup
// ---------------------------------------------------------------------------

export const manuscriptExtensions = [
  PoemLine,
  StanzaBreak,
  PreservedIndent,
  SectionBreak,
  Caesura,
  SmallCaps,
  SmartText,
];

// ---------------------------------------------------------------------------
// Format Converters
// ---------------------------------------------------------------------------

/** Atom node types that have no text content. */
const ATOM_TYPES = new Set(["section_break", "stanza_break", "caesura"]);

/** Container node types that have child nodes instead of text. */
const CONTAINER_TYPES = new Set(["block_quote"]);

/**
 * Convert marks from Colophony format to TipTap format.
 * TipTap uses the same shape but wants `attrs` as a plain object.
 */
function convertMarksToTiptap(
  marks: ProseMirrorMark[] | undefined,
): JSONContent["marks"] {
  if (!marks || marks.length === 0) return undefined;
  return marks.map((m) => ({
    type: m.type,
    ...(m.attrs ? { attrs: { ...m.attrs } } : {}),
  }));
}

/**
 * Convert marks from TipTap format back to Colophony format.
 */
function convertMarksFromTiptap(
  marks: JSONContent["marks"],
): ProseMirrorMark[] | undefined {
  if (!marks || marks.length === 0) return undefined;
  return marks.map((m) => ({
    type: m.type as ProseMirrorMark["type"],
    ...(m.attrs ? { attrs: m.attrs as { original?: string } } : {}),
  }));
}

/**
 * Convert a single Colophony node to TipTap JSONContent.
 *
 * Colophony's flat format: `{ type: "paragraph", text: "Hello", marks: [...] }`
 * TipTap's nested format: `{ type: "paragraph", content: [{ type: "text", text: "Hello", marks: [...] }] }`
 */
function nodeToTiptap(node: ProseMirrorNode): JSONContent {
  const { type, attrs, text, marks, content } = node;

  // Atom nodes (no content, no text)
  if (ATOM_TYPES.has(type)) {
    return { type, ...(attrs ? { attrs: { ...attrs } } : {}) };
  }

  // Container nodes (recurse into content)
  if (CONTAINER_TYPES.has(type) && content) {
    return {
      type: type === "block_quote" ? "blockquote" : type,
      ...(attrs ? { attrs: { ...attrs } } : {}),
      content: content.map(nodeToTiptap),
    };
  }

  // Text-bearing nodes: wrap text in a { type: "text" } child
  const result: JSONContent = {
    type,
    ...(attrs ? { attrs: { ...attrs } } : {}),
  };

  if (text) {
    result.content = [
      {
        type: "text",
        text,
        marks: convertMarksToTiptap(marks),
      },
    ];
  }

  return result;
}

/**
 * Convert a single TipTap JSONContent node back to Colophony format.
 *
 * Extracts text from nested { type: "text" } children and lifts it
 * to the parent node. Multi-segment text (multiple text children with
 * different marks) is concatenated — marks from the first segment are used.
 */
function nodeFromTiptap(node: JSONContent): ProseMirrorNode {
  const { type, attrs, content } = node;
  const nodeType = type as ProseMirrorNode["type"];

  // Atom nodes
  if (type && ATOM_TYPES.has(type)) {
    return {
      type: nodeType,
      ...(attrs ? { attrs: { ...attrs } } : {}),
    };
  }

  // Container nodes (TipTap uses "blockquote", Colophony uses "block_quote")
  const colophonyType = type === "blockquote" ? "block_quote" : nodeType;

  if (
    type &&
    (CONTAINER_TYPES.has(colophonyType) || type === "blockquote") &&
    content
  ) {
    return {
      type: colophonyType,
      ...(attrs ? { attrs: { ...attrs } } : {}),
      content: content.map(nodeFromTiptap),
    };
  }

  // Text-bearing nodes: extract text from children
  const result: ProseMirrorNode = {
    type: colophonyType,
    ...(attrs ? { attrs: { ...attrs } } : {}),
  };

  if (content && content.length > 0) {
    // Collect text segments and marks from text children
    const textParts: string[] = [];
    let firstMarks: ProseMirrorMark[] | undefined;

    for (const child of content) {
      if (child.type === "text" && child.text) {
        textParts.push(child.text);
        if (firstMarks === undefined) {
          firstMarks = convertMarksFromTiptap(child.marks);
        }
      }
    }

    if (textParts.length > 0) {
      result.text = textParts.join("");
      if (firstMarks) {
        result.marks = firstMarks;
      }
    }
  }

  return result;
}

/**
 * Convert a Colophony ProseMirrorDoc to TipTap JSONContent.
 *
 * Used to load manuscript content into a TipTap editor.
 */
export function proseMirrorToTiptap(doc: ProseMirrorDoc): JSONContent {
  return {
    type: "doc",
    content: doc.content.map(nodeToTiptap),
  };
}

/**
 * Convert TipTap JSONContent back to a Colophony ProseMirrorDoc.
 *
 * Preserves doc-level attrs from the original document (genre_hint,
 * submission_metadata, smart_typography_applied).
 */
export function tiptapToProseMirror(
  json: JSONContent,
  originalDoc?: ProseMirrorDoc,
): ProseMirrorDoc {
  const content = (json.content ?? []).map(nodeFromTiptap);

  return {
    type: "doc",
    attrs: originalDoc?.attrs
      ? { ...originalDoc.attrs }
      : { genre_hint: "prose" as GenreHint },
    content,
  };
}

/**
 * Extract plain text from a ProseMirrorDoc.
 * Used for diff computation.
 */
export function extractPlainText(doc: ProseMirrorDoc): string {
  const parts: string[] = [];

  function walk(nodes: ProseMirrorNode[]) {
    for (const node of nodes) {
      if (node.text) {
        parts.push(node.text);
      }
      if (node.type === "stanza_break" || node.type === "section_break") {
        parts.push("\n\n");
      } else if (
        node.type === "paragraph" ||
        node.type === "poem_line" ||
        node.type === "preserved_indent"
      ) {
        parts.push("\n");
      }
      if (node.content) {
        walk(node.content);
      }
    }
  }

  walk(doc.content);
  return parts.join("").trim();
}
