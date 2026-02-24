"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import type { MergeFieldDefinition } from "@colophony/types";
import { MergeField } from "@/lib/tiptap-merge-field-extension";
import {
  serializeTiptapToText,
  deserializeTextToTiptap,
} from "@/lib/tiptap-serialization";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ChevronDown,
} from "lucide-react";

interface ContractEditorProps {
  content: string;
  mergeFields: MergeFieldDefinition[];
  onChange: (text: string) => void;
  editable?: boolean;
}

export function ContractEditor({
  content,
  mergeFields,
  onChange,
  editable = true,
}: ContractEditorProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Write your contract template..." }),
      MergeField,
    ],
    editable,
    content: deserializeTextToTiptap(content, mergeFields),
    onUpdate: ({ editor: e }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChange(serializeTiptapToText(e.getJSON()));
      }, 300);
    },
  });

  // Sync content from outside when it changes (e.g., form reset in edit mode)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (!editor || editor.isFocused) return;
    const currentText = serializeTiptapToText(editor.getJSON());
    if (currentText !== content) {
      editor.commands.setContent(deserializeTextToTiptap(content, mergeFields));
    }
  }, [content, mergeFields, editor]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (!editor) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="border rounded-md">
      {editable && (
        <div className="flex flex-wrap items-center gap-1 border-b p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive("bold") ? "bg-accent" : ""}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive("italic") ? "bg-accent" : ""}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
            className={
              editor.isActive("heading", { level: 1 }) ? "bg-accent" : ""
            }
          >
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            className={
              editor.isActive("heading", { level: 2 }) ? "bg-accent" : ""
            }
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            className={
              editor.isActive("heading", { level: 3 }) ? "bg-accent" : ""
            }
          >
            <Heading3 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive("bulletList") ? "bg-accent" : ""}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={editor.isActive("orderedList") ? "bg-accent" : ""}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>

          <div className="mx-1 h-6 w-px bg-border" />

          {mergeFields.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  Merge Field
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {mergeFields.map((field) => (
                  <DropdownMenuItem
                    key={field.key}
                    onClick={() =>
                      editor
                        .chain()
                        .focus()
                        .insertMergeField({
                          key: field.key,
                          label: field.label,
                        })
                        .run()
                    }
                  >
                    {field.label}{" "}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {`{{${field.key}}}`}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-4 min-h-[200px] focus-within:outline-none [&_.ProseMirror]:outline-none"
      />
    </div>
  );
}
