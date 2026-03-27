"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { modifierSymbol } from "@/lib/platform";

interface ShortcutOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutEntry {
  keys: string;
  description: string;
}

function getGlobalShortcuts(): ShortcutEntry[] {
  const mod = modifierSymbol();
  return [
    { keys: `${mod}+K`, description: "Open command palette" },
    { keys: "?", description: "Show keyboard shortcuts" },
  ];
}

const editorialShortcuts: ShortcutEntry[] = [
  { keys: "j", description: "Next submission" },
  { keys: "k", description: "Previous submission" },
  { keys: "r", description: "Enter deep-read mode" },
  { keys: "Esc", description: "Return to triage" },
];

function ShortcutGroup({
  heading,
  shortcuts,
}: {
  heading: string;
  shortcuts: ShortcutEntry[];
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-foreground">{heading}</h3>
      <div className="space-y-1.5">
        {shortcuts.map((s) => (
          <div
            key={s.keys}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-muted-foreground">{s.description}</span>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              {s.keys}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ShortcutOverlay({ open, onOpenChange }: ShortcutOverlayProps) {
  const globalShortcuts = getGlobalShortcuts();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-2">
          <ShortcutGroup heading="Global" shortcuts={globalShortcuts} />
          <ShortcutGroup
            heading="Editorial (Reading Queue)"
            shortcuts={editorialShortcuts}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
