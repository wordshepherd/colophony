"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus } from "lucide-react";

export function ContractTemplateList() {
  const [page, setPage] = useState(1);

  const { data, isPending: isLoading } = trpc.contractTemplates.list.useQuery({
    page,
    limit: 20,
  });

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
          <h1 className="text-2xl font-bold">Contract Templates</h1>
          <Link href="/slate/contracts/templates/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
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
              <p className="text-muted-foreground">No templates yet</p>
              <Link href="/slate/contracts/templates/new">
                <Button variant="link">Create your first template</Button>
              </Link>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Default</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <Link
                          href={`/slate/contracts/templates/${template.id}`}
                          className="font-medium hover:underline"
                        >
                          {template.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
                        {template.description ?? "\u2014"}
                      </TableCell>
                      <TableCell>
                        {template.isDefault && (
                          <Badge variant="secondary">Default</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(template.createdAt), "PP")}
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
