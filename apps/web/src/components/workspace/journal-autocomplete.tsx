"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useDebounce } from "@/hooks/use-debounce";
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
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown } from "lucide-react";

interface JournalAutocompleteProps {
  value: string;
  onChange: (name: string, directoryId?: string) => void;
}

export function JournalAutocomplete({
  value,
  onChange,
}: JournalAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { data: journals } = trpc.journalDirectory.search.useQuery(
    { query: debouncedSearch, limit: 10 },
    { enabled: debouncedSearch.length > 0 },
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {value || "Select or type journal name..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search journals..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {search ? (
                <CommandItem
                  onSelect={() => {
                    onChange(search);
                    setOpen(false);
                  }}
                >
                  Use &quot;{search}&quot; as journal name
                </CommandItem>
              ) : (
                "Type to search..."
              )}
            </CommandEmpty>
            {journals && journals.length > 0 && (
              <CommandGroup heading="Journals">
                {journals.map((j) => (
                  <CommandItem
                    key={j.id}
                    onSelect={() => {
                      onChange(j.name, j.id);
                      setOpen(false);
                    }}
                  >
                    <div className="flex flex-col">
                      <span>{j.name}</span>
                      {j.externalUrl && (
                        <span className="text-xs text-muted-foreground">
                          {j.externalUrl}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {search && (!journals || journals.length === 0) && (
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    onChange(search);
                    setOpen(false);
                  }}
                >
                  Use &quot;{search}&quot; as journal name
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
