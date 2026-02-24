"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc";
import { ContractStatusBadge } from "./contract-status-badge";
import { GenerateContractDialog } from "./generate-contract-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";

interface PipelineContractsTabProps {
  pipelineItemId: string;
  isAdmin: boolean;
}

export function PipelineContractsTab({
  pipelineItemId,
  isAdmin,
}: PipelineContractsTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: contracts, isPending: isLoading } =
    trpc.contracts.listByPipelineItem.useQuery({ pipelineItemId });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Contracts</h3>
        {isAdmin && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Generate Contract
          </Button>
        )}
      </div>

      {!contracts || contracts.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            No contracts for this pipeline item.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.map((contract) => (
              <TableRow key={contract.id}>
                <TableCell>
                  <ContractStatusBadge status={contract.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(contract.createdAt), "PP")}
                </TableCell>
                <TableCell>
                  <Link href={`/slate/contracts/${contract.id}`}>
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <GenerateContractDialog
        pipelineItemId={pipelineItemId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
