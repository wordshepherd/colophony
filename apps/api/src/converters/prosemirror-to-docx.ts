import {
  Document,
  Paragraph,
  TextRun,
  Packer,
  AlignmentType,
  convertInchesToTwip,
} from 'docx';
import type {
  ProseMirrorDoc,
  ProseMirrorNode,
  ProseMirrorMark,
} from '@colophony/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FONT_NAME = 'Times New Roman';
const FONT_SIZE_PT = 12;
/** 1 twip = 1/1440 inch. 720 twips = 0.5 inch first-line indent. */
const FIRST_LINE_INDENT_TWIP = 720;
/** Per-depth left indent for preserved_indent (0.25 inch per depth). */
const INDENT_PER_DEPTH_TWIP = 360;
/** Left/right indent for block quotes. */
const BLOCKQUOTE_INDENT_TWIP = 720;
/** Line spacing multiplier × 240 (Word units). 1.5 spacing = 360. */
const LINE_SPACING_PROSE = 360;
/** Single spacing for poetry = 240. */
const LINE_SPACING_POETRY = 240;

// Section break marker — literary convention, recognizable on round-trip import
const SECTION_BREAK_TEXT = '* * *';

// ---------------------------------------------------------------------------
// Mark → TextRun options
// ---------------------------------------------------------------------------

function marksToRunOptions(marks?: ProseMirrorMark[]): Record<string, boolean> {
  const opts: Record<string, boolean> = {};
  if (!marks) return opts;
  for (const mark of marks) {
    switch (mark.type) {
      case 'emphasis':
        opts.italics = true;
        break;
      case 'strong':
        opts.bold = true;
        break;
      case 'small_caps':
        opts.smallCaps = true;
        break;
      // 'smart_text' is display-only, no formatting needed
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Text extraction helpers
// ---------------------------------------------------------------------------

/** Extract text from a node that may have inline content children or a text field. */
function getNodeText(node: ProseMirrorNode): string {
  if (node.text != null) return node.text;
  if (node.content) {
    return node.content
      .map((child) => (child.text != null ? child.text : ''))
      .join('');
  }
  return '';
}

/** Build TextRun array from a node. */
function buildTextRuns(node: ProseMirrorNode): TextRun[] {
  const text = getNodeText(node);
  if (!text) return [];

  const markOpts = marksToRunOptions(node.marks);
  return [
    new TextRun({
      text,
      font: FONT_NAME,
      size: FONT_SIZE_PT * 2, // half-points
      ...markOpts,
    }),
  ];
}

// ---------------------------------------------------------------------------
// Node → Paragraph converters
// ---------------------------------------------------------------------------

function convertParagraph(node: ProseMirrorNode, isPoetry: boolean): Paragraph {
  const indent = (node.attrs as { indent?: boolean } | undefined)?.indent;
  return new Paragraph({
    children: buildTextRuns(node),
    spacing: { line: isPoetry ? LINE_SPACING_POETRY : LINE_SPACING_PROSE },
    indent: indent ? { firstLine: FIRST_LINE_INDENT_TWIP } : undefined,
  });
}

function convertPoemLine(node: ProseMirrorNode): Paragraph {
  return new Paragraph({
    children: buildTextRuns(node),
    spacing: { line: LINE_SPACING_POETRY },
  });
}

function convertPreservedIndent(node: ProseMirrorNode): Paragraph {
  const depth = (node.attrs as { depth?: number } | undefined)?.depth ?? 1;
  return new Paragraph({
    children: buildTextRuns(node),
    spacing: { line: LINE_SPACING_POETRY },
    indent: { left: depth * INDENT_PER_DEPTH_TWIP },
  });
}

function convertSectionBreak(): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: SECTION_BREAK_TEXT,
        font: FONT_NAME,
        size: FONT_SIZE_PT * 2,
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 240 },
  });
}

function convertStanzaBreak(): Paragraph {
  return new Paragraph({
    children: [],
    spacing: { line: LINE_SPACING_POETRY },
  });
}

function convertBlockQuote(
  node: ProseMirrorNode,
  isPoetry: boolean,
): Paragraph[] {
  if (!node.content) return [];
  return node.content.map((child) => {
    const runs = buildTextRuns(child);
    return new Paragraph({
      children: runs,
      spacing: { line: isPoetry ? LINE_SPACING_POETRY : LINE_SPACING_PROSE },
      indent: {
        left: BLOCKQUOTE_INDENT_TWIP,
        right: BLOCKQUOTE_INDENT_TWIP,
      },
    });
  });
}

function convertCaesura(): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: '\u2014', // em-dash
        font: FONT_NAME,
        size: FONT_SIZE_PT * 2,
      }),
    ],
    alignment: AlignmentType.CENTER,
  });
}

function convertPreservedWhitespace(node: ProseMirrorNode): Paragraph {
  const text = getNodeText(node);
  return new Paragraph({
    children: [
      new TextRun({
        text: text || ' ',
        font: FONT_NAME,
        size: FONT_SIZE_PT * 2,
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

/**
 * Convert a ProseMirror document to a .docx Buffer.
 * Preserves structural semantics: prose paragraphs, poetry lines,
 * section/stanza breaks, block quotes, and inline marks.
 */
export async function convertProseMirrorToDocx(
  doc: ProseMirrorDoc,
): Promise<Buffer> {
  const genreHint = doc.attrs?.genre_hint ?? 'prose';
  const isPoetry = genreHint === 'poetry';

  const paragraphs: Paragraph[] = [];

  for (const node of doc.content) {
    switch (node.type) {
      case 'paragraph':
        paragraphs.push(convertParagraph(node, isPoetry));
        break;
      case 'poem_line':
        paragraphs.push(convertPoemLine(node));
        break;
      case 'preserved_indent':
        paragraphs.push(convertPreservedIndent(node));
        break;
      case 'section_break':
        paragraphs.push(convertSectionBreak());
        break;
      case 'stanza_break':
        paragraphs.push(convertStanzaBreak());
        break;
      case 'block_quote':
        paragraphs.push(...convertBlockQuote(node, isPoetry));
        break;
      case 'caesura':
        paragraphs.push(convertCaesura());
        break;
      case 'preserved_whitespace':
        paragraphs.push(convertPreservedWhitespace(node));
        break;
    }
  }

  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
            },
          },
        },
        children: paragraphs,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(document));
}
