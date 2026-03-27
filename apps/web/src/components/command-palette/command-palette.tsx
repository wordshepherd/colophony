"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@/hooks/use-organization";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { modifierKey } from "@/lib/platform";
import { navGroups, type NavItem } from "@/lib/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import { ShortcutOverlay } from "./shortcut-overlay";

interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(
  null,
);

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx)
    throw new Error(
      "useCommandPalette must be used within CommandPaletteProvider",
    );
  return ctx;
}

function roleCheck(
  role: "editor" | "admin" | null,
  isEditor: boolean,
  isAdmin: boolean,
): boolean {
  if (role === null) return true;
  if (role === "editor") return isEditor;
  if (role === "admin") return isAdmin;
  return false;
}

export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const router = useRouter();
  const { isEditor, isAdmin } = useOrganization();

  const mod = modifierKey();

  useShortcuts([
    {
      key: "k",
      modifiers: [mod],
      handler: () => setOpen((o) => !o),
      description: "Toggle command palette",
    },
    {
      key: "?",
      handler: () => setOverlayOpen(true),
      description: "Show keyboard shortcuts",
    },
  ]);

  const handleSelect = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  return (
    <CommandPaletteContext value={{ open, setOpen }}>
      {children}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Jump to..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {navGroups
            .filter((g) => roleCheck(g.role, isEditor, isAdmin))
            .map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.items.map((item: NavItem) => (
                  <CommandItem
                    key={item.href}
                    value={`${group.label} ${item.name}`}
                    onSelect={() => handleSelect(item.href)}
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          <CommandGroup heading="Actions">
            <CommandItem
              value="Show keyboard shortcuts"
              onSelect={() => {
                setOpen(false);
                setOverlayOpen(true);
              }}
            >
              Keyboard shortcuts
              <CommandShortcut>?</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
      <ShortcutOverlay open={overlayOpen} onOpenChange={setOverlayOpen} />
    </CommandPaletteContext>
  );
}
