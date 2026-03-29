import mammoth from 'mammoth';
import { Parser } from 'htmlparser2';
import type {
  ProseMirrorDoc,
  ProseMirrorNode,
  ProseMirrorMark,
  GenreHint,
} from '@colophony/types';

/**
 * Convert a .docx buffer to ProseMirror JSON.
 * Uses mammoth to extract HTML, then maps HTML elements to ProseMirror nodes.
 */
export async function convertDocxToProseMirror(
  buffer: Buffer,
  genreHint?: GenreHint,
): Promise<ProseMirrorDoc> {
  const hint = genreHint ?? 'prose';

  const result = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: ['u => em', "r[style-name='Small Caps'] => small-caps"],
    },
  );

  const nodes = parseHtmlToNodes(result.value, hint);

  return {
    type: 'doc',
    attrs: { genre_hint: hint },
    content: nodes.length > 0 ? nodes : [],
  };
}

interface ParseState {
  nodes: ProseMirrorNode[];
  currentText: string;
  currentMarks: ProseMirrorMark[];
  /** Marks collected during this paragraph (superset of marks seen while text was added). */
  paragraphMarks: Set<string>;
  hint: GenreHint;
  inBlockquote: boolean;
  blockquoteContent: ProseMirrorNode[];
}

function parseHtmlToNodes(html: string, hint: GenreHint): ProseMirrorNode[] {
  const state: ParseState = {
    nodes: [],
    currentText: '',
    currentMarks: [],
    paragraphMarks: new Set(),
    hint,
    inBlockquote: false,
    blockquoteContent: [],
  };

  const markStack: ProseMirrorMark[][] = [];

  const parser = new Parser(
    {
      onopentag(name) {
        if (name === 'p') {
          state.currentText = '';
          state.currentMarks = [];
          state.paragraphMarks = new Set();
        } else if (name === 'em' || name === 'i') {
          markStack.push([...state.currentMarks]);
          state.currentMarks = [...state.currentMarks, { type: 'emphasis' }];
        } else if (name === 'strong' || name === 'b') {
          markStack.push([...state.currentMarks]);
          state.currentMarks = [...state.currentMarks, { type: 'strong' }];
        } else if (name === 'small-caps') {
          markStack.push([...state.currentMarks]);
          state.currentMarks = [...state.currentMarks, { type: 'small_caps' }];
        } else if (name === 'blockquote') {
          state.inBlockquote = true;
          state.blockquoteContent = [];
        }
      },

      ontext(text) {
        state.currentText += text;
        // Track which marks were active while text was being added
        for (const mark of state.currentMarks) {
          state.paragraphMarks.add(mark.type);
        }
      },

      onclosetag(name) {
        if (name === 'p') {
          const trimmed = state.currentText.trim();

          // Empty paragraph → section/stanza break
          if (!trimmed) {
            const breakType =
              hint === 'poetry' ? 'stanza_break' : 'section_break';
            if (state.inBlockquote) {
              state.blockquoteContent.push({ type: breakType });
            } else {
              state.nodes.push({ type: breakType });
            }
            return;
          }

          // Round-trip markers: recognize section break text exported by
          // prosemirror-to-docx.ts so the structure survives a Word round-trip.
          if (
            trimmed === '* * *' ||
            trimmed === '***' ||
            trimmed === '\u2042'
          ) {
            const breakNode: ProseMirrorNode = { type: 'section_break' };
            if (state.inBlockquote) {
              state.blockquoteContent.push(breakNode);
            } else {
              state.nodes.push(breakNode);
            }
            return;
          }

          let node: ProseMirrorNode;

          if (hint === 'poetry') {
            // Detect leading whitespace for preserved_indent
            const leadingMatch = state.currentText.match(/^(\s+)/);
            const leading = leadingMatch ? leadingMatch[1] : '';
            const depth = Math.ceil(leading.length / 2);

            if (depth > 0) {
              node = {
                type: 'preserved_indent',
                attrs: { depth },
                text: trimmed,
              };
            } else {
              node = { type: 'poem_line', text: trimmed };
            }
          } else {
            node = {
              type: 'paragraph',
              attrs: { indent: false },
              text: trimmed,
            };
          }

          // Attach marks that were active during text accumulation
          if (state.paragraphMarks.size > 0) {
            node.marks = [...state.paragraphMarks].map(
              (type) => ({ type }) as ProseMirrorMark,
            );
          }

          if (state.inBlockquote) {
            state.blockquoteContent.push(node);
          } else {
            state.nodes.push(node);
          }
        } else if (
          name === 'em' ||
          name === 'i' ||
          name === 'strong' ||
          name === 'b' ||
          name === 'small-caps'
        ) {
          state.currentMarks = markStack.pop() ?? [];
        } else if (name === 'blockquote') {
          state.inBlockquote = false;
          if (state.blockquoteContent.length > 0) {
            state.nodes.push({
              type: 'block_quote',
              content: state.blockquoteContent,
            });
          }
        }
      },
    },
    { decodeEntities: true },
  );

  parser.write(html);
  parser.end();

  // Apply indent: true to prose paragraphs after the first in each section
  if (hint !== 'poetry') {
    let paragraphIndex = 0;
    for (const node of state.nodes) {
      if (node.type === 'paragraph') {
        node.attrs = { ...node.attrs, indent: paragraphIndex > 0 };
        paragraphIndex++;
      } else if (node.type === 'section_break') {
        paragraphIndex = 0;
      }
    }
  }

  return state.nodes;
}
