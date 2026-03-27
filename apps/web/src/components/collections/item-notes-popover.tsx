"use client";

import { useState, type ReactNode } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface ItemNotesPopoverProps {
  notes: string | null;
  onSave: (notes: string | null) => void;
  children: ReactNode;
}

export function ItemNotesPopover({
  notes,
  onSave,
  children,
}: ItemNotesPopoverProps) {
  const [value, setValue] = useState(notes ?? "");
  const [open, setOpen] = useState(false);

  function handleSave() {
    onSave(value.trim() || null);
    setOpen(false);
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) {
      setValue(notes ?? "");
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          <Label htmlFor="item-notes" className="text-sm font-medium">
            Private Notes
          </Label>
          <Textarea
            id="item-notes"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Add notes about this submission..."
            rows={3}
            maxLength={5000}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
