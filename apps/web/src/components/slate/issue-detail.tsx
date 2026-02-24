"use client";

import { useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/hooks/use-organization";
import { IssueStatusBadge } from "./issue-status-badge";
import { IssueAssembly } from "./issue-assembly";
import { IssueItemsSummary } from "./issue-items-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ArrowLeft, Archive, CheckCircle2, Pencil } from "lucide-react";

interface IssueDetailProps {
  issueId: string;
}

export function IssueDetail({ issueId }: IssueDetailProps) {
  const { isAdmin, isEditor } = useOrganization();
  const [activeTab, setActiveTab] = useState("overview");
  const utils = trpc.useUtils();

  const { data: issue, isPending: isLoading } = trpc.issues.getById.useQuery({
    id: issueId,
  });

  const { data: sections = [] } = trpc.issues.getSections.useQuery({
    id: issueId,
  });

  const { data: items = [] } = trpc.issues.getItems.useQuery({ id: issueId });

  const { data: publications } = trpc.publications.list.useQuery({
    limit: 100,
  });

  const pubMap = new Map(publications?.items.map((p) => [p.id, p.name]) ?? []);

  const publishMutation = trpc.issues.publish.useMutation({
    onSuccess: () => {
      toast.success("Issue published");
      utils.issues.getById.invalidate({ id: issueId });
      utils.issues.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const archiveMutation = trpc.issues.archive.useMutation({
    onSuccess: () => {
      toast.success("Issue archived");
      utils.issues.getById.invalidate({ id: issueId });
      utils.issues.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Issue not found</p>
        <Link href="/slate/issues">
          <Button variant="link">Back to issues</Button>
        </Link>
      </div>
    );
  }

  const canPublish =
    isAdmin && issue.status !== "PUBLISHED" && issue.status !== "ARCHIVED";
  const canArchive = isAdmin && issue.status !== "ARCHIVED";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <Link
          href="/slate/issues"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to issues
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{issue.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <IssueStatusBadge status={issue.status} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link href={`/slate/issues/${issueId}/edit`}>
                <Button variant="outline" size="sm">
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </Link>
            )}
            {canPublish && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Publish
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Publish Issue</AlertDialogTitle>
                    <AlertDialogDescription>
                      Mark this issue as published? This will set the status to
                      Published.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => publishMutation.mutate({ id: issueId })}
                    >
                      Publish
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {canArchive && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Archive Issue</AlertDialogTitle>
                    <AlertDialogDescription>
                      Archive this issue? It will no longer appear in active
                      lists.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => archiveMutation.mutate({ id: issueId })}
                    >
                      Archive
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="assembly">Assembly</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Main column */}
            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {issue.description && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Description
                      </p>
                      <p className="text-sm mt-1 whitespace-pre-wrap">
                        {issue.description}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    {issue.publicationDate && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Publication Date
                        </p>
                        <p className="text-sm mt-1">
                          {format(new Date(issue.publicationDate), "PPP")}
                        </p>
                      </div>
                    )}
                    {(issue.volume != null || issue.issueNumber != null) && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Volume / Issue
                        </p>
                        <p className="text-sm mt-1">
                          {issue.volume ?? "\u2014"} /{" "}
                          {issue.issueNumber ?? "\u2014"}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Metadata</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Publication
                    </p>
                    <Link
                      href={`/slate/publications/${issue.publicationId}`}
                      className="text-sm hover:underline"
                    >
                      {pubMap.get(issue.publicationId) ??
                        `${issue.publicationId.slice(0, 8)}\u2026`}
                    </Link>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Status
                    </p>
                    <div className="mt-1">
                      <IssueStatusBadge status={issue.status} />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Created
                    </p>
                    <p className="text-sm mt-1">
                      {format(new Date(issue.createdAt), "PPP")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Last Updated
                    </p>
                    <p className="text-sm mt-1">
                      {formatDistanceToNow(new Date(issue.updatedAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  {issue.publishedAt && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Published At
                      </p>
                      <p className="text-sm mt-1">
                        {format(new Date(issue.publishedAt), "PPP")}
                      </p>
                    </div>
                  )}
                  <div className="border-t pt-3">
                    <IssueItemsSummary items={items} sections={sections} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Assembly Tab */}
        <TabsContent value="assembly" className="mt-6">
          <IssueAssembly
            issueId={issueId}
            sections={sections}
            items={items}
            isEditor={isEditor}
            isAdmin={isAdmin}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
