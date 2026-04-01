"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PipelineStageBadge } from "./pipeline-stage-badge";
import {
  getAgingStatus,
  getAgingColor,
  getAgingLabel,
  getDeadlineForStage,
  getHandoffStatus,
} from "./production-aging";
import type { PipelineStage } from "@colophony/types";

interface DashboardItem {
  pipelineItemId: string;
  stage: PipelineStage;
  submissionId: string;
  submissionTitle: string | null;
  issueSectionTitle: string | null;
  sortOrder: number | null;
  assignedCopyeditorEmail: string | null;
  assignedProofreaderEmail: string | null;
  copyeditDueAt: Date | string | null;
  proofreadDueAt: Date | string | null;
  authorReviewDueAt: Date | string | null;
  daysInStage: number;
  lastStageChangeAt: Date | string;
  contractStatus: string | null;
}

interface ProductionPipelineTableProps {
  items: DashboardItem[];
}

export function ProductionPipelineTable({
  items,
}: ProductionPipelineTableProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No pieces assigned to this issue yet.
      </p>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Piece</TableHead>
            <TableHead>Section</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead className="text-right w-[60px]">Days</TableHead>
            <TableHead>Deadline</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Handoff</TableHead>
            <TableHead>Contract</TableHead>
            <TableHead>Assignee</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const deadline = getDeadlineForStage(item);
            const aging = getAgingStatus(item.daysInStage, deadline);
            const agingColor = getAgingColor(aging);
            const handoff = getHandoffStatus(item.stage);

            // Pick assignee based on stage
            const assignee =
              item.stage === "COPYEDIT_PENDING" ||
              item.stage === "COPYEDIT_IN_PROGRESS"
                ? item.assignedCopyeditorEmail
                : item.stage === "PROOFREAD"
                  ? item.assignedProofreaderEmail
                  : (item.assignedCopyeditorEmail ??
                    item.assignedProofreaderEmail);

            return (
              <TableRow key={item.pipelineItemId}>
                <TableCell className="font-medium">
                  <Link
                    href={`/slate/pipeline/${item.pipelineItemId}`}
                    className="hover:underline"
                  >
                    {item.submissionTitle ?? "Untitled"}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.issueSectionTitle ?? "—"}
                </TableCell>
                <TableCell>
                  <PipelineStageBadge stage={item.stage} />
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={`inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-medium ${agingColor.badge}`}
                  >
                    {item.daysInStage}
                  </span>
                </TableCell>
                <TableCell>
                  {deadline ? (
                    <span
                      className={
                        aging === "overdue"
                          ? "text-status-error font-medium"
                          : "text-muted-foreground"
                      }
                    >
                      {format(new Date(deadline), "MMM d")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={`text-xs ${agingColor.badge}`}
                  >
                    {getAgingLabel(aging)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {handoff === "waiting-external" ? (
                    <span className="text-status-held text-sm">
                      Waiting: Author
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      Internal
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {item.contractStatus ? (
                    <Badge variant="outline" className="text-xs">
                      {item.contractStatus}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {assignee ?? "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
