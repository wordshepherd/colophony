"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  CollectionVisibility,
  CollectionTypeHint,
} from "@colophony/types";

interface CollectionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    description?: string;
    visibility?: CollectionVisibility;
    typeHint?: CollectionTypeHint;
  }) => void;
  isSubmitting?: boolean;
  initialValues?: {
    name?: string;
    description?: string | null;
    visibility?: CollectionVisibility;
    typeHint?: CollectionTypeHint;
  };
  title?: string;
}

export function CollectionForm({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  initialValues,
  title = "New Collection",
}: CollectionFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [visibility, setVisibility] = useState<CollectionVisibility>(
    initialValues?.visibility ?? "private",
  );
  const [typeHint, setTypeHint] = useState<CollectionTypeHint>(
    initialValues?.typeHint ?? "custom",
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      visibility,
      typeHint,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="collection-name">Name</Label>
            <Input
              id="collection-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Spring Issue Holds"
              maxLength={255}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="collection-description">
              Description{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Textarea
              id="collection-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this collection for?"
              rows={2}
              maxLength={5000}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={typeHint}
                onValueChange={(v) => setTypeHint(v as CollectionTypeHint)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom</SelectItem>
                  <SelectItem value="holds">Holds</SelectItem>
                  <SelectItem value="reading_list">Reading List</SelectItem>
                  <SelectItem value="comparison">Comparison</SelectItem>
                  <SelectItem value="issue_planning">Issue Planning</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select
                value={visibility}
                onValueChange={(v) => setVisibility(v as CollectionVisibility)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
