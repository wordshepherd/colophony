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

// Mock crypto.randomUUID
Object.defineProperty(globalThis, "crypto", {
  value: {
    randomUUID: () => "test-uuid-" + Math.random().toString(36).substr(2, 9),
  },
});

// Clear localStorage after each test
afterEach(() => {
  localStorage.clear();
  mockPush.mockClear();
  mockReplace.mockClear();
  mockBack.mockClear();
  mockRefresh.mockClear();
});

// Export mocks for use in tests
export { mockPush, mockReplace, mockBack, mockRefresh };
