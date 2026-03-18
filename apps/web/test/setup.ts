import "./console-setup";
import "@testing-library/jest-dom/vitest";
import { vi, afterEach } from "vitest";
import React from "react";

// Mock next/navigation
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockBack = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    refresh: mockRefresh,
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/link
vi.mock("next/link", () => ({
  __esModule: true,
  default: (props: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href: props.href }, props.children),
}));

// Mock ResizeObserver (required by Radix UI components)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock window.matchMedia (required by shadcn/ui components)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock crypto.randomUUID with deterministic counter
let uuidCounter = 0;
Object.defineProperty(globalThis, "crypto", {
  value: {
    randomUUID: () => {
      const count = (++uuidCounter).toString(16).padStart(12, "0");
      return `00000000-0000-4000-8000-${count}`;
    },
  },
});

// Clear localStorage and reset mocks after each test
afterEach(() => {
  localStorage.clear();
  uuidCounter = 0;
  mockPush.mockClear();
  mockReplace.mockClear();
  mockBack.mockClear();
  mockRefresh.mockClear();
});

// Export mocks for use in tests
export { mockPush, mockReplace, mockBack, mockRefresh };
