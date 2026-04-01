"use client";

import { useCallback, useSyncExternalStore } from "react";

export type ReadingTheme = "light" | "sepia" | "dark";

const STORAGE_KEY = "colophony-reading-theme";
const VALID_THEMES: ReadingTheme[] = ["light", "sepia", "dark"];

function isValidTheme(value: unknown): value is ReadingTheme {
  return (
    typeof value === "string" && VALID_THEMES.includes(value as ReadingTheme)
  );
}

// Listeners for store changes
const listeners = new Set<() => void>();
function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  // Also listen for cross-tab changes via storage event
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", handleStorage);
  };
}

function getSnapshot(): ReadingTheme {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isValidTheme(stored) ? stored : "light";
}

function getServerSnapshot(): ReadingTheme {
  return "light";
}

/**
 * Self-contained hook for reading theme preference.
 * Persisted to localStorage, independent of the app's light/dark theme.
 * No Provider needed — all consumers share the same localStorage key.
 */
export function useReadingTheme() {
  const readingTheme = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setReadingTheme = useCallback((theme: ReadingTheme) => {
    localStorage.setItem(STORAGE_KEY, theme);
    emitChange();
  }, []);

  return { readingTheme, setReadingTheme };
}
