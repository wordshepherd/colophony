import {
  STORAGE_KEYS,
  getCurrentOrgId,
  setCurrentOrgId,
  getTrpcClient,
} from "../trpc";

describe("trpc utilities", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("STORAGE_KEYS", () => {
    it("should have correct key values", () => {
      expect(STORAGE_KEYS.CURRENT_ORG_ID).toBe("currentOrgId");
    });
  });

  describe("getCurrentOrgId", () => {
    it("should return org ID when stored", () => {
      localStorage.setItem("currentOrgId", "org-123");
      expect(getCurrentOrgId()).toBe("org-123");
    });

    it("should return null when no org ID", () => {
      expect(getCurrentOrgId()).toBeNull();
    });
  });

  describe("setCurrentOrgId", () => {
    it("should store org ID", () => {
      setCurrentOrgId("org-abc");
      expect(localStorage.getItem("currentOrgId")).toBe("org-abc");
    });

    it("should remove org ID when null", () => {
      localStorage.setItem("currentOrgId", "org-abc");
      setCurrentOrgId(null);
      expect(localStorage.getItem("currentOrgId")).toBeNull();
    });
  });

  describe("getTrpcClient", () => {
    it("should return a tRPC client object", () => {
      const client = getTrpcClient();
      expect(client).toBeDefined();
    });
  });
});
