import type { JSONContent } from "@tiptap/core";
import type { MergeFieldDefinition } from "@colophony/types";

/**
 * Serialize a Tiptap JSON document into plain text with {{key}} merge field placeholders.
 */
export function serializeTiptapToText(doc: JSONContent): string {
  if (!doc.content) return "";

  return doc.content
    .map((node) => {
      if (node.type === "paragraph" || node.type === "heading") {
        return serializeInlineContent(node.content ?? []);
      }
      if (node.type === "bulletList" || node.type === "orderedList") {
        return (node.content ?? [])
          .map((li) =>
            (li.content ?? [])
              .map((p) => serializeInlineContent(p.content ?? []))
              .join("\n"),
          )
          .join("\n");
      }
      return serializeInlineContent(node.content ?? []);
    })
    .join("\n");
}

function serializeInlineContent(content: JSONContent[]): string {
  return content
    .map((node) => {
      if (node.type === "mergeField") {
        return `{{${node.attrs?.key ?? ""}}}`;
      }
      if (node.type === "text") {
        return node.text ?? "";
      }
      return "";
    })
    .join("");
}

/**
 * Deserialize plain text with {{key}} placeholders into Tiptap JSON,
 * using field definitions to resolve labels.
 */
export function deserializeTextToTiptap(
  text: string,
  fields: MergeFieldDefinition[],
): JSONContent {
  const fieldMap = new Map(fields.map((f) => [f.key, f]));
  const lines = text.split("\n");

  const content: JSONContent[] = lines.map((line) => ({
    type: "paragraph",
    content: deserializeLine(line, fieldMap),
  }));

  return { type: "doc", content };
}

function deserializeLine(
  line: string,
  fieldMap: Map<string, MergeFieldDefinition>,
): JSONContent[] {
  const result: JSONContent[] = [];
  const regex = /\{\{(\w+)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: "text", text: line.slice(lastIndex, match.index) });
    }
    const key = match[1];
    const field = fieldMap.get(key);
    result.push({
      type: "mergeField",
      attrs: { key, label: field?.label ?? key },
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < line.length) {
    result.push({ type: "text", text: line.slice(lastIndex) });
  }

  return result;
}

/**
 * Replace {{key}} placeholders in text with actual data values.
 * Unmatched keys are left as-is.
 */
export function renderMergeFields(
  body: string,
  data: Record<string, string>,
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return key in data ? data[key] : match;
  });
}
