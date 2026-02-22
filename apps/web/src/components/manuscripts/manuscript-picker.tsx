"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { FileUpload } from "@/components/submissions/file-upload";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronsUpDown,
  Check,
  Plus,
  X,
  BookOpen,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

interface ManuscriptPickerProps {
  value: string | null;
  onChange: (
    versionId: string | null,
    manuscript?: { id: string; title: string },
  ) => void;
  disabled?: boolean;
}

export function ManuscriptPicker({
  value: _value,
  onChange,
  disabled,
}: ManuscriptPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedManuscriptId, setSelectedManuscriptId] = useState<
    string | null
  >(null);

  // Inline create form state
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");

  // Search manuscripts
  const { data: manuscripts } = trpc.manuscripts.list.useQuery(
    { search: debouncedSearch || undefined, limit: 10 },
    { enabled: open },
  );

  // Fetch detail when a manuscript is selected (to get latest version)
  const { data: manuscriptDetail } = trpc.manuscripts.getDetail.useQuery(
    { id: selectedManuscriptId! },
    { enabled: !!selectedManuscriptId },
  );

  // Create mutation
  const createMutation = trpc.manuscripts.create.useMutation({
    onSuccess: (data) => {
      toast.success("Manuscript created");
      setSelectedManuscriptId(data.id);
      setShowCreateForm(false);
      setCreateTitle("");
      setCreateDescription("");
      setOpen(false);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // When manuscriptDetail loads, call onChange with the latest version ID
  useEffect(() => {
    if (manuscriptDetail && manuscriptDetail.versions.length > 0) {
      // Backend returns ASC by versionNumber — latest is last
      const latestVersion =
        manuscriptDetail.versions[manuscriptDetail.versions.length - 1];
      onChange(latestVersion.id, {
        id: manuscriptDetail.id,
        title: manuscriptDetail.title,
      });
    }
  }, [manuscriptDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (manuscriptId: string) => {
    setSelectedManuscriptId(manuscriptId);
    setOpen(false);
  };

  const handleClear = () => {
    setSelectedManuscriptId(null);
    onChange(null);
  };

  const handleInlineCreate = async () => {
    if (!createTitle.trim()) return;
    await createMutation.mutateAsync({
      title: createTitle.trim(),
      description: createDescription.trim() || undefined,
    });
  };

  // Determine the latest version for file upload
  const latestVersion = manuscriptDetail?.versions.length
    ? manuscriptDetail.versions[manuscriptDetail.versions.length - 1]
    : null;

  // Render selected state
  if (selectedManuscriptId && manuscriptDetail) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
          <BookOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium flex-1 truncate">
            {manuscriptDetail.title}
          </span>
          {!disabled && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(true)}
              >
                Change
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleClear}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {/* File upload for the latest version */}
        {latestVersion && (
          <FileUpload
            manuscriptVersionId={latestVersion.id}
            disabled={disabled}
          />
        )}

        {/* Re-open popover for changing selection */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <span />
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <ManuscriptCommandList
              manuscripts={manuscripts}
              search={search}
              onSearchChange={setSearch}
              onSelect={handleSelect}
              selectedId={selectedManuscriptId}
              showCreateForm={showCreateForm}
              onShowCreate={() => setShowCreateForm(true)}
              onCancelCreate={() => setShowCreateForm(false)}
              createTitle={createTitle}
              onCreateTitleChange={setCreateTitle}
              createDescription={createDescription}
              onCreateDescriptionChange={setCreateDescription}
              onInlineCreate={handleInlineCreate}
              isCreating={createMutation.isPending}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // Render unselected state
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          <span className="text-muted-foreground">Select a manuscript...</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <ManuscriptCommandList
          manuscripts={manuscripts}
          search={search}
          onSearchChange={setSearch}
          onSelect={handleSelect}
          selectedId={selectedManuscriptId}
          showCreateForm={showCreateForm}
          onShowCreate={() => setShowCreateForm(true)}
          onCancelCreate={() => setShowCreateForm(false)}
          createTitle={createTitle}
          onCreateTitleChange={setCreateTitle}
          createDescription={createDescription}
          onCreateDescriptionChange={setCreateDescription}
          onInlineCreate={handleInlineCreate}
          isCreating={createMutation.isPending}
        />
      </PopoverContent>
    </Popover>
  );
}

// Extracted command list to avoid duplication
function ManuscriptCommandList({
  manuscripts,
  search,
  onSearchChange,
  onSelect,
  selectedId,
  showCreateForm,
  onShowCreate,
  onCancelCreate,
  createTitle,
  onCreateTitleChange,
  createDescription,
  onCreateDescriptionChange,
  onInlineCreate,
  isCreating,
}: {
  manuscripts:
    | { items: Array<{ id: string; title: string; updatedAt: Date | string }> }
    | undefined;
  search: string;
  onSearchChange: (v: string) => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
  showCreateForm: boolean;
  onShowCreate: () => void;
  onCancelCreate: () => void;
  createTitle: string;
  onCreateTitleChange: (v: string) => void;
  createDescription: string;
  onCreateDescriptionChange: (v: string) => void;
  onInlineCreate: () => void;
  isCreating: boolean;
}) {
  if (showCreateForm) {
    return (
      <div className="p-4 space-y-3">
        <p className="text-sm font-medium">Create new manuscript</p>
        <Input
          placeholder="Title *"
          value={createTitle}
          onChange={(e) => onCreateTitleChange(e.target.value)}
          autoFocus
        />
        <Textarea
          placeholder="Description (optional)"
          className="min-h-[60px]"
          value={createDescription}
          onChange={(e) => onCreateDescriptionChange(e.target.value)}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={onInlineCreate}
            disabled={!createTitle.trim() || isCreating}
          >
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancelCreate}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Command shouldFilter={false}>
      <CommandInput
        placeholder="Search manuscripts..."
        value={search}
        onValueChange={onSearchChange}
      />
      <CommandList>
        <CommandEmpty>No manuscripts found.</CommandEmpty>
        <CommandGroup>
          {manuscripts?.items.map((m) => (
            <CommandItem
              key={m.id}
              value={m.id}
              onSelect={() => onSelect(m.id)}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  selectedId === m.id ? "opacity-100" : "opacity-0",
                )}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{m.title}</p>
                <p className="text-xs text-muted-foreground">
                  Updated{" "}
                  {formatDistanceToNow(new Date(m.updatedAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup>
          <CommandItem onSelect={onShowCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create new manuscript
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
