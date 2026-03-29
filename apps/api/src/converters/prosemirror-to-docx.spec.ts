import { describe, it, expect } from 'vitest';
import { convertProseMirrorToDocx } from './prosemirror-to-docx.js';
import { convertDocxToProseMirror } from './docx-converter.js';
import type { ProseMirrorDoc, ProseMirrorNode } from '@colophony/types';

/** Helper to create a minimal ProseMirror doc. */
function makeDoc(
  content: ProseMirrorNode[],
  genreHint: 'prose' | 'poetry' = 'prose',
): ProseMirrorDoc {
  return { type: 'doc', attrs: { genre_hint: genreHint }, content };
}

/** Extract node types and text from a ProseMirror doc for structural comparison. */
function simplify(doc: ProseMirrorDoc): Array<{ type: string; text?: string }> {
  return doc.content.map((n) => {
    const entry: { type: string; text?: string } = { type: n.type };
    if (n.text) entry.text = n.text;
    if (n.content) {
      const texts = n.content
        .map((c) => c.text ?? '')
        .filter(Boolean)
        .join('');
      if (texts) entry.text = texts;
    }
    return entry;
  });
}

describe('convertProseMirrorToDocx', () => {
  it('should produce a valid .docx buffer', async () => {
    const doc = makeDoc([
      { type: 'paragraph', attrs: { indent: false }, text: 'Hello world' },
    ]);
    const buffer = await convertProseMirrorToDocx(doc);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    // .docx files are ZIP archives starting with PK signature
    expect(buffer[0]).toBe(0x50); // 'P'
    expect(buffer[1]).toBe(0x4b); // 'K'
  });

  it('should handle an empty document', async () => {
    const doc = makeDoc([]);
    const buffer = await convertProseMirrorToDocx(doc);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should handle prose paragraphs with indent', async () => {
    const doc = makeDoc([
      { type: 'paragraph', attrs: { indent: false }, text: 'First paragraph' },
      {
        type: 'paragraph',
        attrs: { indent: true },
        text: 'Second paragraph',
      },
    ]);
    const buffer = await convertProseMirrorToDocx(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should handle poetry nodes', async () => {
    const doc = makeDoc(
      [
        { type: 'poem_line', text: 'Roses are red' },
        { type: 'poem_line', text: 'Violets are blue' },
        { type: 'stanza_break' },
        {
          type: 'preserved_indent',
          attrs: { depth: 2 },
          text: 'Indented line',
        },
      ],
      'poetry',
    );
    const buffer = await convertProseMirrorToDocx(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should handle section breaks', async () => {
    const doc = makeDoc([
      { type: 'paragraph', attrs: { indent: false }, text: 'Before' },
      { type: 'section_break' },
      { type: 'paragraph', attrs: { indent: false }, text: 'After' },
    ]);
    const buffer = await convertProseMirrorToDocx(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should handle block quotes', async () => {
    const doc = makeDoc([
      {
        type: 'block_quote',
        content: [
          { type: 'paragraph', attrs: { indent: false }, text: 'Quoted text' },
        ],
      },
    ]);
    const buffer = await convertProseMirrorToDocx(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should handle marks (emphasis, strong, small_caps)', async () => {
    const doc = makeDoc([
      {
        type: 'paragraph',
        attrs: { indent: false },
        text: 'Styled text',
        marks: [{ type: 'emphasis' }, { type: 'strong' }],
      },
      {
        type: 'paragraph',
        attrs: { indent: false },
        text: 'Small caps',
        marks: [{ type: 'small_caps' }],
      },
    ]);
    const buffer = await convertProseMirrorToDocx(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should handle mixed inline formatting (TipTap content children)', async () => {
    // TipTap stores mixed formatting as content children, not flat text+marks
    const doc = makeDoc([
      {
        type: 'paragraph',
        attrs: { indent: false },
        content: [
          { type: 'paragraph', text: 'plain text ' },
          {
            type: 'paragraph',
            text: 'italic word',
            marks: [{ type: 'emphasis' }],
          },
          { type: 'paragraph', text: ' more plain' },
        ],
      },
    ]);
    const buffer = await convertProseMirrorToDocx(doc);
    expect(buffer.length).toBeGreaterThan(0);

    // Round-trip: verify all text survives
    const imported = await convertDocxToProseMirror(buffer, 'prose');
    const allText = simplify(imported)
      .map((n) => n.text)
      .filter(Boolean)
      .join(' ');
    expect(allText).toContain('plain text');
    expect(allText).toContain('italic word');
    expect(allText).toContain('more plain');
  });

  it('should handle caesura and preserved_whitespace', async () => {
    const doc = makeDoc([
      { type: 'caesura' },
      { type: 'preserved_whitespace', text: '   spaces   ' },
    ]);
    const buffer = await convertProseMirrorToDocx(doc);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe('round-trip: export then import', () => {
  it('should preserve prose paragraph text through round-trip', async () => {
    const original = makeDoc([
      { type: 'paragraph', attrs: { indent: false }, text: 'First paragraph' },
      {
        type: 'paragraph',
        attrs: { indent: true },
        text: 'Second paragraph',
      },
    ]);

    const buffer = await convertProseMirrorToDocx(original);
    const imported = await convertDocxToProseMirror(buffer, 'prose');

    const simplified = simplify(imported);
    expect(simplified).toHaveLength(2);
    expect(simplified[0].text).toBe('First paragraph');
    expect(simplified[1].text).toBe('Second paragraph');
    expect(simplified[0].type).toBe('paragraph');
    expect(simplified[1].type).toBe('paragraph');
  });

  it('should preserve section break markers through round-trip', async () => {
    const original = makeDoc([
      { type: 'paragraph', attrs: { indent: false }, text: 'Before' },
      { type: 'section_break' },
      { type: 'paragraph', attrs: { indent: false }, text: 'After' },
    ]);

    const buffer = await convertProseMirrorToDocx(original);
    const imported = await convertDocxToProseMirror(buffer, 'prose');

    const simplified = simplify(imported);
    const types = simplified.map((n) => n.type);
    expect(types).toContain('section_break');
    expect(simplified.find((n) => n.text === 'Before')).toBeTruthy();
    expect(simplified.find((n) => n.text === 'After')).toBeTruthy();
  });

  it('should preserve poetry line text through round-trip', async () => {
    const original = makeDoc(
      [
        { type: 'poem_line', text: 'Roses are red' },
        { type: 'poem_line', text: 'Violets are blue' },
      ],
      'poetry',
    );

    const buffer = await convertProseMirrorToDocx(original);
    const imported = await convertDocxToProseMirror(buffer, 'poetry');

    const simplified = simplify(imported);
    expect(simplified).toHaveLength(2);
    expect(simplified[0].text).toBe('Roses are red');
    expect(simplified[1].text).toBe('Violets are blue');
  });

  it('should preserve poem line text even when stanza breaks are collapsed', async () => {
    // mammoth collapses empty paragraphs in its HTML output, so stanza breaks
    // (empty <p>) don't survive the round-trip. This is a known limitation of
    // the .docx round-trip — the text content is preserved but stanza structure
    // may be lost. The editor can re-add stanza breaks in the TipTap editor.
    const original = makeDoc(
      [
        { type: 'poem_line', text: 'Line one' },
        { type: 'stanza_break' },
        { type: 'poem_line', text: 'Line two' },
      ],
      'poetry',
    );

    const buffer = await convertProseMirrorToDocx(original);
    const imported = await convertDocxToProseMirror(buffer, 'poetry');

    const simplified = simplify(imported);
    const texts = simplified.filter((n) => n.text).map((n) => n.text);
    expect(texts).toContain('Line one');
    expect(texts).toContain('Line two');
  });
});
