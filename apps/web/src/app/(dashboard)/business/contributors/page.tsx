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

export default function ContributorsPage() {
  const { data, isPending: isLoading } = trpc.contributors.list.useQuery({
    page: 1,
    limit: 20,
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Contributors</h1>

      {isLoading && <p className="text-muted-foreground">Loading...</p>}

      {data && data.items.length === 0 && (
        <p className="text-muted-foreground">
          No contributors yet. Contributors link authors, translators, and other
          creatives to their published works.
        </p>
      )}

      {data && data.items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Pronouns</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.displayName}</TableCell>
                <TableCell>{c.email ?? "—"}</TableCell>
                <TableCell>{c.pronouns ?? "—"}</TableCell>
                <TableCell>
                  {new Date(c.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
