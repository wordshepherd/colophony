"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PipelineStageBadge } from "./pipeline-stage-badge";
import type { PipelineStage } from "@colophony/types";

const UNSECTIONED_VALUE = "__unsectioned__";

const STAGE_TABS: Array<{ value: PipelineStage | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "READY_TO_PUBLISH", label: "Ready" },
  { value: "COPYEDIT_IN_PROGRESS", label: "Copyedit" },
  { value: "PROOFREAD", label: "Proofread" },
  { value: "PUBLISHED", label: "Published" },
];

interface AddItemDialogProps {
  issueId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingPipelineIds: Set<string>;
  sections: Array<{ id: string; title: string }>;
}

export function AddItemDialog({
  issueId,
  open,
  onOpenChange,
  existingPipelineIds,
  sections,
}: AddItemDialogProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<PipelineStage | "ALL">("ALL");
  const [selectedPipelineItemId, setSelectedPipelineItemId] = useState<
    string | null
  >(null);
  const [targetSectionId, setTargetSectionId] =
    useState<string>(UNSECTIONED_VALUE);
  const utils = trpc.useUtils();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset state when dialog opens (render-time state adjustment)
  const [prevOpen, setPrevOpen] = useState(false);
  if (open && !prevOpen) {
    setSearch("");
    setDebouncedSearch("");
    setStageFilter("ALL");
    setSelectedPipelineItemId(null);
    setTargetSectionId(UNSECTIONED_VALUE);
  }
  if (open !== prevOpen) {
    setPrevOpen(open);
  }

  const { data, isPending } = trpc.pipeline.list.useQuery(
    {
      stage: stageFilter === "ALL" ? undefined : stageFilter,
      search: debouncedSearch || undefined,
      limit: 50,
    },
    { enabled: open },
  );

  const availableItems =
    data?.items.filter((item) => !existingPipelineIds.has(item.id)) ?? [];

  const mutation = trpc.issues.addItem.useMutation({
    onSuccess: () => {
      toast.success("Item added to issue");
      utils.issues.getItems.invalidate({ id: issueId });
      setSelectedPipelineItemId(null);
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleAdd = () => {
    if (!selectedPipelineItemId) return;
    mutation.mutate({
      id: issueId,
      pipelineItemId: selectedPipelineItemId,
      issueSectionId:
        targetSectionId === UNSECTIONED_VALUE ? undefined : targetSectionId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Pipeline Item</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Input
              placeholder="Search pipeline items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Stage filter */}
          <Tabs
            value={stageFilter}
            onValueChange={(v) => setStageFilter(v as PipelineStage | "ALL")}
          >
            <TabsList className="h-8">
              {STAGE_TABS.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="text-xs px-2 py-1"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Items table */}
          <div className="max-h-[300px] overflow-auto border rounded-md">
            {isPending ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : availableItems.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stage</TableHead>
                    <TableHead>Submission</TableHead>
                    <TableHead>Publication</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableItems.map((item) => (
                    <TableRow
                      key={item.id}
                      className={cn(
                        "cursor-pointer",
                        selectedPipelineItemId === item.id && "bg-accent",
                      )}
                      onClick={() => setSelectedPipelineItemId(item.id)}
                    >
                      <TableCell>
                        <PipelineStageBadge stage={item.stage} />
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.submission?.title ??
                          item.submissionId.slice(0, 8) + "\u2026"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.publication?.name ??
                          (item.publicationId
                            ? item.publicationId.slice(0, 8) + "\u2026"
                            : "\u2014")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No available pipeline items
              </p>
            )}
          </div>

          {/* Target section */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Section:</span>
            <Select value={targetSectionId} onValueChange={setTargetSectionId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSECTIONED_VALUE}>Unsectioned</SelectItem>
                {sections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!selectedPipelineItemId || mutation.isPending}
          >
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Add Item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
