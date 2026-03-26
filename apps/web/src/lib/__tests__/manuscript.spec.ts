import { describe, it, expect } from "vitest";
import { textToProseMirrorDoc } from "../manuscript";

describe("textToProseMirrorDoc", () => {
  describe("prose mode (default)", () => {
    it("converts double newlines to paragraph nodes", () => {
      const doc = textToProseMirrorDoc("First paragraph.\n\nSecond paragraph.");
      expect(doc.type).toBe("doc");
      expect(doc.attrs?.genre_hint).toBe("prose");
      expect(doc.content).toHaveLength(2);
      expect(doc.content[0]).toEqual({
        type: "paragraph",
        attrs: { indent: false },
        text: "First paragraph.",
      });
      expect(doc.content[1]).toEqual({
        type: "paragraph",
        attrs: { indent: true },
        text: "Second paragraph.",
      });
    });

    it("sets indent false on first paragraph, true on subsequent", () => {
      const doc = textToProseMirrorDoc("One.\n\nTwo.\n\nThree.");
      expect(doc.content[0].attrs?.indent).toBe(false);
      expect(doc.content[1].attrs?.indent).toBe(true);
      expect(doc.content[2].attrs?.indent).toBe(true);
    });

    it("inserts section_break for triple+ newlines", () => {
      const doc = textToProseMirrorDoc("Part one.\n\n\nPart two.");
      expect(doc.content).toHaveLength(3);
      expect(doc.content[0].type).toBe("paragraph");
      expect(doc.content[1].type).toBe("section_break");
      expect(doc.content[2].type).toBe("paragraph");
    });

    it("handles quadruple newlines as section break", () => {
      const doc = textToProseMirrorDoc("A.\n\n\n\nB.");
      const types = doc.content.map((n) => n.type);
      expect(types).toEqual(["paragraph", "section_break", "paragraph"]);
    });

    it("returns empty content array for empty string", () => {
      const doc = textToProseMirrorDoc("");
      expect(doc.content).toEqual([]);
    });

    it("returns empty content array for whitespace-only string", () => {
      const doc = textToProseMirrorDoc("   \n\n   ");
      expect(doc.content).toEqual([]);
    });

    it("handles single paragraph (no double newlines)", () => {
      const doc = textToProseMirrorDoc("Just one paragraph.");
      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].attrs?.indent).toBe(false);
    });

    it("trims whitespace from paragraph text", () => {
      const doc = textToProseMirrorDoc("  Hello world.  \n\n  Goodbye.  ");
      expect(doc.content[0].text).toBe("Hello world.");
      expect(doc.content[1].text).toBe("Goodbye.");
    });
  });

  describe("poetry mode", () => {
    it("converts single newlines to poem_line nodes", () => {
      const doc = textToProseMirrorDoc(
        "First line\nSecond line\nThird line",
        "poetry",
      );
      expect(doc.attrs?.genre_hint).toBe("poetry");
      expect(doc.content).toHaveLength(3);
      expect(doc.content.every((n) => n.type === "poem_line")).toBe(true);
    });

    it("inserts stanza_break on double newlines", () => {
      const doc = textToProseMirrorDoc(
        "Line one\nLine two\n\nLine three\nLine four",
        "poetry",
      );
      const types = doc.content.map((n) => n.type);
      expect(types).toEqual([
        "poem_line",
        "poem_line",
        "stanza_break",
        "poem_line",
        "poem_line",
      ]);
    });

    it("converts leading whitespace to preserved_indent with depth", () => {
      const doc = textToProseMirrorDoc(
        "Normal line\n    Indented line",
        "poetry",
      );
      expect(doc.content[0]).toEqual({
        type: "poem_line",
        text: "Normal line",
      });
      expect(doc.content[1]).toEqual({
        type: "preserved_indent",
        attrs: { depth: 2 },
        text: "Indented line",
      });
    });

    it("returns empty content for empty string", () => {
      const doc = textToProseMirrorDoc("", "poetry");
      expect(doc.content).toEqual([]);
    });
  });

  describe("genre hint passthrough", () => {
    it("defaults to prose when no hint provided", () => {
      const doc = textToProseMirrorDoc("Hello.");
      expect(doc.attrs?.genre_hint).toBe("prose");
    });

    it("passes through creative_nonfiction as prose rendering", () => {
      const doc = textToProseMirrorDoc(
        "First.\n\nSecond.",
        "creative_nonfiction",
      );
      expect(doc.attrs?.genre_hint).toBe("creative_nonfiction");
      // creative_nonfiction uses prose converter
      expect(doc.content[0].type).toBe("paragraph");
    });

    it("passes through hybrid as prose rendering", () => {
      const doc = textToProseMirrorDoc("First.\n\nSecond.", "hybrid");
      expect(doc.attrs?.genre_hint).toBe("hybrid");
      expect(doc.content[0].type).toBe("paragraph");
    });
  });
});
