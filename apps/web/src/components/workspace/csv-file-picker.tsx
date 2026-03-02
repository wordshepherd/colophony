"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CsvFilePickerProps {
  onFileSelected: (file: File) => void;
  accept?: string;
  maxSizeMb?: number;
}

export function CsvFilePicker({
  onFileSelected,
  accept = ".csv,.tsv,.txt",
  maxSizeMb = 5,
}: CsvFilePickerProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null);

      const ext = file.name.split(".").pop()?.toLowerCase();
      const allowed = accept.split(",").map((a) => a.trim().replace(".", ""));
      if (ext && !allowed.includes(ext)) {
        setError(`Invalid file type. Allowed: ${accept}`);
        return;
      }

      const maxBytes = maxSizeMb * 1024 * 1024;
      if (file.size > maxBytes) {
        setError(`File too large. Maximum: ${maxSizeMb}MB`);
        return;
      }

      setSelectedFile(file);
      onFileSelected(file);
    },
    [accept, maxSizeMb, onFileSelected],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect],
  );

  const clearFile = useCallback(() => {
    setSelectedFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  return (
    <div>
      <Card
        className={cn(
          "relative border-2 border-dashed p-8 text-center transition-colors cursor-pointer",
          dragActive && "border-primary bg-primary/5",
          !dragActive &&
            "border-muted-foreground/25 hover:border-muted-foreground/50",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
        />

        {selectedFile ? (
          <div className="flex items-center justify-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div className="text-left">
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                clearFile();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">
              Drop your CSV file here or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              Supports {accept} up to {maxSizeMb}MB
            </p>
          </div>
        )}
      </Card>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
