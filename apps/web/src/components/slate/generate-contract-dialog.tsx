"use client";

import { useState, useMemo } from "react";
import type { MergeFieldDefinition } from "@colophony/types";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface GenerateContractDialogProps {
  pipelineItemId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated?: (contractId: string) => void;
}

export function GenerateContractDialog({
  pipelineItemId,
  open,
  onOpenChange,
  onGenerated,
}: GenerateContractDialogProps) {
  const utils = trpc.useUtils();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [mergeData, setMergeData] = useState<Record<string, string>>({});

  const { data: templates, isPending: isLoadingTemplates } =
    trpc.contractTemplates.list.useQuery({ limit: 100 }, { enabled: open });

  const selectedTemplate = templates?.items.find(
    (t) => t.id === selectedTemplateId,
  );
  const mergeFields = useMemo(
    () => (selectedTemplate?.mergeFields ?? []) as MergeFieldDefinition[],
    [selectedTemplate],
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedTemplateId("");
      setMergeData({});
    }
    onOpenChange(nextOpen);
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tmpl = templates?.items.find((t) => t.id === templateId);
    const fields = (tmpl?.mergeFields ?? []) as MergeFieldDefinition[];
    const initial: Record<string, string> = {};
    for (const field of fields) {
      // Only pre-fill fields that have a default; leave auto fields without
      // defaults empty so the backend can auto-populate them
      if (field.defaultValue) {
        initial[field.key] = field.defaultValue;
      }
    }
    setMergeData(initial);
  };

  const generateMutation = trpc.contracts.generate.useMutation({
    onSuccess: (result) => {
      toast.success("Contract generated");
      utils.contracts.listByPipelineItem.invalidate({ pipelineItemId });
      utils.contracts.list.invalidate();
      handleOpenChange(false);
      onGenerated?.(result.id);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!selectedTemplateId) return;
    // Strip empty values so the backend can auto-populate unset fields
    const filteredData = Object.fromEntries(
      Object.entries(mergeData).filter(([, v]) => v !== ""),
    );
    generateMutation.mutate({
      pipelineItemId,
      contractTemplateId: selectedTemplateId,
      mergeData:
        Object.keys(filteredData).length > 0 ? filteredData : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Contract</DialogTitle>
          <DialogDescription>
            Select a template and fill in any required merge fields.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Template</Label>
            {isLoadingTemplates ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select
                value={selectedTemplateId}
                onValueChange={handleTemplateChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates?.items.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.isDefault ? " (Default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedTemplate && mergeFields.length > 0 && (
            <div className="space-y-3">
              <Label>Merge Fields</Label>
              {mergeFields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label className="text-sm font-normal">
                    {field.label}
                    {field.source === "auto" && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (auto)
                      </span>
                    )}
                  </Label>
                  <Input
                    value={mergeData[field.key] ?? ""}
                    onChange={(e) =>
                      setMergeData((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    readOnly={field.source === "auto"}
                    placeholder={field.defaultValue || field.key}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!selectedTemplateId || generateMutation.isPending}
          >
            {generateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
