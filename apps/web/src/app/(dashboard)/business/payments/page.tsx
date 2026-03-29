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
  PENDING: "secondary",
  PROCESSING: "outline",
  SUCCEEDED: "default",
  FAILED: "destructive",
  REFUNDED: "secondary",
};

const DIRECTION_BADGE_VARIANT: Record<string, BadgeProps["variant"]> = {
  inbound: "default",
  outbound: "outline",
};

function formatCents(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function PaymentsPage() {
  const { data, isPending: isLoading } = trpc.paymentTransactions.list.useQuery(
    {
      page: 1,
      limit: 20,
    },
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Payments</h1>

      {isLoading && <p className="text-muted-foreground">Loading...</p>}

      {data && data.items.length === 0 && (
        <p className="text-muted-foreground">
          No payment transactions yet. Submission fees, contributor payments,
          and contest prizes will appear here.
        </p>
      )}

      {data && data.items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Contributor</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="font-medium">
                  {formatType(tx.type)}
                </TableCell>
                <TableCell>
                  <Badge variant={DIRECTION_BADGE_VARIANT[tx.direction]}>
                    {tx.direction}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {formatCents(tx.amount, tx.currency)}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE_VARIANT[tx.status]}>
                    {tx.status}
                  </Badge>
                </TableCell>
                <TableCell>{tx.contributorName ?? "—"}</TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {tx.description ?? "—"}
                </TableCell>
                <TableCell>
                  {new Date(tx.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
