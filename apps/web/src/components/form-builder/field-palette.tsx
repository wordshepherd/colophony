"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FIELD_CATEGORIES, FIELD_TYPE_META } from "./field-type-meta";
import type { FormFieldType } from "@colophony/types";

interface FieldPaletteProps {
  onAddField: (type: FormFieldType) => void;
  disabled?: boolean;
}

export function FieldPalette({ onAddField, disabled }: FieldPaletteProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        <h2 className="font-semibold text-sm">Add Field</h2>
        {FIELD_CATEGORIES.map((category) => {
          const fields = (
            Object.entries(FIELD_TYPE_META) as Array<
              [FormFieldType, (typeof FIELD_TYPE_META)[FormFieldType]]
            >
          ).filter(([, meta]) => meta.category === category.key);

          if (fields.length === 0) return null;

          return (
            <div key={category.key} className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {category.label}
              </h3>
              <div className="grid grid-cols-1 gap-1">
                {fields.map(([type, meta]) => (
                  <Button
                    key={type}
                    variant="ghost"
                    size="sm"
                    className="justify-start h-9"
                    disabled={disabled}
                    onClick={() => onAddField(type)}
                  >
                    <meta.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {meta.label}
                  </Button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
