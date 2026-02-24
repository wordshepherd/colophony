"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc";
import { ContractStatusBadge } from "./contract-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Send, Ban, Loader2 } from "lucide-react";

interface ContractDetailProps {
  contractId: string;
}

export function ContractDetail({ contractId }: ContractDetailProps) {
  const utils = trpc.useUtils();
  const [sendOpen, setSendOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);

  const { data: contract, isPending: isLoading } =
    trpc.contracts.getById.useQuery({ id: contractId });

  const sendMutation = trpc.contracts.send.useMutation({
    onSuccess: () => {
      toast.success("Contract sent");
      utils.contracts.getById.invalidate({ id: contractId });
      utils.contracts.list.invalidate();
      setSendOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const voidMutation = trpc.contracts.void.useMutation({
    onSuccess: () => {
      toast.success("Contract voided");
      utils.contracts.getById.invalidate({ id: contractId });
      utils.contracts.list.invalidate();
      setVoidOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-96 md:col-span-2" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Contract not found</p>
        <Link href="/slate/contracts">
          <Button variant="link">Back to contracts</Button>
        </Link>
      </div>
    );
  }

  const canSend = contract.status === "DRAFT";
  const canVoid =
    contract.status !== "COMPLETED" && contract.status !== "VOIDED";
  const mergeData = (contract.mergeData ?? {}) as Record<string, string>;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href="/slate/contracts"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to contracts
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Contract</h1>
            <ContractStatusBadge status={contract.status} />
          </div>
          <div className="flex items-center gap-2">
            {canSend && (
              <AlertDialog open={sendOpen} onOpenChange={setSendOpen}>
                <AlertDialogTrigger asChild>
                  <Button>
                    <Send className="mr-2 h-4 w-4" />
                    Send
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Send Contract</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will send the contract for signing via Documenso. The
                      contract status will change to SENT.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => sendMutation.mutate({ id: contractId })}
                      disabled={sendMutation.isPending}
                    >
                      {sendMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Send Contract
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {canVoid && (
              <AlertDialog open={voidOpen} onOpenChange={setVoidOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Ban className="mr-2 h-4 w-4" />
                    Void
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Void Contract</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to void this contract? This action
                      cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => voidMutation.mutate({ id: contractId })}
                      disabled={voidMutation.isPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {voidMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Void Contract
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main — Rendered body */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Contract Body</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap">
              {contract.renderedBody}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Status
                </p>
                <div className="mt-1">
                  <ContractStatusBadge status={contract.status} />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Pipeline Item
                </p>
                <Link
                  href={`/slate/pipeline/${contract.pipelineItemId}`}
                  className="text-sm font-mono hover:underline"
                >
                  {contract.pipelineItemId.slice(0, 8)}...
                </Link>
              </div>
              {contract.contractTemplateId && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Template
                  </p>
                  <Link
                    href={`/slate/contracts/templates/${contract.contractTemplateId}`}
                    className="text-sm font-mono hover:underline"
                  >
                    {contract.contractTemplateId.slice(0, 8)}...
                  </Link>
                </div>
              )}
              {contract.documensoDocumentId && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Documenso ID
                  </p>
                  <p className="text-sm font-mono mt-1">
                    {contract.documensoDocumentId}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Created
                </p>
                <p className="text-sm mt-1">
                  {format(new Date(contract.createdAt), "PPP")}
                </p>
              </div>
              {contract.signedAt && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Signed
                  </p>
                  <p className="text-sm mt-1">
                    {format(new Date(contract.signedAt), "PPP")}
                  </p>
                </div>
              )}
              {contract.countersignedAt && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Countersigned
                  </p>
                  <p className="text-sm mt-1">
                    {format(new Date(contract.countersignedAt), "PPP")}
                  </p>
                </div>
              )}
              {contract.completedAt && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Completed
                  </p>
                  <p className="text-sm mt-1">
                    {format(new Date(contract.completedAt), "PPP")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {Object.keys(mergeData).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Merge Data</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(mergeData).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{key}</span>
                      <span>{value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
