"use client";

import { useEffect, useRef } from "react";
import { literata } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { useReadingTheme } from "@/hooks/use-reading-theme";
import type {
  ProseMirrorDoc,
  ProseMirrorNode,
  ProseMirrorMark,
} from "@/lib/manuscript";

interface ReadingAnchorPosition {
  nodeIndex: number;
}

interface ManuscriptRendererProps {
  content: ProseMirrorDoc;
  showAsSubmitted?: boolean;
  className?: string;
  /** Called when the topmost visible node changes (debounced). Collection context only. */
  onAnchorChange?: (anchor: ReadingAnchorPosition) => void;
  /** Restore scroll to this node on mount. Collection context only. */
  initialAnchor?: ReadingAnchorPosition | null;
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
  onAnchorChange,
  initialAnchor,
}: ManuscriptRendererProps) {
  const genre = content.attrs?.genre_hint ?? "prose";
  const { readingTheme } = useReadingTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const anchorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReportedIndex = useRef<number>(-1);

  // Restore scroll position when initialAnchor changes (including on item switch)
  useEffect(() => {
    if (!initialAnchor) return;
    // Defer to next frame so DOM nodes are rendered
    requestAnimationFrame(() => {
      const el = containerRef.current?.querySelector(
        `[data-node-index="${initialAnchor.nodeIndex}"]`,
      );
      el?.scrollIntoView({ block: "start" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally depend on nodeIndex only, not the full object reference
  }, [initialAnchor?.nodeIndex]);

  // Track topmost visible node via IntersectionObserver
  useEffect(() => {
    if (!onAnchorChange || !containerRef.current) return;

    const nodes = containerRef.current.querySelectorAll("[data-node-index]");
    if (nodes.length === 0) return;

    const visibleIndices = new Set<number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const idx = Number((entry.target as HTMLElement).dataset.nodeIndex);
          if (entry.isIntersecting) {
            visibleIndices.add(idx);
          } else {
            visibleIndices.delete(idx);
          }
        }

        // Find the smallest visible node index (topmost)
        if (visibleIndices.size === 0) return;
        const topIndex = Math.min(...visibleIndices);
        if (topIndex === lastReportedIndex.current) return;

        // Debounce: wait 2s after last change before reporting
        if (anchorTimerRef.current) clearTimeout(anchorTimerRef.current);
        anchorTimerRef.current = setTimeout(() => {
          lastReportedIndex.current = topIndex;
          onAnchorChange({ nodeIndex: topIndex });
        }, 2000);
      },
      {
        root: null,
        threshold: 0,
      },
    );

    nodes.forEach((node) => observer.observe(node));

    return () => {
      observer.disconnect();
      if (anchorTimerRef.current) clearTimeout(anchorTimerRef.current);
    };
  }, [onAnchorChange, content]);

  return (
    <div
      ref={containerRef}
      data-reading-theme={readingTheme}
      className={cn(literata.className, "rounded-lg p-4", className)}
      style={{
        backgroundColor: "var(--reading-bg)",
        color: "var(--reading-fg)",
      }}
    >
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
        <div key={i} data-node-index={i}>
          <ProseNode node={node} showAsSubmitted={showAsSubmitted} />
        </div>
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
        <div key={i} data-node-index={i}>
          <PoetryNode node={node} showAsSubmitted={showAsSubmitted} />
        </div>
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
