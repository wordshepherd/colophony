"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  active: "border-green-500 text-green-700",
  suspended: "border-yellow-500 text-yellow-700",
  revoked: "border-red-500 text-red-700",
};

type Tab = "all" | "active" | "suspended" | "revoked";

export function HubAdmin() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");

  const {
    data: instances,
    isPending: isLoading,
    error,
  } = trpc.hub.listInstances.useQuery();

  // Hub not enabled — show info card
  if (error?.data?.code === "NOT_FOUND") {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/federation">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Federation
          </Link>
        </Button>

        <h1 className="text-2xl font-bold">Hub Administration</h1>

        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <Info className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Hub mode is not enabled on this instance. Set federation mode to
              &ldquo;managed_hub&rdquo; to enable hub administration.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allInstances = instances ?? [];
  const filtered =
    tab === "all" ? allInstances : allInstances.filter((i) => i.status === tab);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/federation">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Federation
        </Link>
      </Button>

      <h1 className="text-2xl font-bold">Hub Administration</h1>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="suspended">Suspended</TabsTrigger>
          <TabsTrigger value="revoked">Revoked</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Registered Instances</CardTitle>
          <CardDescription>Instances registered with this hub</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No instances found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Instance URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((instance) => (
                  <TableRow
                    key={instance.id}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(`/federation/hub/${instance.id}`)
                    }
                  >
                    <TableCell>{instance.domain}</TableCell>
                    <TableCell className="text-sm">
                      {instance.instanceUrl}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STATUS_COLORS[instance.status] ?? ""}
                      >
                        {instance.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {instance.lastSeenAt
                        ? format(new Date(instance.lastSeenAt), "PP")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {format(new Date(instance.createdAt), "PP")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
