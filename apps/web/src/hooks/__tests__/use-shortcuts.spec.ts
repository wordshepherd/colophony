import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useShortcuts } from "../use-shortcuts";
import type { ShortcutBinding } from "../use-shortcuts";

function fireKey(
  key: string,
  target?: HTMLElement,
  mods?: {
    metaKey?: boolean;
    ctrlKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
  },
) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    metaKey: mods?.metaKey ?? false,
    ctrlKey: mods?.ctrlKey ?? false,
    altKey: mods?.altKey ?? false,
    shiftKey: mods?.shiftKey ?? false,
  });
  if (target) {
    target.dispatchEvent(event);
  } else {
    document.dispatchEvent(event);
  }
}

describe("useShortcuts", () => {
  it("fires handler on matching key press", () => {
    const handler = vi.fn();
    const bindings: ShortcutBinding[] = [
      { key: "r", handler, description: "test" },
    ];

    renderHook(() => useShortcuts(bindings));
    fireKey("r");

    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not fire handler for non-matching key", () => {
    const handler = vi.fn();
    const bindings: ShortcutBinding[] = [
      { key: "r", handler, description: "test" },
    ];

    renderHook(() => useShortcuts(bindings));
    fireKey("j");

    expect(handler).not.toHaveBeenCalled();
  });

  it("does NOT fire when target is an input element", () => {
    const handler = vi.fn();
    const bindings: ShortcutBinding[] = [
      { key: "r", handler, description: "test" },
    ];

    renderHook(() => useShortcuts(bindings));

    const input = document.createElement("input");
    document.body.appendChild(input);
    fireKey("r", input);
    document.body.removeChild(input);

    expect(handler).not.toHaveBeenCalled();
  });

  it("does NOT fire when target is a textarea element", () => {
    const handler = vi.fn();
    const bindings: ShortcutBinding[] = [
      { key: "r", handler, description: "test" },
    ];

    renderHook(() => useShortcuts(bindings));

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    fireKey("r", textarea);
    document.body.removeChild(textarea);

    expect(handler).not.toHaveBeenCalled();
  });

  it("does NOT fire when target is contenteditable", () => {
    const handler = vi.fn();
    const bindings: ShortcutBinding[] = [
      { key: "r", handler, description: "test" },
    ];

    renderHook(() => useShortcuts(bindings));

    const div = document.createElement("div");
    div.contentEditable = "true";
    document.body.appendChild(div);
    fireKey("r", div);
    document.body.removeChild(div);

    expect(handler).not.toHaveBeenCalled();
  });

  it("cleans up listeners on unmount", () => {
    const handler = vi.fn();
    const bindings: ShortcutBinding[] = [
      { key: "r", handler, description: "test" },
    ];

    const { unmount } = renderHook(() => useShortcuts(bindings));
    unmount();

    fireKey("r");
    expect(handler).not.toHaveBeenCalled();
  });

  it("respects enabled: false on individual bindings", () => {
    const handler = vi.fn();
    const bindings: ShortcutBinding[] = [
      { key: "r", handler, description: "test", enabled: false },
    ];

    renderHook(() => useShortcuts(bindings));
    fireKey("r");

    expect(handler).not.toHaveBeenCalled();
  });

  it("handles multiple bindings, only fires matching one", () => {
    const handlerR = vi.fn();
    const handlerJ = vi.fn();
    const bindings: ShortcutBinding[] = [
      { key: "r", handler: handlerR, description: "read" },
      { key: "j", handler: handlerJ, description: "next" },
    ];

    renderHook(() => useShortcuts(bindings));
    fireKey("j");

    expect(handlerR).not.toHaveBeenCalled();
    expect(handlerJ).toHaveBeenCalledOnce();
  });

  it("handles Escape key", () => {
    const handler = vi.fn();
    const bindings: ShortcutBinding[] = [
      { key: "Escape", handler, description: "exit" },
    ];

    renderHook(() => useShortcuts(bindings));
    fireKey("Escape");

    expect(handler).toHaveBeenCalledOnce();
  });

  describe("modifier keys", () => {
    it("fires binding with matching modifier", () => {
      const handler = vi.fn();
      const bindings: ShortcutBinding[] = [
        { key: "k", modifiers: ["meta"], handler, description: "palette" },
      ];

      renderHook(() => useShortcuts(bindings));
      fireKey("k", undefined, { metaKey: true });

      expect(handler).toHaveBeenCalledOnce();
    });

    it("does NOT fire when wrong modifier is pressed", () => {
      const handler = vi.fn();
      const bindings: ShortcutBinding[] = [
        { key: "k", modifiers: ["meta"], handler, description: "palette" },
      ];

      renderHook(() => useShortcuts(bindings));
      fireKey("k", undefined, { ctrlKey: true });

      expect(handler).not.toHaveBeenCalled();
    });

    it("does NOT fire unmodified binding when a modifier is pressed", () => {
      const handler = vi.fn();
      const bindings: ShortcutBinding[] = [
        { key: "j", handler, description: "next" },
      ];

      renderHook(() => useShortcuts(bindings));
      fireKey("j", undefined, { metaKey: true });

      expect(handler).not.toHaveBeenCalled();
    });

    it("matches multiple modifiers", () => {
      const handler = vi.fn();
      const bindings: ShortcutBinding[] = [
        {
          key: "s",
          modifiers: ["meta", "shift"],
          handler,
          description: "save all",
        },
      ];

      renderHook(() => useShortcuts(bindings));
      fireKey("s", undefined, { metaKey: true, shiftKey: true });

      expect(handler).toHaveBeenCalledOnce();
    });

    it("allows shift for unmodified bindings (? = Shift+/)", () => {
      const handler = vi.fn();
      const bindings: ShortcutBinding[] = [
        { key: "?", handler, description: "help" },
      ];

      renderHook(() => useShortcuts(bindings));
      fireKey("?", undefined, { shiftKey: true });

      expect(handler).toHaveBeenCalledOnce();
    });

    it("blocks extra shift on modifier bindings", () => {
      const handler = vi.fn();
      const bindings: ShortcutBinding[] = [
        { key: "k", modifiers: ["meta"], handler, description: "palette" },
      ];

      renderHook(() => useShortcuts(bindings));
      fireKey("k", undefined, { metaKey: true, shiftKey: true });

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
