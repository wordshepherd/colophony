"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CsrStatusBadge } from "./csr-status-badge";
import type { CSRStatus } from "@colophony/types";
import { formatDistanceToNow } from "date-fns";

interface ExternalSubmissionCardProps {
  submission: {
    id: string;
    journalName: string;
    status: CSRStatus;
    sentAt: string | Date | null;
    respondedAt: string | Date | null;
    updatedAt: string | Date;
  };
}

export function ExternalSubmissionCard({
  submission,
}: ExternalSubmissionCardProps) {
  return (
    <Link href={`/workspace/external/${submission.id}`}>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-medium truncate">
              {submission.journalName}
            </CardTitle>
            <CsrStatusBadge status={submission.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            {submission.sentAt && (
              <span>
                Sent{" "}
                {formatDistanceToNow(new Date(submission.sentAt), {
                  addSuffix: true,
                })}
              </span>
            )}
            {submission.respondedAt && (
              <span>
                Response{" "}
                {formatDistanceToNow(new Date(submission.respondedAt), {
                  addSuffix: true,
                })}
              </span>
            )}
            <span>
              Updated{" "}
              {formatDistanceToNow(new Date(submission.updatedAt), {
                addSuffix: true,
              })}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
