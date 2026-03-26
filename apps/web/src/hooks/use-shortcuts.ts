"use client";

import { useEffect, useRef, useCallback } from "react";

export interface ShortcutBinding {
  /** Key value to match against event.key (e.g. "r", "Escape", "j") */
  key: string;
  /** Handler called when the shortcut fires */
  handler: () => void;
  /** Human-readable description for future shortcut overlay */
  description: string;
  /** Whether this binding is active (default true) */
  enabled?: boolean;
}

const IGNORED_ELEMENTS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * Shell-scoped keyboard shortcut hook.
 *
 * Registers document-level keydown listeners for the provided bindings.
 * Ignores events when focus is on input/textarea/select/contenteditable elements.
 * Bindings are stored in a ref to avoid re-registering on every render.
 */
export function useShortcuts(bindings: ShortcutBinding[]): void {
  const bindingsRef = useRef(bindings);

  useEffect(() => {
    bindingsRef.current = bindings;
  });

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Skip when typing in form elements
    const target = event.target;
    if (target instanceof HTMLElement) {
      if (
        IGNORED_ELEMENTS.has(target.tagName) ||
        target.isContentEditable ||
        target.contentEditable === "true"
      ) {
        return;
      }
    }

    // Ignore modified keypresses (Ctrl+R, Cmd+K, etc.)
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    for (const binding of bindingsRef.current) {
      if (binding.enabled === false) continue;
      if (event.key === binding.key) {
        event.preventDefault();
        binding.handler();
        return;
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
