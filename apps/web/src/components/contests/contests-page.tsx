"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trophy, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { computePeriodStatus } from "@colophony/types";

const SKELETON_ITEMS = Array.from({ length: 3 });

export function ContestsPage() {
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [totalRounds, setTotalRounds] = useState("");

  const utils = trpc.useUtils();

  const { data, isPending: isLoading } = trpc.contests.listGroups.useQuery({
    page,
    limit: 20,
  });

  const createMutation = trpc.contests.createGroup.useMutation({
    onSuccess: () => {
      utils.contests.listGroups.invalidate();
      setCreateOpen(false);
      setName("");
      setDescription("");
      setTotalRounds("");
    },
  });

  function handleCreate() {
    createMutation.mutate({
      name,
      description: description || undefined,
      totalRoundsPlanned: totalRounds ? Number(totalRounds) : undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Contest Management
          </h1>
          <p className="text-muted-foreground">
            Manage multi-round contests with judges, scoring, and prizes
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Contest
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Contest</DialogTitle>
              <DialogDescription>
                Create a contest group to organize multi-round competitions
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="contest-name">Contest Name</Label>
                <Input
                  id="contest-name"
                  placeholder="2026 Fiction Prize"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contest-description">Description</Label>
                <Textarea
                  id="contest-description"
                  placeholder="Annual fiction contest with two rounds..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contest-rounds">Planned Rounds</Label>
                <Input
                  id="contest-rounds"
                  type="number"
                  min={1}
                  max={20}
                  placeholder="2"
                  value={totalRounds}
                  onChange={(e) => setTotalRounds(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={!name.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create Contest"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {SKELETON_ITEMS.map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Trophy className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No contests yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Create your first contest to get started with multi-round
              competitions
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.items.map((group) => (
            <ContestGroupCard key={group.id} group={group} />
          ))}

          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ContestGroupCard({
  group,
}: {
  group: {
    id: string;
    name: string;
    description: string | null;
    totalRoundsPlanned: number | null;
    createdAt: Date | string;
  };
}) {
  const { data: rounds, isPending: isLoading } =
    trpc.contests.listGroupRounds.useQuery({ id: group.id });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              {group.name}
            </CardTitle>
            {group.description && (
              <CardDescription className="mt-1">
                {group.description}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2">
            {group.totalRoundsPlanned && (
              <Badge variant="secondary">
                {group.totalRoundsPlanned} rounds planned
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : !rounds?.length ? (
          <p className="text-sm text-muted-foreground">
            No rounds yet. Create a contest period and link it to this group.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Round</TableHead>
                <TableHead>Period Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rounds.map((round) => {
                const opensAt = new Date(round.opensAt);
                const closesAt = new Date(round.closesAt);
                const status = computePeriodStatus(opensAt, closesAt);
                return (
                  <TableRow key={round.id}>
                    <TableCell>
                      {round.contestRound ? `Round ${round.contestRound}` : "-"}
                    </TableCell>
                    <TableCell className="font-medium">{round.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          status === "OPEN"
                            ? "default"
                            : status === "UPCOMING"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(opensAt, "MMM d")} -{" "}
                      {format(closesAt, "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
