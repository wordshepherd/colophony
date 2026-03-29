"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
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
  role: "editor" | "production" | "business_ops" | "admin" | null,
  isEditor: boolean,
  isProduction: boolean,
  isBusinessOps: boolean,
  isAdmin: boolean,
): boolean {
  if (role === null) return true;
  if (role === "editor") return isEditor;
  if (role === "production") return isProduction;
  if (role === "business_ops") return isBusinessOps;
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
  const { isEditor, isProduction, isBusinessOps, isAdmin } = useOrganization();

  const mod = modifierKey();

  // useShortcuts opens the palette (ignored when focus is on INPUT elements).
  // A separate document-level listener handles Cmd/Ctrl+K while the palette
  // is open (cmdk autofocuses its <input>, which useShortcuts skips).
  useShortcuts([
    {
      key: "k",
      modifiers: [mod],
      handler: () => setOpen(true),
      description: "Open command palette",
    },
    {
      key: "?",
      handler: () => setOverlayOpen(true),
      description: "Show keyboard shortcuts",
    },
  ]);

  useEffect(() => {
    if (!open) return;
    const modKey = mod === "meta" ? "metaKey" : "ctrlKey";
    const handleClose = (e: KeyboardEvent) => {
      if (e.key === "k" && e[modKey]) {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleClose);
    return () => document.removeEventListener("keydown", handleClose);
  }, [open, mod]);

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
            .filter((g) =>
              roleCheck(g.role, isEditor, isProduction, isBusinessOps, isAdmin),
            )
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
