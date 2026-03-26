import { describe, it, expect } from 'vitest';
import {
  smartifyText,
  applySmartTypography,
} from '../../converters/smart-typography.js';
import type { ProseMirrorDoc } from '@colophony/types';

describe('smartifyText', () => {
  it('converts straight double quotes to curly', () => {
    const { text, changed } = smartifyText('She said "hello"');
    expect(text).toBe('She said \u201chello\u201d');
    expect(changed).toBe(true);
  });

  it('converts single quotes in contractions to apostrophe', () => {
    const { text, changed } = smartifyText("it's fine");
    expect(text).toBe('it\u2019s fine');
    expect(changed).toBe(true);
  });

  it('converts opening single quote after whitespace', () => {
    const { text } = smartifyText("She said 'hello'");
    expect(text).toBe('She said \u2018hello\u2019');
  });

  it('converts double hyphen to em dash', () => {
    const { text, changed } = smartifyText('word -- word');
    expect(text).toBe('word \u2014 word');
    expect(changed).toBe(true);
  });

  it('converts triple hyphen to em dash', () => {
    const { text } = smartifyText('word --- word');
    expect(text).toBe('word \u2014 word');
  });

  it('converts three dots to ellipsis', () => {
    const { text, changed } = smartifyText('wait...');
    expect(text).toBe('wait\u2026');
    expect(changed).toBe(true);
  });

  it('preserves abbreviation dots (Mr.)', () => {
    const { text, changed } = smartifyText('Mr. Smith');
    expect(text).toBe('Mr. Smith');
    expect(changed).toBe(false);
  });

  it('preserves abbreviation dots (etc.)', () => {
    const { text, changed } = smartifyText('etc.');
    expect(text).toBe('etc.');
    expect(changed).toBe(false);
  });

  it('handles nested quotes', () => {
    const { text } = smartifyText('She said "it\'s fine"');
    expect(text).toBe('She said \u201cit\u2019s fine\u201d');
  });

  it('returns unchanged for text with no convertible chars', () => {
    const { text, changed } = smartifyText('Hello world');
    expect(text).toBe('Hello world');
    expect(changed).toBe(false);
  });

  it('handles opening quote at start of text', () => {
    const { text } = smartifyText('"Hello," she said');
    expect(text).toMatch(/^\u201cHello,\u201d she said$/);
  });
});

describe('applySmartTypography', () => {
  it('adds smart_text mark with original text', () => {
    const doc: ProseMirrorDoc = {
      type: 'doc',
      content: [{ type: 'paragraph', text: 'She said "hello"' }],
    };
    const result = applySmartTypography(doc);
    expect(result.content[0].marks).toHaveLength(1);
    expect(result.content[0].marks![0].type).toBe('smart_text');
    expect(result.content[0].marks![0].attrs?.original).toBe(
      'She said "hello"',
    );
    expect(result.content[0].text).toBe('She said \u201chello\u201d');
  });

  it('skips nodes with no changes', () => {
    const doc: ProseMirrorDoc = {
      type: 'doc',
      content: [{ type: 'paragraph', text: 'Hello world' }],
    };
    const result = applySmartTypography(doc);
    expect(result.content[0].marks).toBeUndefined();
    expect(result.content[0].text).toBe('Hello world');
  });

  it('sets smart_typography_applied on doc', () => {
    const doc: ProseMirrorDoc = {
      type: 'doc',
      content: [{ type: 'paragraph', text: 'text' }],
    };
    const result = applySmartTypography(doc);
    expect(result.attrs?.smart_typography_applied).toBe(true);
  });

  it('preserves existing marks on nodes', () => {
    const doc: ProseMirrorDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          text: 'She said "hi"',
          marks: [{ type: 'emphasis' }],
        },
      ],
    };
    const result = applySmartTypography(doc);
    expect(result.content[0].marks).toHaveLength(2);
    expect(result.content[0].marks![0].type).toBe('emphasis');
    expect(result.content[0].marks![1].type).toBe('smart_text');
  });

  it('does not mutate the input document', () => {
    const doc: ProseMirrorDoc = {
      type: 'doc',
      content: [{ type: 'paragraph', text: 'She said "hello"' }],
    };
    const originalText = doc.content[0].text;
    applySmartTypography(doc);
    expect(doc.content[0].text).toBe(originalText);
    expect(doc.attrs?.smart_typography_applied).toBeUndefined();
  });

  it('processes nested content recursively', () => {
    const doc: ProseMirrorDoc = {
      type: 'doc',
      content: [
        {
          type: 'block_quote',
          content: [{ type: 'paragraph', text: '"quoted"' }],
        },
      ],
    };
    const result = applySmartTypography(doc);
    const inner = result.content[0].content![0];
    expect(inner.text).toBe('\u201cquoted\u201d');
    expect(inner.marks).toHaveLength(1);
  });

  it('leaves section_break nodes unchanged', () => {
    const doc: ProseMirrorDoc = {
      type: 'doc',
      content: [
        { type: 'paragraph', text: 'before' },
        { type: 'section_break' },
        { type: 'paragraph', text: 'after' },
      ],
    };
    const result = applySmartTypography(doc);
    expect(result.content[1]).toEqual({ type: 'section_break' });
  });
});
