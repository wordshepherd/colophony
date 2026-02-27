"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

interface SelectOption {
  label: string;
  value: string;
}

interface SelectConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function SelectConfig({ config, onChange }: SelectConfigProps) {
  const options = (config.options as SelectOption[] | undefined) ?? [];
  const [newLabel, setNewLabel] = useState("");

  function addOption() {
    const label = newLabel.trim();
    if (!label) return;
    const value = slugify(label);
    if (!value) return;
    onChange({
      ...config,
      options: [...options, { label, value }],
    });
    setNewLabel("");
  }

  function removeOption(index: number) {
    onChange({
      ...config,
      options: options.filter((_, i) => i !== index),
    });
  }

  function updateOption(index: number, field: "label" | "value", val: string) {
    const updated = options.map((opt, i) =>
      i === index ? { ...opt, [field]: val } : opt,
    );
    onChange({ ...config, options: updated });
  }

  return (
    <div className="space-y-3">
      <Label className="text-xs">Options</Label>
      <div className="space-y-2">
        {options.map((option, index) => (
          <div
            key={option.value || `opt-${index}`}
            className="flex items-center gap-2"
          >
            <Input
              value={option.label}
              onChange={(e) => updateOption(index, "label", e.target.value)}
              placeholder="Label"
              className="flex-1"
            />
            <Input
              value={option.value}
              onChange={(e) => updateOption(index, "value", e.target.value)}
              placeholder="Value"
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeOption(index)}
              aria-label="Remove option"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="New option label"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addOption();
            }
          }}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={addOption}
          disabled={!newLabel.trim()}
        >
          <Plus className="mr-1 h-3 w-3" />
          Add
        </Button>
      </div>
    </div>
  );
}
