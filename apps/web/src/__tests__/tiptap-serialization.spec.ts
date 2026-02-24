import {
  serializeTiptapToText,
  deserializeTextToTiptap,
  renderMergeFields,
} from "@/lib/tiptap-serialization";
import type { MergeFieldDefinition } from "@colophony/types";

describe("serializeTiptapToText", () => {
  it("serializes empty doc to empty string", () => {
    expect(serializeTiptapToText({ type: "doc" })).toBe("");
    expect(serializeTiptapToText({ type: "doc", content: [] })).toBe("");
  });

  it("serializes paragraph without merge fields", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world" }],
        },
      ],
    };
    expect(serializeTiptapToText(doc)).toBe("Hello world");
  });

  it("serializes mergeField nodes to {{key}}", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Dear " },
            {
              type: "mergeField",
              attrs: { key: "author_name", label: "Author Name" },
            },
            { type: "text", text: ", thank you." },
          ],
        },
      ],
    };
    expect(serializeTiptapToText(doc)).toBe("Dear {{author_name}}, thank you.");
  });
});

describe("deserializeTextToTiptap", () => {
  const fields: MergeFieldDefinition[] = [
    { key: "author_name", label: "Author Name", source: "auto" },
    { key: "piece_title", label: "Piece Title", source: "auto" },
  ];

  it("deserializes {{key}} text to mergeField nodes", () => {
    const result = deserializeTextToTiptap(
      "Dear {{author_name}}, re: {{piece_title}}",
      fields,
    );
    expect(result.content).toHaveLength(1);
    const para = result.content![0];
    expect(para.content).toHaveLength(4);
    expect(para.content![0]).toEqual({ type: "text", text: "Dear " });
    expect(para.content![1]).toEqual({
      type: "mergeField",
      attrs: { key: "author_name", label: "Author Name" },
    });
    expect(para.content![2]).toEqual({ type: "text", text: ", re: " });
    expect(para.content![3]).toEqual({
      type: "mergeField",
      attrs: { key: "piece_title", label: "Piece Title" },
    });
  });

  it("deserializes plain text without merge fields", () => {
    const result = deserializeTextToTiptap("Just plain text", []);
    expect(result.content).toHaveLength(1);
    expect(result.content![0].content).toEqual([
      { type: "text", text: "Just plain text" },
    ]);
  });

  it("roundtrip preserves content", () => {
    const original =
      "Hello {{author_name}}, your piece {{piece_title}} is accepted.";
    const tiptap = deserializeTextToTiptap(original, fields);
    const serialized = serializeTiptapToText(tiptap);
    expect(serialized).toBe(original);
  });
});

describe("renderMergeFields", () => {
  it("replaces all keys", () => {
    const result = renderMergeFields(
      "Dear {{author_name}}, re: {{piece_title}}",
      { author_name: "Jane Doe", piece_title: "Sunset" },
    );
    expect(result).toBe("Dear Jane Doe, re: Sunset");
  });

  it("leaves unmatched keys", () => {
    const result = renderMergeFields("Dear {{author_name}}, {{unknown}}", {
      author_name: "Jane",
    });
    expect(result).toBe("Dear Jane, {{unknown}}");
  });
});
