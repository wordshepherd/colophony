import "./console-setup";
import "@testing-library/jest-dom";
import React from "react";

jest.setTimeout(15000);

// Mock next/navigation
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockRefresh = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    refresh: mockRefresh,
    prefetch: jest.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/link
jest.mock("next/link", () => ({
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
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
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
