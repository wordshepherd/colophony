"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TiptapLink from "@tiptap/extension-link";
import { formatDistanceToNow } from "date-fns";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Loader2,
  Reply,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface DiscussionThreadProps {
  submissionId: string;
}

function TiptapToolbar({
  editor,
}: {
  editor: ReturnType<typeof useEditor> | null;
}) {
  if (!editor) return null;

  const toggleLink = () => {
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
    <div className="flex items-center gap-1 border-b p-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => editor.chain().focus().toggleBold().run()}
        data-active={editor.isActive("bold")}
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        data-active={editor.isActive("italic")}
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        data-active={editor.isActive("bulletList")}
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        data-active={editor.isActive("orderedList")}
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={toggleLink}
        data-active={editor.isActive("link")}
      >
        <LinkIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}

function CommentEditor({
  onSubmit,
  isPending,
  placeholder = "Write a comment...",
  autoFocus = false,
}: {
  onSubmit: (html: string) => void;
  isPending: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      TiptapLink.configure({ openOnClick: false }),
    ],
    content: "",
    autofocus: autoFocus,
  });

  const handleSubmit = () => {
    if (!editor) return;
    const html = editor.getHTML();
    if (!html.trim() || html === "<p></p>") return;
    onSubmit(html);
    editor.commands.clearContent();
  };

  return (
    <div className="border rounded-md">
      <TiptapToolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-3 min-h-[100px] focus-within:outline-none [&_.tiptap]:outline-none"
      />
      <div className="flex justify-end p-2 border-t">
        <Button size="sm" onClick={handleSubmit} disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Comment
        </Button>
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  replies,
  onReply,
}: {
  comment: {
    id: string;
    authorEmail: string | null;
    content: string;
    createdAt: string | Date;
    parentId: string | null;
  };
  replies: Array<{
    id: string;
    authorEmail: string | null;
    content: string;
    createdAt: string | Date;
    parentId: string | null;
  }>;
  onReply: (parentId: string) => void;
}) {
  const [showReplies, setShowReplies] = useState(true);
  const isTopLevel = comment.parentId === null;

  return (
    <div className={isTopLevel ? "" : "ml-6 border-l-2 border-muted pl-4"}>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {comment.authorEmail ?? "Unknown"}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.createdAt), {
              addSuffix: true,
            })}
          </span>
        </div>
        <div
          className="prose prose-sm max-w-none text-sm"
          dangerouslySetInnerHTML={{ __html: comment.content }}
        />
        {isTopLevel && (
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => onReply(comment.id)}
            >
              <Reply className="mr-1 h-3 w-3" />
              Reply
            </Button>
            {replies.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => setShowReplies(!showReplies)}
              >
                {showReplies ? (
                  <ChevronDown className="mr-1 h-3 w-3" />
                ) : (
                  <ChevronRight className="mr-1 h-3 w-3" />
                )}
                {replies.length} {replies.length === 1 ? "reply" : "replies"}
              </Button>
            )}
          </div>
        )}
      </div>
      {isTopLevel && showReplies && replies.length > 0 && (
        <div className="mt-2 space-y-3">
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              replies={[]}
              onReply={onReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function DiscussionThread({ submissionId }: DiscussionThreadProps) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const { data: comments, isPending: isLoading } =
    trpc.submissions.listDiscussionComments.useQuery({ submissionId });

  const addComment = trpc.submissions.addDiscussionComment.useMutation({
    onSuccess: () => {
      toast.success("Comment posted");
      setReplyingTo(null);
      utils.submissions.listDiscussionComments.invalidate({ submissionId });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = (content: string, parentId?: string) => {
    addComment.mutate({ submissionId, parentId, content });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  // Group comments by threading
  const topLevel = (comments ?? []).filter((c) => c.parentId === null);
  const repliesByParent = new Map<string, typeof comments>();
  for (const c of comments ?? []) {
    if (c.parentId) {
      const existing = repliesByParent.get(c.parentId) ?? [];
      existing.push(c);
      repliesByParent.set(c.parentId, existing);
    }
  }

  return (
    <div className="space-y-4">
      {topLevel.length === 0 && !replyingTo && (
        <p className="text-sm text-muted-foreground">No discussion yet.</p>
      )}

      {topLevel.map((comment) => (
        <div key={comment.id}>
          <CommentItem
            comment={comment}
            replies={repliesByParent.get(comment.id) ?? []}
            onReply={setReplyingTo}
          />
          {replyingTo === comment.id && (
            <div className="ml-6 mt-2">
              <CommentEditor
                onSubmit={(html) => handleSubmit(html, comment.id)}
                isPending={addComment.isPending}
                placeholder="Write a reply..."
                autoFocus
              />
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 text-xs"
                onClick={() => setReplyingTo(null)}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      ))}

      <CommentEditor
        onSubmit={(html) => handleSubmit(html)}
        isPending={addComment.isPending}
      />
    </div>
  );
}
