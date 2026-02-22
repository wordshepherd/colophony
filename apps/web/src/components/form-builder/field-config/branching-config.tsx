"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Plus, Pencil, Trash2, GitBranch } from "lucide-react";
import {
  extractBranchingConfig,
  type BranchDefinition,
} from "@colophony/types";

interface SelectOption {
  label: string;
  value: string;
}

interface BranchingConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  fieldId: string;
}

export function BranchingConfig({
  config,
  onChange,
  fieldId: _fieldId,
}: BranchingConfigProps) {
  const branching = extractBranchingConfig(config);
  const enabled = branching?.enabled ?? false;
  const branches = branching?.branches ?? [];
  const options = (config.options as SelectOption[] | undefined) ?? [];

  const [newBranchName, setNewBranchName] = useState("");
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editBranchName, setEditBranchName] = useState("");

  function updateBranching(
    newBranches: BranchDefinition[],
    newEnabled?: boolean,
  ) {
    onChange({
      ...config,
      branching: {
        enabled: newEnabled ?? enabled,
        branches: newBranches,
      },
    });
  }

  function handleToggle(checked: boolean) {
    if (checked) {
      onChange({
        ...config,
        branching: { enabled: true, branches },
      });
    } else {
      // Remove branching config entirely when disabled
      const { branching: _, ...rest } = config;
      onChange(rest);
    }
  }

  function addBranch() {
    const name = newBranchName.trim();
    if (!name) return;
    const id = crypto.randomUUID();
    updateBranching([...branches, { id, name, optionValues: [] }]);
    setNewBranchName("");
  }

  function removeBranch(branchId: string) {
    updateBranching(branches.filter((b) => b.id !== branchId));
  }

  function renameBranch(branchId: string, name: string) {
    updateBranching(
      branches.map((b) => (b.id === branchId ? { ...b, name } : b)),
    );
    setEditingBranchId(null);
  }

  function assignOptionToBranch(optionValue: string, branchId: string | null) {
    // Remove this option from all branches first
    const updated = branches.map((b) => ({
      ...b,
      optionValues: b.optionValues.filter((v) => v !== optionValue),
    }));
    // Add to target branch if specified
    if (branchId) {
      const target = updated.find((b) => b.id === branchId);
      if (target) {
        target.optionValues = [...target.optionValues, optionValue];
      }
    }
    updateBranching(updated);
  }

  function getBranchForOption(optionValue: string): string | null {
    const branch = branches.find((b) => b.optionValues.includes(optionValue));
    return branch?.id ?? null;
  }

  if (options.length === 0) return null;

  return (
    <div className="space-y-3">
      <Separator />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
          <Label className="text-xs font-medium">Branching</Label>
        </div>
        <Switch checked={enabled} onCheckedChange={handleToggle} />
      </div>

      {enabled && (
        <div className="space-y-3">
          {/* Branch list */}
          {branches.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Branches</Label>
              {branches.map((branch) => (
                <div
                  key={branch.id}
                  className="flex items-center gap-2 text-sm"
                >
                  {editingBranchId === branch.id ? (
                    <Input
                      value={editBranchName}
                      onChange={(e) => setEditBranchName(e.target.value)}
                      onBlur={() => renameBranch(branch.id, editBranchName)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          renameBranch(branch.id, editBranchName);
                        if (e.key === "Escape") setEditingBranchId(null);
                      }}
                      className="h-7 text-xs flex-1"
                      autoFocus
                    />
                  ) : (
                    <>
                      <Badge variant="secondary" className="text-xs">
                        {branch.name}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {branch.optionValues.length} option
                        {branch.optionValues.length !== 1 ? "s" : ""}
                      </span>
                      <div className="flex-1" />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          setEditingBranchId(branch.id);
                          setEditBranchName(branch.name);
                        }}
                        aria-label="Rename branch"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => removeBranch(branch.id)}
                        aria-label="Remove branch"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add new branch */}
          <div className="flex items-center gap-2">
            <Input
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder="Branch name"
              className="h-7 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addBranch();
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs shrink-0"
              onClick={addBranch}
              disabled={!newBranchName.trim()}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add
            </Button>
          </div>

          {/* Option → Branch assignment */}
          {branches.length > 0 && (
            <>
              <Separator />
              <Label className="text-xs text-muted-foreground">
                Option Assignments
              </Label>
              <div className="space-y-2">
                {options.map((opt) => (
                  <div key={opt.value} className="flex items-center gap-2">
                    <span className="text-xs truncate flex-1 min-w-0">
                      {opt.label}
                    </span>
                    <Select
                      value={getBranchForOption(opt.value) ?? "__none__"}
                      onValueChange={(v) =>
                        assignOptionToBranch(
                          opt.value,
                          v === "__none__" ? null : v,
                        )
                      }
                    >
                      <SelectTrigger className="h-7 text-xs w-36">
                        <SelectValue placeholder="No branch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No branch</SelectItem>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
