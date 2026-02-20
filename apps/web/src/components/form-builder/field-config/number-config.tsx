"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NumberConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

export function NumberConfig({ config, onChange }: NumberConfigProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="min" className="text-xs">
          Minimum
        </Label>
        <Input
          id="min"
          type="number"
          value={(config.min as number) ?? ""}
          onChange={(e) =>
            onChange({
              ...config,
              min: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          placeholder="No minimum"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="max" className="text-xs">
          Maximum
        </Label>
        <Input
          id="max"
          type="number"
          value={(config.max as number) ?? ""}
          onChange={(e) =>
            onChange({
              ...config,
              max: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          placeholder="No maximum"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="step" className="text-xs">
          Step
        </Label>
        <Input
          id="step"
          type="number"
          min={0}
          value={(config.step as number) ?? ""}
          onChange={(e) =>
            onChange({
              ...config,
              step: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          placeholder="Any"
        />
      </div>
    </div>
  );
}
