import {
  cmsAdapterConfig,
  getAdapterLabel,
  getAdapterConfigFields,
  maskConfigValue,
} from "@/lib/cms-utils";

describe("cmsAdapterConfig", () => {
  it("has WORDPRESS and GHOST entries", () => {
    expect(cmsAdapterConfig).toHaveProperty("WORDPRESS");
    expect(cmsAdapterConfig).toHaveProperty("GHOST");
  });

  it("WORDPRESS has 3 config fields", () => {
    expect(cmsAdapterConfig.WORDPRESS.configFields).toHaveLength(3);
    const keys = cmsAdapterConfig.WORDPRESS.configFields.map((f) => f.key);
    expect(keys).toEqual(["siteUrl", "username", "applicationPassword"]);
  });

  it("GHOST has 2 config fields", () => {
    expect(cmsAdapterConfig.GHOST.configFields).toHaveLength(2);
    const keys = cmsAdapterConfig.GHOST.configFields.map((f) => f.key);
    expect(keys).toEqual(["apiUrl", "adminApiKey"]);
  });

  it("all fields have label and placeholder", () => {
    for (const adapter of Object.values(cmsAdapterConfig)) {
      for (const field of adapter.configFields) {
        expect(field.label).toBeTruthy();
        expect(field.placeholder).toBeTruthy();
      }
    }
  });
});

describe("getAdapterLabel", () => {
  it("returns WordPress for WORDPRESS", () => {
    expect(getAdapterLabel("WORDPRESS")).toBe("WordPress");
  });

  it("returns Ghost for GHOST", () => {
    expect(getAdapterLabel("GHOST")).toBe("Ghost");
  });
});

describe("getAdapterConfigFields", () => {
  it("returns config fields for WORDPRESS", () => {
    const fields = getAdapterConfigFields("WORDPRESS");
    expect(fields).toHaveLength(3);
    expect(fields[0].key).toBe("siteUrl");
  });

  it("returns config fields for GHOST", () => {
    const fields = getAdapterConfigFields("GHOST");
    expect(fields).toHaveLength(2);
    expect(fields[0].key).toBe("apiUrl");
  });
});

describe("maskConfigValue", () => {
  it("masks password fields showing last 4 chars", () => {
    expect(maskConfigValue("supersecretpassword", "password")).toBe("••••word");
  });

  it("returns full value for non-password fields", () => {
    expect(maskConfigValue("https://example.com", "url")).toBe(
      "https://example.com",
    );
    expect(maskConfigValue("admin", "text")).toBe("admin");
  });

  it("handles short password values", () => {
    expect(maskConfigValue("abc", "password")).toBe("••••");
    expect(maskConfigValue("abcd", "password")).toBe("••••");
  });

  it("handles empty/null values", () => {
    expect(maskConfigValue("", "password")).toBe("••••");
    expect(maskConfigValue(null, "password")).toBe("••••");
    expect(maskConfigValue(undefined, "password")).toBe("••••");
  });
});
