"use client";

import { useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { trpc } from "@/lib/trpc";
import { FileText } from "lucide-react";

interface AddSubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (submissionId: string) => void;
  excludeIds?: Set<string>;
}

export function AddSubmissionDialog({
  open,
  onOpenChange,
  onSelect,
  excludeIds,
}: AddSubmissionDialogProps) {
  const [search, setSearch] = useState("");

  const { data, isPending: isLoading } = trpc.submissions.list.useQuery(
    { search: search || undefined, page: 1, limit: 20 },
    { enabled: open && search.length > 0 },
  );

  const submissions = data?.items ?? [];
  const filtered = excludeIds
    ? submissions.filter((s) => !excludeIds.has(s.id))
    : submissions;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search submissions by title..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>
          {isLoading
            ? "Searching..."
            : search
              ? "No submissions found."
              : "Type to search submissions."}
        </CommandEmpty>
        {filtered.length > 0 && (
          <CommandGroup heading="Submissions">
            {filtered.map((sub) => (
              <CommandItem
                key={sub.id}
                value={sub.id}
                onSelect={() => {
                  onSelect(sub.id);
                  onOpenChange(false);
                  setSearch("");
                }}
              >
                <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="truncate">{sub.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
