"use client";

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { ManuscriptEditor } from "@/components/manuscripts/manuscript-editor";
import { ManuscriptDiff } from "@/components/manuscripts/manuscript-diff";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Save, Loader2, AlertCircle } from "lucide-react";
import type { ProseMirrorDoc, GenreHint } from "@colophony/types";

interface PipelineCopyeditTabProps {
  pipelineItemId: string;
}

export function PipelineCopyeditTab({
  pipelineItemId,
}: PipelineCopyeditTabProps) {
  const [editedDoc, setEditedDoc] = useState<ProseMirrorDoc | null>(null);
  const [activeTab, setActiveTab] = useState("edit");

  const {
    data: copyeditData,
    isPending: isLoading,
    error,
  } = trpc.pipeline.getCopyeditContent.useQuery({ id: pipelineItemId });

  const utils = trpc.useUtils();

  const saveMutation = trpc.pipeline.saveCopyedit.useMutation({
    onSuccess: () => {
      toast.success("Copyedit saved as new version");
      utils.pipeline.getCopyeditContent.invalidate({ id: pipelineItemId });
      setActiveTab("diff");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleChange = useCallback((doc: ProseMirrorDoc) => {
    setEditedDoc(doc);
  }, []);

  const handleSave = () => {
    if (!editedDoc) return;
    saveMutation.mutate({
      id: pipelineItemId,
      content: editedDoc as unknown as {
        type: "doc";
        content: unknown[];
        attrs?: Record<string, unknown>;
      },
      label: "Copyedit",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 text-destructive">
        <AlertCircle className="h-4 w-4" />
        Failed to load manuscript content.
      </div>
    );
  }

  if (!copyeditData || copyeditData.contentExtractionStatus !== "COMPLETE") {
    const statusMessage =
      copyeditData?.contentExtractionStatus === "EXTRACTING"
        ? "Content is being extracted\u2026"
        : copyeditData?.contentExtractionStatus === "FAILED"
          ? "Content extraction failed. The original file may need to be re-uploaded."
          : "Content has not been extracted yet.";

    return (
      <div className="flex items-center gap-2 p-4 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        {statusMessage}
      </div>
    );
  }

  const content = copyeditData.content as ProseMirrorDoc;
  const genreHint = (copyeditData.genreHint as GenreHint) ?? "prose";

  const isDirty = editedDoc !== null;
  // `content` from the query is the original version for diff purposes
  const originalDoc = content;

  // Find previous version for diff
  const previousVersion =
    copyeditData.versions.length > 1
      ? copyeditData.versions[copyeditData.versions.length - 2]
      : null;

  return (
    <div className="space-y-4">
      {/* Save bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {copyeditData.versions.length > 1
            ? `Version ${copyeditData.versions.length} of ${copyeditData.versions.length}`
            : "Original version"}
        </p>
        <Button
          onClick={handleSave}
          disabled={!isDirty || saveMutation.isPending}
          size="sm"
        >
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save as new version
        </Button>
      </div>

      {/* Edit / Diff tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="diff" disabled={!previousVersion && !isDirty}>
            Diff
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="mt-4">
          <ManuscriptEditor
            content={content}
            genreHint={genreHint}
            onChange={handleChange}
          />
        </TabsContent>

        <TabsContent value="diff" className="mt-4">
          {editedDoc && originalDoc ? (
            <div className="rounded-md border p-6">
              <ManuscriptDiff original={originalDoc} edited={editedDoc} />
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Make edits to see a diff comparison.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
