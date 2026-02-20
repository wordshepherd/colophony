"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FileUploadConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

export function FileUploadConfig({ config, onChange }: FileUploadConfigProps) {
  const allowedMimeTypes =
    (config.allowedMimeTypes as string[] | undefined) ?? [];

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="maxFiles" className="text-xs">
          Max Files
        </Label>
        <Input
          id="maxFiles"
          type="number"
          min={1}
          value={(config.maxFiles as number) ?? ""}
          onChange={(e) =>
            onChange({
              ...config,
              maxFiles: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          placeholder="No limit"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="maxFileSize" className="text-xs">
          Max File Size (bytes)
        </Label>
        <Input
          id="maxFileSize"
          type="number"
          min={1}
          value={(config.maxFileSize as number) ?? ""}
          onChange={(e) =>
            onChange({
              ...config,
              maxFileSize: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          placeholder="No limit"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="allowedMimeTypes" className="text-xs">
          Allowed MIME Types
        </Label>
        <Input
          id="allowedMimeTypes"
          value={allowedMimeTypes.join(", ")}
          onChange={(e) =>
            onChange({
              ...config,
              allowedMimeTypes: e.target.value
                ? e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : undefined,
            })
          }
          placeholder="e.g. application/pdf, image/png"
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated list. Leave empty to allow all types.
        </p>
      </div>
    </div>
  );
}
