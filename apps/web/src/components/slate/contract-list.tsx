"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import type { ContractStatus } from "@colophony/types";
import { trpc } from "@/lib/trpc";
import { contractStatusTabs } from "@/lib/contract-utils";
import { ContractStatusBadge } from "./contract-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileSignature } from "lucide-react";

export function ContractList() {
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "ALL">(
    "ALL",
  );
  const [page, setPage] = useState(1);

  const { data, isPending: isLoading } = trpc.contracts.list.useQuery({
    status: statusFilter === "ALL" ? undefined : statusFilter,
    page,
    limit: 20,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contracts</h1>
        <Link href="/slate/contracts/templates">
          <Button variant="outline">
            <FileSignature className="mr-2 h-4 w-4" />
            Templates
          </Button>
        </Link>
      </div>

      <Tabs
        value={statusFilter}
        onValueChange={(v) => {
          setStatusFilter(v as ContractStatus | "ALL");
          setPage(1);
        }}
      >
        <TabsList>
          {contractStatusTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>
            {statusFilter === "ALL"
              ? "All Contracts"
              : `${statusFilter} Contracts`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No contracts found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Pipeline Item</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell>
                        <Link href={`/slate/contracts/${contract.id}`}>
                          <ContractStatusBadge status={contract.status} />
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/slate/pipeline/${contract.pipelineItemId}`}
                          className="text-sm font-mono hover:underline"
                        >
                          {contract.pipelineItemId.slice(0, 8)}...
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {contract.contractTemplateId
                          ? contract.contractTemplateId.slice(0, 8) + "..."
                          : "\u2014"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(contract.createdAt), "PP")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {data.total > 20 && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center text-sm text-muted-foreground">
                    Page {page} of {Math.ceil(data.total / 20)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * 20 >= data.total}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
