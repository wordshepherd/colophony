"use client";

import { useMemo } from "react";
import { diffWords } from "diff";
import { literata } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { extractPlainText } from "@/lib/tiptap-manuscript-extensions";
import type { ProseMirrorDoc } from "@colophony/types";

interface ManuscriptDiffProps {
  original: ProseMirrorDoc;
  edited: ProseMirrorDoc;
  className?: string;
}

export function ManuscriptDiff({
  original,
  edited,
  className,
}: ManuscriptDiffProps) {
  const diff = useMemo(() => {
    const originalText = extractPlainText(original);
    const editedText = extractPlainText(edited);
    return diffWords(originalText, editedText);
  }, [original, edited]);

  const hasChanges = diff.some((part) => part.added || part.removed);

  if (!hasChanges) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        No changes between versions.
      </div>
    );
  }

  return (
    <div
      className={cn(
        literata.className,
        "text-foreground leading-relaxed whitespace-pre-wrap",
        className,
      )}
    >
      {diff.map((part, i) => {
        if (part.added) {
          return (
            <span key={i} className="bg-status-success/10 text-status-success">
              {part.value}
            </span>
          );
        }
        if (part.removed) {
          return (
            <span
              key={i}
              className="bg-status-error/10 text-status-error line-through"
            >
              {part.value}
            </span>
          );
        }
        return <span key={i}>{part.value}</span>;
      })}
    </div>
  );
}
