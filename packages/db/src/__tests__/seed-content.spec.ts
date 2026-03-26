import { describe, it, expect } from "vitest";
import {
  proseFictionDoc,
  poetryDoc,
  creativeNonfictionDoc,
} from "../seed-content";
import { proseMirrorDocSchema } from "@colophony/types";
import type { ProseMirrorDoc, ProseMirrorNode } from "@colophony/types";

/** Collect all node types in a doc's content (non-recursive, top-level only). */
function topNodeTypes(doc: ProseMirrorDoc): string[] {
  return doc.content.map((n) => n.type);
}

/** Recursively collect all marks from a doc. */
function collectMarks(doc: ProseMirrorDoc): string[] {
  const marks: string[] = [];
  function walk(nodes: ProseMirrorNode[]) {
    for (const node of nodes) {
      if (node.marks) {
        for (const mark of node.marks) marks.push(mark.type);
      }
      if (node.content) walk(node.content);
    }
  }
  walk(doc.content);
  return marks;
}

describe("proseFictionDoc", () => {
  const doc = proseFictionDoc();

  it("returns a valid ProseMirror doc envelope", () => {
    expect(proseMirrorDocSchema.parse(doc)).toBeDefined();
    expect(doc.type).toBe("doc");
    expect(doc.content.length).toBeGreaterThan(0);
  });

  it("has prose genre hint", () => {
    expect(doc.attrs?.genre_hint).toBe("prose");
  });

  it("has smart_typography_applied", () => {
    expect(doc.attrs?.smart_typography_applied).toBe(true);
  });

  it("has submission_metadata", () => {
    const meta = doc.attrs?.submission_metadata;
    expect(meta).toBeDefined();
    expect(meta?.original_filename).toContain("weight");
    expect(meta?.converter_version).toBe("1.0.0");
  });

  it("contains paragraph, section_break, and block_quote nodes", () => {
    const types = topNodeTypes(doc);
    expect(types).toContain("paragraph");
    expect(types).toContain("section_break");
    expect(types).toContain("block_quote");
  });

  it("has smart_text marks with original attribute", () => {
    const nodesWithSmartText = doc.content.filter((n) =>
      n.marks?.some((m) => m.type === "smart_text"),
    );
    expect(nodesWithSmartText.length).toBeGreaterThanOrEqual(2);
    for (const node of nodesWithSmartText) {
      const smartMark = node.marks!.find((m) => m.type === "smart_text");
      expect(smartMark?.attrs?.original).toBeDefined();
      expect(typeof smartMark?.attrs?.original).toBe("string");
    }
  });

  it("has emphasis marks", () => {
    expect(collectMarks(doc)).toContain("emphasis");
  });

  it("paragraphs after first have indent: true", () => {
    const paragraphs = doc.content.filter((n) => n.type === "paragraph");
    expect(paragraphs[0]?.attrs?.indent).toBe(false);
    // At least one indented paragraph
    expect(paragraphs.some((p) => p.attrs?.indent === true)).toBe(true);
  });
});

describe("poetryDoc", () => {
  const doc = poetryDoc();

  it("returns a valid ProseMirror doc envelope", () => {
    expect(proseMirrorDocSchema.parse(doc)).toBeDefined();
    expect(doc.type).toBe("doc");
    expect(doc.content.length).toBeGreaterThan(0);
  });

  it("has poetry genre hint", () => {
    expect(doc.attrs?.genre_hint).toBe("poetry");
  });

  it("contains poem_line, stanza_break, and preserved_indent nodes", () => {
    const types = topNodeTypes(doc);
    expect(types).toContain("poem_line");
    expect(types).toContain("stanza_break");
    expect(types).toContain("preserved_indent");
  });

  it("has a caesura node", () => {
    const types = topNodeTypes(doc);
    expect(types).toContain("caesura");
  });

  it("preserved_indent has depth attribute", () => {
    const indent = doc.content.find((n) => n.type === "preserved_indent");
    expect(indent?.attrs?.depth).toBeGreaterThanOrEqual(2);
  });

  it("has emphasis marks on at least one line", () => {
    expect(collectMarks(doc)).toContain("emphasis");
  });

  it("has smart_text marks", () => {
    expect(collectMarks(doc)).toContain("smart_text");
  });
});

describe("creativeNonfictionDoc", () => {
  const doc = creativeNonfictionDoc();

  it("returns a valid ProseMirror doc envelope", () => {
    expect(proseMirrorDocSchema.parse(doc)).toBeDefined();
    expect(doc.type).toBe("doc");
    expect(doc.content.length).toBeGreaterThan(0);
  });

  it("has creative_nonfiction genre hint", () => {
    expect(doc.attrs?.genre_hint).toBe("creative_nonfiction");
  });

  it("contains block_quote and section_break nodes", () => {
    const types = topNodeTypes(doc);
    expect(types).toContain("block_quote");
    expect(types).toContain("section_break");
  });

  it("has small_caps marks", () => {
    expect(collectMarks(doc)).toContain("small_caps");
  });

  it("has smart_text marks with original attribute", () => {
    const nodesWithSmartText = doc.content.filter((n) =>
      n.marks?.some((m) => m.type === "smart_text"),
    );
    expect(nodesWithSmartText.length).toBeGreaterThanOrEqual(1);
    for (const node of nodesWithSmartText) {
      const smartMark = node.marks!.find((m) => m.type === "smart_text");
      expect(smartMark?.attrs?.original).toBeDefined();
    }
  });
});

describe("cross-doc consistency", () => {
  it("all docs use valid ProseMirrorNodeType values", () => {
    const validTypes = new Set([
      "paragraph",
      "section_break",
      "block_quote",
      "poem_line",
      "stanza_break",
      "preserved_indent",
      "caesura",
      "preserved_whitespace",
    ]);
    const docs = [proseFictionDoc(), poetryDoc(), creativeNonfictionDoc()];
    for (const doc of docs) {
      function checkNodes(nodes: ProseMirrorNode[]) {
        for (const node of nodes) {
          expect(validTypes).toContain(node.type);
          if (node.content) checkNodes(node.content);
        }
      }
      checkNodes(doc.content);
    }
  });

  it("all docs have distinct genre hints", () => {
    const hints = new Set([
      proseFictionDoc().attrs?.genre_hint,
      poetryDoc().attrs?.genre_hint,
      creativeNonfictionDoc().attrs?.genre_hint,
    ]);
    expect(hints.size).toBe(3);
  });
});
