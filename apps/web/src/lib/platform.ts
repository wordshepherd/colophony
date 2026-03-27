/** Returns true when running on a Mac/iOS platform */
export function isMac(): boolean {
  return (
    typeof navigator !== "undefined" &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  );
}

/** Returns the platform-appropriate modifier key for keyboard shortcuts */
export function modifierKey(): "meta" | "ctrl" {
  return isMac() ? "meta" : "ctrl";
}

/** Returns the display symbol for the platform modifier key */
export function modifierSymbol(): string {
  return isMac() ? "⌘" : "Ctrl";
}
