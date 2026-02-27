"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Loader2,
} from "lucide-react";

interface ComposeMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  submissionTitle: string;
}

export function ComposeMessageDialog({
  open,
  onOpenChange,
  submissionId,
  submissionTitle,
}: ComposeMessageDialogProps) {
  const [subject, setSubject] = useState(`Re: ${submissionTitle}`);
  const utils = trpc.useUtils();

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Write your message..." }),
      Link.configure({ openOnClick: false }),
    ],
    content: "",
  });

  const sendMutation = trpc.correspondence.send.useMutation({
    onSuccess: () => {
      toast.success("Message sent");
      editor?.commands.clearContent();
      setSubject(`Re: ${submissionTitle}`);
      onOpenChange(false);
      utils.correspondence.listBySubmission.invalidate({ submissionId });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = () => {
    if (!editor) return;
    const body = editor.getHTML();
    if (!subject.trim() || !body.trim() || body === "<p></p>") return;

    sendMutation.mutate({
      submissionId,
      subject: subject.trim(),
      body,
    });
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Send Message</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={500}
            />
          </div>

          <div className="space-y-2">
            <Label>Message</Label>
            <div className="border rounded-md">
              <div className="flex items-center gap-1 border-b p-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  data-active={editor?.isActive("bold")}
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
                >
                  <Italic className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    editor?.chain().focus().toggleBulletList().run()
                  }
                  data-active={editor?.isActive("bulletList")}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    editor?.chain().focus().toggleOrderedList().run()
                  }
                  data-active={editor?.isActive("orderedList")}
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
                >
                  <LinkIcon className="h-4 w-4" />
                </Button>
              </div>
              <EditorContent
                editor={editor}
                className="prose prose-sm max-w-none p-3 min-h-[150px] focus-within:outline-none [&_.tiptap]:outline-none"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={sendMutation.isPending}>
            {sendMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
