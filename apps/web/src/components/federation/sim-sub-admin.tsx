"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { format } from "date-fns";

const RESULT_COLORS: Record<string, string> = {
  CLEAR: "border-status-success text-status-success",
  CONFLICT: "border-status-error text-status-error",
  PARTIAL: "border-status-warning text-status-warning",
  SKIPPED: "border-status-info text-status-info",
};

export function SimSubAdmin() {
  const [submissionId, setSubmissionId] = useState("");
  const [queryId, setQueryId] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const {
    data: checks,
    isPending: isLoading,
    error,
  } = trpc.simsub.listChecks.useQuery(
    { submissionId: queryId! },
    { enabled: !!queryId },
  );

  const overrideMutation = trpc.simsub.grantOverride.useMutation({
    onSuccess: () => {
      toast.success("Override granted");
      if (queryId)
        utils.simsub.listChecks.invalidate({ submissionId: queryId });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleLookup = () => {
    const trimmed = submissionId.trim();
    if (trimmed) setQueryId(trimmed);
  };

  const latestConflict = checks?.find((c) => c.result === "CONFLICT") ?? null;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/federation">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Federation
        </Link>
      </Button>

      <h1 className="text-2xl font-bold">Sim-Sub Checks</h1>

      {/* Lookup form */}
      <Card>
        <CardHeader>
          <CardTitle>Look Up Submission</CardTitle>
          <CardDescription>
            Enter a submission ID to view its simultaneous submission check
            history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Submission UUID"
              value={submissionId}
              onChange={(e) => setSubmissionId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            />
            <Button onClick={handleLookup} disabled={!submissionId.trim()}>
              <Search className="mr-2 h-4 w-4" />
              Look Up
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {queryId && (
        <Card>
          <CardHeader>
            <CardTitle>Check History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : error ? (
              <p className="text-sm text-destructive">{error.message}</p>
            ) : !checks || checks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No sim-sub checks found for this submission.
              </p>
            ) : (
              <>
                {latestConflict && (
                  <div className="mb-4">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          Grant Override
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Grant Sim-Sub Override
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This will allow the submission to proceed despite
                            the simultaneous submission conflict. Are you sure?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              overrideMutation.mutate({
                                submissionId: queryId,
                              })
                            }
                          >
                            Grant Override
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Fingerprint</TableHead>
                      <TableHead>Override</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checks.map((check) => (
                      <React.Fragment key={check.id}>
                        <TableRow>
                          <TableCell>
                            {format(new Date(check.createdAt), "PPpp")}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={RESULT_COLORS[check.result] ?? ""}
                            >
                              {check.result}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {check.fingerprint?.slice(0, 16) ?? "—"}
                          </TableCell>
                          <TableCell>
                            {check.overriddenBy ? (
                              <Badge variant="secondary">Overridden</Badge>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                        {check.result === "CONFLICT" && (
                          <TableRow>
                            <TableCell colSpan={4}>
                              <div className="space-y-2 py-2 text-sm">
                                {check.localConflicts.length > 0 && (
                                  <div>
                                    <span className="font-medium">
                                      Local conflicts:
                                    </span>{" "}
                                    {check.localConflicts
                                      .map((c) => c.publicationName)
                                      .join(", ")}
                                  </div>
                                )}
                                {check.remoteResults.length > 0 && (
                                  <div>
                                    <span className="font-medium">
                                      Remote results:
                                    </span>{" "}
                                    {check.remoteResults
                                      .map((r) => `${r.domain}: ${r.status}`)
                                      .join(", ")}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
