"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

interface ReviseAndResubmitCardProps {
  submissionId: string;
  manuscriptId: string;
  revisionNotes: string | null;
  onResubmitSuccess?: () => void;
}

export function ReviseAndResubmitCard({
  submissionId,
  manuscriptId,
  revisionNotes,
  onResubmitSuccess,
}: ReviseAndResubmitCardProps) {
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const utils = trpc.useUtils();

  const { data: versions, isPending: isLoadingVersions } =
    trpc.manuscripts.listVersions.useQuery({ manuscriptId });

  const resubmitMutation = trpc.submissions.resubmit.useMutation({
    onSuccess: () => {
      toast.success("Submission resubmitted successfully");
      utils.submissions.getById.invalidate({ id: submissionId });
      utils.submissions.mySubmissionDetail.invalidate({ id: submissionId });
      utils.submissions.getHistory.invalidate({ submissionId });
      utils.submissions.list.invalidate();
      onResubmitSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleResubmit = () => {
    if (!selectedVersionId) return;
    resubmitMutation.mutate({
      id: submissionId,
      manuscriptVersionId: selectedVersionId,
    });
  };

  return (
    <Card className="border-status-warning/30 bg-status-warning/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-status-warning" />
          <CardTitle className="text-status-warning">
            Revision Requested
          </CardTitle>
        </div>
        <CardDescription>
          The editors have requested revisions. Please review their notes and
          submit an updated manuscript version.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {revisionNotes && (
          <div className="rounded-md bg-background p-4">
            <p className="text-sm font-medium mb-1">Revision Notes</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {revisionNotes}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Select a manuscript version to resubmit
          </label>
          <Select
            value={selectedVersionId}
            onValueChange={setSelectedVersionId}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  isLoadingVersions ? "Loading versions..." : "Choose a version"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {versions?.map((version) => (
                <SelectItem key={version.id} value={version.id}>
                  Version {version.versionNumber}
                  {version.createdAt
                    ? ` — ${new Date(version.createdAt).toLocaleDateString()}`
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleResubmit}
          disabled={!selectedVersionId || resubmitMutation.isPending}
          className="w-full"
        >
          {resubmitMutation.isPending ? "Resubmitting..." : "Resubmit"}
        </Button>
      </CardContent>
    </Card>
  );
}
