"use client";

import { useRef, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { literata } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import {
  manuscriptExtensions,
  proseMirrorToTiptap,
  tiptapToProseMirror,
} from "@/lib/tiptap-manuscript-extensions";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Bold, Italic, Type, Minus, CornerDownRight } from "lucide-react";
import type { ProseMirrorDoc, GenreHint } from "@colophony/types";

interface ManuscriptEditorProps {
  content: ProseMirrorDoc;
  genreHint: GenreHint;
  onChange: (doc: ProseMirrorDoc) => void;
  editable?: boolean;
}

export function ManuscriptEditor({
  content,
  genreHint,
  onChange,
  editable = true,
}: ManuscriptEditorProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originalDocRef = useRef(content);

  const handleUpdate = useCallback(
    ({
      editor: e,
    }: {
      editor: ReturnType<typeof useEditor> extends infer T
        ? NonNullable<T>
        : never;
    }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const doc = tiptapToProseMirror(e.getJSON(), originalDocRef.current);
        onChange(doc);
      }, 500);
    },
    [onChange],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      ...manuscriptExtensions,
    ],
    editable,
    content: proseMirrorToTiptap(content),
    onUpdate: handleUpdate,
  });

  if (!editor) return null;

  return (
    <div className="rounded-md border">
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b p-2">
        <Button
          variant={editor.isActive("bold") ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant={editor.isActive("italic") ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant={editor.isActive("small_caps") ? "secondary" : "ghost"}
          size="sm"
          onClick={() => editor.chain().focus().toggleMark("small_caps").run()}
          title="Small Caps"
        >
          <Type className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({ type: "section_break" })
              .run()
          }
          title="Insert Section Break"
        >
          <Minus className="h-4 w-4" />
        </Button>

        {genreHint === "poetry" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertContent({ type: "stanza_break" })
                .run()
            }
            title="Insert Stanza Break"
          >
            <CornerDownRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className={cn(
          literata.className,
          "prose prose-lg max-w-none p-6",
          "[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[300px]",
          "[&_div[data-section-break]]:my-8 [&_div[data-section-break]]:border-t [&_div[data-section-break]]:border-muted-foreground/20",
          "[&_div[data-stanza-break]]:my-6",
          "[&_div[data-poem-line]]:whitespace-pre",
          "[&_div[data-preserved-indent]]:whitespace-pre",
          "[&_.font-variant-small-caps]:font-variant-small-caps",
        )}
      />
    </div>
  );
}
