jest.mock("@/lib/trpc", () => ({
  getAccessToken: jest.fn().mockResolvedValue(null),
  getCurrentOrgId: jest.fn().mockReturnValue(null),
  trpc: {
    useUtils: jest.fn().mockReturnValue({
      notifications: {
        unreadCount: { invalidate: jest.fn() },
        list: { invalidate: jest.fn() },
      },
    }),
  },
}));

jest.mock("@/hooks/use-organization", () => ({
  useOrganization: jest.fn().mockReturnValue({ currentOrg: null }),
}));

describe("useNotificationStream module", () => {
  it("exports useNotificationStream function", async () => {
    const mod = await import("../use-notification-stream");
    expect(mod.useNotificationStream).toBeInstanceOf(Function);
  });
});
