import { describe, it, expect } from "vitest";
import {
  proseMirrorToTiptap,
  tiptapToProseMirror,
  extractPlainText,
} from "../tiptap-manuscript-extensions";
import type { ProseMirrorDoc } from "@colophony/types";

const proseDoc: ProseMirrorDoc = {
  type: "doc",
  attrs: {
    genre_hint: "prose",
    smart_typography_applied: true,
    submission_metadata: {
      original_filename: "test.txt",
      original_format: "text/plain",
      converted_at: "2026-01-01T00:00:00Z",
      converter_version: "1.0.0",
    },
  },
  content: [
    {
      type: "paragraph",
      attrs: { indent: false },
      text: "First paragraph.",
    },
    {
      type: "paragraph",
      attrs: { indent: true },
      text: "Second paragraph with emphasis.",
      marks: [{ type: "emphasis" }],
    },
    { type: "section_break" },
    {
      type: "block_quote",
      content: [
        {
          type: "paragraph",
          attrs: { indent: false },
          text: "A quoted passage.",
          marks: [{ type: "strong" }],
        },
      ],
    },
    {
      type: "paragraph",
      attrs: { indent: false },
      text: "\u201CHello,\u201D she said.",
      marks: [
        {
          type: "smart_text",
          attrs: { original: '"Hello," she said.' },
        },
      ],
    },
  ],
};

const poetryDoc: ProseMirrorDoc = {
  type: "doc",
  attrs: { genre_hint: "poetry" },
  content: [
    { type: "poem_line", text: "The wind carries" },
    {
      type: "preserved_indent",
      attrs: { depth: 2 },
      text: "what we cannot hold",
    },
    { type: "stanza_break" },
    { type: "poem_line", text: "The river knows" },
    { type: "caesura", attrs: { width: 3 } },
    {
      type: "poem_line",
      text: "our names",
      marks: [{ type: "emphasis" }],
    },
  ],
};

describe("proseMirrorToTiptap", () => {
  it("converts prose paragraphs to TipTap format", () => {
    const result = proseMirrorToTiptap(proseDoc);
    expect(result.type).toBe("doc");
    expect(result.content).toHaveLength(5);

    const para = result.content![0];
    expect(para.type).toBe("paragraph");
    expect(para.attrs).toEqual({ indent: false });
    expect(para.content).toEqual([{ type: "text", text: "First paragraph." }]);
  });

  it("preserves marks on text children", () => {
    const result = proseMirrorToTiptap(proseDoc);
    const emphPara = result.content![1];
    expect(emphPara.content![0].marks).toEqual([{ type: "emphasis" }]);
  });

  it("converts atom nodes without content", () => {
    const result = proseMirrorToTiptap(proseDoc);
    const sectionBreak = result.content![2];
    expect(sectionBreak.type).toBe("section_break");
    expect(sectionBreak.content).toBeUndefined();
  });

  it("converts block_quote to blockquote and recurses", () => {
    const result = proseMirrorToTiptap(proseDoc);
    const bq = result.content![3];
    expect(bq.type).toBe("blockquote");
    expect(bq.content).toHaveLength(1);
    expect(bq.content![0].type).toBe("paragraph");
    expect(bq.content![0].content![0].text).toBe("A quoted passage.");
  });

  it("preserves smart_text mark attrs", () => {
    const result = proseMirrorToTiptap(proseDoc);
    const smartPara = result.content![4];
    const marks = smartPara.content![0].marks;
    expect(marks).toHaveLength(1);
    expect(marks![0].type).toBe("smart_text");
    expect(marks![0].attrs).toEqual({ original: '"Hello," she said.' });
  });

  it("converts poetry nodes", () => {
    const result = proseMirrorToTiptap(poetryDoc);
    expect(result.content![0].type).toBe("poem_line");
    expect(result.content![0].content![0].text).toBe("The wind carries");

    expect(result.content![1].type).toBe("preserved_indent");
    expect(result.content![1].attrs).toEqual({ depth: 2 });

    expect(result.content![2].type).toBe("stanza_break");
    expect(result.content![2].content).toBeUndefined();

    expect(result.content![4].type).toBe("caesura");
    expect(result.content![4].attrs).toEqual({ width: 3 });
  });
});

