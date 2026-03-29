"use client";

import { trpc } from "@/lib/trpc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";

const STATUS_BADGE_VARIANT: Record<string, BadgeProps["variant"]> = {
  DRAFT: "secondary",
  SENT: "outline",
  SIGNED: "default",
  ACTIVE: "default",
  REVERTED: "destructive",
};

function formatRightsType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function RightsPage() {
  const { data, isPending: isLoading } = trpc.rightsAgreements.list.useQuery({
    page: 1,
    limit: 20,
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Rights Agreements</h1>

      {isLoading && <p className="text-muted-foreground">Loading...</p>}

      {data && data.items.length === 0 && (
        <p className="text-muted-foreground">
          No rights agreements yet. Rights agreements track intellectual
          property rights for published works.
        </p>
      )}

      {data && data.items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rights Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Contributor</TableHead>
              <TableHead>Work</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  {formatRightsType(r.rightsType)}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE_VARIANT[r.status]}>
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell>{r.contributorName}</TableCell>
                <TableCell>{r.pipelineItemTitle ?? "—"}</TableCell>
                <TableCell>
                  {r.expiresAt
                    ? new Date(r.expiresAt).toLocaleDateString()
                    : "—"}
                </TableCell>
                <TableCell>
                  {new Date(r.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
