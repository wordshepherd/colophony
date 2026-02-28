"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import type { EmailTemplateName } from "@colophony/types";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/hooks/use-organization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Eye,
  Loader2,
  RotateCcw,
} from "lucide-react";

interface EmailTemplateEditorProps {
  templateName: string;
  mergeFields: string[];
  onClose: () => void;
}

export function EmailTemplateEditor({
  templateName,
  mergeFields,
  onClose,
}: EmailTemplateEditorProps) {
  const { isAdmin } = useOrganization();
  const utils = trpc.useUtils();
  const [subject, setSubject] = useState("");
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Write your email template..." }),
      Link.configure({ openOnClick: false }),
    ],
    content: "",
    editable: isAdmin,
  });

  // Load existing template if customized
  const { data: existing } = trpc.emailTemplates.getByName.useQuery({
    templateName: templateName as EmailTemplateName,
  });

  // Sync subject from server data once loaded
  const [hasSynced, setHasSynced] = useState(false);
  if (existing && !hasSynced) {
    setHasSynced(true);
    setSubject(existing.subjectTemplate);
  }

  // Sync editor content when existing data loads (editor is async)
  useEffect(() => {
    if (existing && editor) {
      editor.commands.setContent(existing.bodyHtml);
    }
  }, [existing, editor]);

  const upsertMutation = trpc.emailTemplates.upsert.useMutation({
    onSuccess: () => {
      toast.success("Template saved");
      utils.emailTemplates.list.invalidate();
      utils.emailTemplates.getByName.invalidate({
        templateName: templateName as EmailTemplateName,
      });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = trpc.emailTemplates.delete.useMutation({
    onSuccess: () => {
      toast.success("Template reset to default");
      utils.emailTemplates.list.invalidate();
      utils.emailTemplates.getByName.invalidate({
        templateName: templateName as EmailTemplateName,
      });
      setShowResetDialog(false);
      onClose();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const previewMutation = trpc.emailTemplates.preview.useMutation({
    onSuccess: (data) => {
      setPreviewHtml(data.html);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleSave = () => {
    if (!editor) return;
    const bodyHtml = editor.getHTML();
    if (!subject.trim() || !bodyHtml.trim() || bodyHtml === "<p></p>") {
      toast.error("Subject and body are required");
      return;
    }

    upsertMutation.mutate({
      templateName: templateName as EmailTemplateName,
      subjectTemplate: subject.trim(),
      bodyHtml,
    });
  };

  const handlePreview = () => {
    if (!editor) return;
    const bodyHtml = editor.getHTML();
    previewMutation.mutate({
      templateName: templateName as EmailTemplateName,
      subjectTemplate: subject || "Preview",
      bodyHtml: bodyHtml || "<p></p>",
    });
  };

  const insertMergeField = (field: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(`{{${field}}}`).run();
  };

  const toggleLink = () => {
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt("Enter URL:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-medium">Edit Email Template</h3>
      </div>

      {/* Subject */}
      <div className="space-y-2">
        <Label htmlFor="template-subject">Subject</Label>
        <div className="flex gap-2">
          <Input
            id="template-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject line..."
            maxLength={512}
            disabled={!isAdmin}
          />
          <Select
            onValueChange={(field) => setSubject((s) => `${s}{{${field}}}`)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Insert field" />
            </SelectTrigger>
            <SelectContent>
              {mergeFields.map((field) => (
                <SelectItem key={field} value={field}>
                  {`{{${field}}}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Body editor */}
      <div className="space-y-2">
        <Label>Body</Label>
        <div className="border rounded-md">
          <div className="flex items-center gap-1 border-b p-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => editor?.chain().focus().toggleBold().run()}
              data-active={editor?.isActive("bold")}
              disabled={!isAdmin}
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              data-active={editor?.isActive("italic")}
              disabled={!isAdmin}
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              data-active={editor?.isActive("bulletList")}
              disabled={!isAdmin}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              data-active={editor?.isActive("orderedList")}
              disabled={!isAdmin}
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleLink}
              data-active={editor?.isActive("link")}
              disabled={!isAdmin}
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
            <div className="ml-auto">
              <Select onValueChange={insertMergeField} disabled={!isAdmin}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue placeholder="Insert field" />
                </SelectTrigger>
                <SelectContent>
                  {mergeFields.map((field) => (
                    <SelectItem key={field} value={field}>
                      {`{{${field}}}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <EditorContent
            editor={editor}
            className="prose prose-sm max-w-none p-3 min-h-[200px] focus-within:outline-none [&_.tiptap]:outline-none"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {isAdmin && (
          <>
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save
            </Button>
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={previewMutation.isPending}
            >
              {previewMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              Preview
            </Button>
            {existing && (
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={() => setShowResetDialog(true)}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset to Default
              </Button>
            )}
          </>
        )}
      </div>

      {/* Preview pane */}
      {previewHtml && (
        <div className="border rounded-md">
          <div className="flex items-center justify-between border-b p-2">
            <span className="text-sm font-medium">Preview</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreviewHtml(null)}
            >
              Close
            </Button>
          </div>
          <iframe
            sandbox=""
            srcDoc={previewHtml}
            className="w-full min-h-[400px] border-0"
            title="Email preview"
          />
        </div>
      )}

      {/* Reset confirmation dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset to default?</DialogTitle>
            <DialogDescription>
              This will delete your custom template and revert to the built-in
              default. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteMutation.mutate({
                  templateName: templateName as EmailTemplateName,
                })
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