describe("tiptapToProseMirror", () => {
  it("converts TipTap format back to Colophony format", () => {
    const tiptap = proseMirrorToTiptap(proseDoc);
    const result = tiptapToProseMirror(tiptap, proseDoc);

    expect(result.type).toBe("doc");
    expect(result.attrs?.genre_hint).toBe("prose");
    expect(result.attrs?.smart_typography_applied).toBe(true);
    expect(result.content).toHaveLength(5);
  });

  it("preserves original doc attrs", () => {
    const tiptap = proseMirrorToTiptap(proseDoc);
    const result = tiptapToProseMirror(tiptap, proseDoc);
    expect(result.attrs?.submission_metadata?.original_filename).toBe(
      "test.txt",
    );
  });

  it("round-trips paragraph text", () => {
    const tiptap = proseMirrorToTiptap(proseDoc);
    const result = tiptapToProseMirror(tiptap, proseDoc);
    expect(result.content[0].text).toBe("First paragraph.");
    expect(result.content[0].attrs?.indent).toBe(false);
  });

  it("round-trips marks", () => {
    const tiptap = proseMirrorToTiptap(proseDoc);
    const result = tiptapToProseMirror(tiptap, proseDoc);
    expect(result.content[1].marks).toEqual([{ type: "emphasis" }]);
  });

  it("round-trips atom nodes", () => {
    const tiptap = proseMirrorToTiptap(proseDoc);
    const result = tiptapToProseMirror(tiptap, proseDoc);
    expect(result.content[2]).toEqual({ type: "section_break" });
  });

  it("round-trips block_quote ↔ blockquote", () => {
    const tiptap = proseMirrorToTiptap(proseDoc);
    const result = tiptapToProseMirror(tiptap, proseDoc);
    const bq = result.content[3];
    expect(bq.type).toBe("block_quote");
    expect(bq.content).toHaveLength(1);
    expect(bq.content![0].text).toBe("A quoted passage.");
  });

  it("round-trips smart_text mark attrs", () => {
    const tiptap = proseMirrorToTiptap(proseDoc);
    const result = tiptapToProseMirror(tiptap, proseDoc);
    const smartNode = result.content[4];
    expect(smartNode.marks![0].type).toBe("smart_text");
    expect(smartNode.marks![0].attrs?.original).toBe('"Hello," she said.');
  });

  it("round-trips poetry nodes", () => {
    const tiptap = proseMirrorToTiptap(poetryDoc);
    const result = tiptapToProseMirror(tiptap, poetryDoc);

    expect(result.content[0].type).toBe("poem_line");
    expect(result.content[0].text).toBe("The wind carries");

    expect(result.content[1].type).toBe("preserved_indent");
    expect(result.content[1].attrs?.depth).toBe(2);

    expect(result.content[2].type).toBe("stanza_break");

    expect(result.content[4].type).toBe("caesura");
    expect(result.content[4].attrs?.width).toBe(3);

    expect(result.content[5].marks).toEqual([{ type: "emphasis" }]);
  });

  it("defaults to prose genre_hint when no original doc", () => {
    const tiptap = proseMirrorToTiptap(proseDoc);
    const result = tiptapToProseMirror(tiptap);
    expect(result.attrs?.genre_hint).toBe("prose");
  });
});

describe("extractPlainText", () => {
  it("extracts text from prose doc", () => {
    const text = extractPlainText(proseDoc);
    expect(text).toContain("First paragraph.");
    expect(text).toContain("Second paragraph");
    expect(text).toContain("A quoted passage.");
  });

  it("extracts text from poetry doc", () => {
    const text = extractPlainText(poetryDoc);
    expect(text).toContain("The wind carries");
    expect(text).toContain("what we cannot hold");
    expect(text).toContain("our names");
  });
});
