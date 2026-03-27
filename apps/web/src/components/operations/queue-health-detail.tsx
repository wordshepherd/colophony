"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface QueueCounts {
  name: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
}

interface QueueHealthDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queues: QueueCounts[];
}

function statusColor(failed: number, waiting: number): string {
  if (failed > 10) return "text-red-700 dark:text-red-400";
  if (failed > 0 || waiting >= 50)
    return "text-yellow-700 dark:text-yellow-400";
  return "text-muted-foreground";
}

export function QueueHealthDetail({
  open,
  onOpenChange,
  queues,
}: QueueHealthDetailProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Queue Health</DialogTitle>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Queue</TableHead>
              <TableHead className="text-right">Waiting</TableHead>
              <TableHead className="text-right">Active</TableHead>
              <TableHead className="text-right">Delayed</TableHead>
              <TableHead className="text-right">Failed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queues.map((q) => (
              <TableRow key={q.name}>
                <TableCell className="font-medium">{q.name}</TableCell>
                <TableCell className="text-right">{q.waiting}</TableCell>
                <TableCell className="text-right">{q.active}</TableCell>
                <TableCell className="text-right">{q.delayed}</TableCell>
                <TableCell
                  className={`text-right font-medium ${statusColor(q.failed, q.waiting)}`}
                >
                  {q.failed}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
