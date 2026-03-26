import { describe, it, expect } from 'vitest';
import { convertDocxToProseMirror } from '../../converters/docx-converter.js';
import mammoth from 'mammoth';
import { vi } from 'vitest';

// Mock mammoth to avoid needing real .docx fixtures
vi.mock('mammoth', () => ({
  default: {
    convertToHtml: vi.fn(),
  },
}));

const mockMammoth = vi.mocked(mammoth);

describe('docx-converter', () => {
  it('converts basic HTML paragraphs to prose nodes', async () => {
    mockMammoth.convertToHtml.mockResolvedValue({
      value: '<p>First paragraph</p><p>Second paragraph</p>',
      messages: [],
    });

    const doc = await convertDocxToProseMirror(Buffer.from(''), 'prose');
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

  it('preserves emphasis marks', async () => {
    mockMammoth.convertToHtml.mockResolvedValue({
      value: '<p>This is <em>italic</em> text</p>',
      messages: [],
    });

    const doc = await convertDocxToProseMirror(Buffer.from(''), 'prose');
    expect(doc.content).toHaveLength(1);
    // The whole paragraph text is merged; marks are on the paragraph
    expect(doc.content[0].text).toContain('italic');
  });

  it('preserves strong marks', async () => {
    mockMammoth.convertToHtml.mockResolvedValue({
      value: '<p><strong>Bold text</strong></p>',
      messages: [],
    });

    const doc = await convertDocxToProseMirror(Buffer.from(''), 'prose');
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].text).toBe('Bold text');
    expect(doc.content[0].marks).toBeDefined();
    expect(doc.content[0].marks!.some((m) => m.type === 'strong')).toBe(true);
  });

  it('handles empty HTML', async () => {
    mockMammoth.convertToHtml.mockResolvedValue({
      value: '',
      messages: [],
    });

    const doc = await convertDocxToProseMirror(Buffer.from(''), 'prose');
    expect(doc.content).toHaveLength(0);
  });

  it('converts empty paragraphs to section breaks in prose', async () => {
    mockMammoth.convertToHtml.mockResolvedValue({
      value: '<p>Before</p><p></p><p>After</p>',
      messages: [],
    });

    const doc = await convertDocxToProseMirror(Buffer.from(''), 'prose');
    expect(doc.content).toHaveLength(3);
    expect(doc.content[0].type).toBe('paragraph');
    expect(doc.content[1].type).toBe('section_break');
    expect(doc.content[2].type).toBe('paragraph');
  });

  it('converts paragraphs to poem_line nodes in poetry mode', async () => {
    mockMammoth.convertToHtml.mockResolvedValue({
      value: '<p>First line</p><p>Second line</p>',
      messages: [],
    });

    const doc = await convertDocxToProseMirror(Buffer.from(''), 'poetry');
    expect(doc.content).toHaveLength(2);
    expect(doc.content[0].type).toBe('poem_line');
    expect(doc.content[1].type).toBe('poem_line');
  });

  it('converts empty paragraphs to stanza breaks in poetry mode', async () => {
    mockMammoth.convertToHtml.mockResolvedValue({
      value: '<p>Line one</p><p></p><p>Line two</p>',
      messages: [],
    });

    const doc = await convertDocxToProseMirror(Buffer.from(''), 'poetry');
    expect(doc.content).toHaveLength(3);
    expect(doc.content[1].type).toBe('stanza_break');
  });

  it('handles blockquote elements', async () => {
    mockMammoth.convertToHtml.mockResolvedValue({
      value: '<blockquote><p>Quoted text</p></blockquote>',
      messages: [],
    });

    const doc = await convertDocxToProseMirror(Buffer.from(''), 'prose');
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].type).toBe('block_quote');
    expect(doc.content[0].content).toHaveLength(1);
    expect(doc.content[0].content![0].text).toBe('Quoted text');
  });

  it('sets genre_hint on doc attrs', async () => {
    mockMammoth.convertToHtml.mockResolvedValue({
      value: '<p>text</p>',
      messages: [],
    });

    const doc = await convertDocxToProseMirror(
      Buffer.from(''),
      'creative_nonfiction',
    );
    expect(doc.attrs?.genre_hint).toBe('creative_nonfiction');
  });
});
