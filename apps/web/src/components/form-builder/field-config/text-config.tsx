"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TextConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

export function TextConfig({ config, onChange }: TextConfigProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="minLength" className="text-xs">
          Min Length
        </Label>
        <Input
          id="minLength"
          type="number"
          min={0}
          value={(config.minLength as number) ?? ""}
          onChange={(e) =>
            onChange({
              ...config,
              minLength: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          placeholder="No minimum"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="maxLength" className="text-xs">
          Max Length
        </Label>
        <Input
          id="maxLength"
          type="number"
          min={1}
          value={(config.maxLength as number) ?? ""}
          onChange={(e) =>
            onChange({
              ...config,
              maxLength: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          placeholder="No maximum"
        />
      </div>
    </div>
  );
}
