"use client";

import { literata } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import type {
  ProseMirrorDoc,
  ProseMirrorNode,
  ProseMirrorMark,
} from "@/lib/manuscript";

interface ManuscriptRendererProps {
  content: ProseMirrorDoc;
  showAsSubmitted?: boolean;
  className?: string;
}

/**
 * Genre-aware manuscript renderer with literary typography.
 *
 * Always renders at reading-quality regardless of density context.
 * Uses Literata variable font with optical sizing.
 */
export function ManuscriptRenderer({
  content,
  showAsSubmitted = false,
  className,
}: ManuscriptRendererProps) {
  const genre = content.attrs?.genre_hint ?? "prose";

  return (
    <div className={cn(literata.className, "text-foreground", className)}>
      {genre === "poetry" ? (
        <PoetryRenderer
          nodes={content.content}
          showAsSubmitted={showAsSubmitted}
        />
      ) : (
        <ProseRenderer
          nodes={content.content}
          showAsSubmitted={showAsSubmitted}
        />
      )}
    </div>
  );
}

// --- Internal renderers ---

function ProseRenderer({
  nodes,
  showAsSubmitted,
}: {
  nodes: ProseMirrorNode[];
  showAsSubmitted: boolean;
}) {
  return (
    <div className="manuscript-prose">
      {nodes.map((node, i) => (
        <ProseNode key={i} node={node} showAsSubmitted={showAsSubmitted} />
      ))}
    </div>
  );
}

function ProseNode({
  node,
  showAsSubmitted,
}: {
  node: ProseMirrorNode;
  showAsSubmitted: boolean;
}) {
  switch (node.type) {
    case "paragraph":
      return <p>{renderTextWithMarks(node, showAsSubmitted)}</p>;
    case "section_break":
      return <div className="my-8" aria-hidden="true" />;
    case "block_quote":
      return (
        <blockquote className="border-l-2 border-muted-foreground/30 pl-4 italic">
          {node.content?.map((child, i) => (
            <ProseNode key={i} node={child} showAsSubmitted={showAsSubmitted} />
          ))}
        </blockquote>
      );
    default:
      // Render unknown nodes as plain text fallback
      return node.text ? <p>{node.text}</p> : null;
  }
}

function PoetryRenderer({
  nodes,
  showAsSubmitted,
}: {
  nodes: ProseMirrorNode[];
  showAsSubmitted: boolean;
}) {
  return (
    <div className="manuscript-poetry">
      {nodes.map((node, i) => (
        <PoetryNode key={i} node={node} showAsSubmitted={showAsSubmitted} />
      ))}
    </div>
  );
}

function PoetryNode({
  node,
  showAsSubmitted,
}: {
  node: ProseMirrorNode;
  showAsSubmitted: boolean;
}) {
  switch (node.type) {
    case "poem_line":
      return (
        <div className="whitespace-pre">
          {renderTextWithMarks(node, showAsSubmitted)}
        </div>
      );
    case "stanza_break":
      return <div className="my-6" aria-hidden="true" />;
    case "preserved_indent": {
      const depth = (node.attrs?.depth as number) ?? 1;
      return (
        <div
          className="whitespace-pre"
          style={{ paddingLeft: `${depth * 2}em` }}
        >
          {renderTextWithMarks(node, showAsSubmitted)}
        </div>
      );
    }
    case "caesura": {
      const width = (node.attrs?.width as number) ?? 2;
      return <span style={{ display: "inline-block", width: `${width}em` }} />;
    }
    default:
      return node.text ? (
        <div className="whitespace-pre">{node.text}</div>
      ) : null;
  }
}

// --- Text rendering with smart typography marks ---

function renderTextWithMarks(
  node: ProseMirrorNode,
  showAsSubmitted: boolean,
): React.ReactNode {
  const text = node.text ?? "";
  if (!node.marks || node.marks.length === 0) {
    return text;
  }

  return wrapWithMarks(text, node.marks, showAsSubmitted);
}

function wrapWithMarks(
  text: string,
  marks: ProseMirrorMark[],
  showAsSubmitted: boolean,
): React.ReactNode {
  let content: React.ReactNode = text;

  for (const mark of marks) {
    switch (mark.type) {
      case "smart_text":
        // Show original text when "show as submitted" is toggled
        if (showAsSubmitted && mark.attrs?.original) {
          content = mark.attrs.original;
        }
        break;
      case "emphasis":
        content = <em>{content}</em>;
        break;
      case "strong":
        content = <strong>{content}</strong>;
        break;
      case "small_caps":
        content = <span className="font-variant-small-caps">{content}</span>;
        break;
    }
  }

  return content;
}
