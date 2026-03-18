import { vi } from "vitest";
vi.mock("@/lib/trpc", () => ({
  getAccessToken: vi.fn().mockResolvedValue(null),
  getCurrentOrgId: vi.fn().mockReturnValue(null),
  trpc: {
    useUtils: vi.fn().mockReturnValue({
      notifications: {
        unreadCount: { invalidate: vi.fn() },
        list: { invalidate: vi.fn() },
      },
    }),
  },
}));

vi.mock("@/hooks/use-organization", () => ({
  useOrganization: vi.fn().mockReturnValue({ currentOrg: null }),
}));

describe("useNotificationStream module", () => {
  it("exports useNotificationStream function", async () => {
    const mod = await import("../use-notification-stream");
    expect(mod.useNotificationStream).toBeInstanceOf(Function);
  });
});
