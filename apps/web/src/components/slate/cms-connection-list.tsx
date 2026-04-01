"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/hooks/use-organization";
import { getAdapterLabel } from "@/lib/cms-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FilterTabs,
  FilterTabsList,
  FilterTabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, Plus } from "lucide-react";
import type { CmsAdapterType } from "@colophony/types";

type AdapterFilter = CmsAdapterType | "ALL";

const ADAPTER_TABS: Array<{ value: AdapterFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "WORDPRESS", label: "WordPress" },
  { value: "GHOST", label: "Ghost" },
];

export function CmsConnectionList() {
  const { isAdmin } = useOrganization();
  const [adapterFilter, setAdapterFilter] = useState<AdapterFilter>("ALL");
  const [publicationFilter, setPublicationFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  const { data: publications } = trpc.publications.list.useQuery({
    limit: 100,
  });

  const pubMap = new Map(publications?.items.map((p) => [p.id, p.name]) ?? []);

  const { data, isPending: isLoading } = trpc.cmsConnections.list.useQuery({
    publicationId: publicationFilter === "ALL" ? undefined : publicationFilter,
    page,
    limit: 20,
  });

  // Client-side adapter filtering (single-digit counts per org)
  const filteredItems =
    data?.items.filter(
      (c) => adapterFilter === "ALL" || c.adapterType === adapterFilter,
    ) ?? [];

  const handleAdapterChange = (value: string) => {
    setAdapterFilter(value as AdapterFilter);
    setPage(1);
  };

  const handlePublicationChange = (value: string) => {
    setPublicationFilter(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">CMS Connections</h1>
        </div>
        {isAdmin && (
          <Link href="/slate/cms/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Connection
            </Button>
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs value={adapterFilter} onValueChange={handleAdapterChange}>
          <FilterTabsList>
            {ADAPTER_TABS.map((tab) => (
              <FilterTabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </FilterTabsTrigger>
            ))}
          </FilterTabsList>
        </FilterTabs>

        {publications && publications.items.length > 0 && (
          <Select
            value={publicationFilter}
            onValueChange={handlePublicationChange}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All publications" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All publications</SelectItem>
              {publications.items.map((pub) => (
                <SelectItem key={pub.id} value={pub.id}>
                  {pub.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connections</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No CMS connections yet</p>
              {isAdmin && (
                <Link href="/slate/cms/new">
                  <Button variant="link">
                    Create your first CMS connection
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Adapter</TableHead>
                    <TableHead>Publication</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((connection) => (
                    <TableRow key={connection.id}>
                      <TableCell>
                        <Link
                          href={`/slate/cms/${connection.id}`}
                          className="font-medium hover:underline"
                        >
                          {connection.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getAdapterLabel(connection.adapterType)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {connection.publicationId
                          ? (pubMap.get(connection.publicationId) ?? "—")
                          : "Org-wide"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${connection.isActive ? "bg-status-success" : "bg-status-info"}`}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {connection.lastSyncAt
                          ? format(new Date(connection.lastSyncAt), "PP")
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(connection.createdAt), "PP")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {data && data.total > 20 && (
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
