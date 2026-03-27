"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WriterStatusBadge } from "./writer-status-badge";
import type { WriterStatus } from "@colophony/types";

interface SubmissionCardProps {
  submission: {
    id: string;
    title: string | null;
    writerStatus: WriterStatus;
    writerStatusLabel: string;
    createdAt: Date | string;
    submittedAt: Date | string | null;
  };
}

export function SubmissionCard({ submission }: SubmissionCardProps) {
  const date = submission.submittedAt ?? submission.createdAt;

  return (
    <Link href={`/submissions/${submission.id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base line-clamp-2">
              {submission.title ?? "Untitled"}
            </CardTitle>
            <WriterStatusBadge
              status={submission.writerStatus}
              label={submission.writerStatusLabel}
            />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {submission.submittedAt ? "Submitted" : "Created"}{" "}
            {formatDistanceToNow(new Date(date), { addSuffix: true })}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
