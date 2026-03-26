import { describe, it, expect } from 'vitest';
import { convertTextToProseMirror } from '../../converters/text-converter.js';

describe('text-converter', () => {
  it('converts prose text to paragraphs', () => {
    const doc = convertTextToProseMirror(
      'First paragraph\n\nSecond paragraph',
      'prose',
    );
    expect(doc.content).toHaveLength(2);
    expect(doc.content[0]).toEqual({
      type: 'paragraph',
      attrs: { indent: false },
      text: 'First paragraph',
    });
    expect(doc.content[1]).toEqual({
      type: 'paragraph',
      attrs: { indent: true },
      text: 'Second paragraph',
    });
  });

  it('detects section breaks from triple newlines', () => {
    const doc = convertTextToProseMirror('Para one\n\n\nPara two', 'prose');
    expect(doc.content).toHaveLength(3);
    expect(doc.content[0].type).toBe('paragraph');
    expect(doc.content[1].type).toBe('section_break');
    expect(doc.content[2].type).toBe('paragraph');
  });

  it('converts poetry to poem_line nodes', () => {
    const doc = convertTextToProseMirror('Line one\nLine two', 'poetry');
    expect(doc.content).toHaveLength(2);
    expect(doc.content[0]).toEqual({ type: 'poem_line', text: 'Line one' });
    expect(doc.content[1]).toEqual({ type: 'poem_line', text: 'Line two' });
  });

  it('handles stanza breaks in poetry', () => {
    const doc = convertTextToProseMirror('Line one\n\nLine two', 'poetry');
    expect(doc.content).toHaveLength(3);
    expect(doc.content[0].type).toBe('poem_line');
    expect(doc.content[1].type).toBe('stanza_break');
    expect(doc.content[2].type).toBe('poem_line');
  });

  it('preserves indentation as preserved_indent', () => {
    const doc = convertTextToProseMirror('    Indented line', 'poetry');
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].type).toBe('preserved_indent');
    expect(doc.content[0].attrs).toEqual({ depth: 2 });
    expect(doc.content[0].text).toBe('Indented line');
  });

  it('returns empty content for empty text', () => {
    const doc = convertTextToProseMirror('', 'prose');
    expect(doc.content).toHaveLength(0);
  });

  it('defaults to prose when no hint given', () => {
    const doc = convertTextToProseMirror('Hello world');
    expect(doc.attrs?.genre_hint).toBe('prose');
    expect(doc.content[0].type).toBe('paragraph');
  });

  it('sets genre_hint on document attrs', () => {
    const doc = convertTextToProseMirror('text', 'poetry');
    expect(doc.attrs?.genre_hint).toBe('poetry');
  });
});
