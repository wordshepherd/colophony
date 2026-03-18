import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";

describe("buildSslConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    delete process.env.DB_SSL;
    delete process.env.DB_SSL_CA_PATH;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  async function loadBuildSslConfig() {
    const mod = await import("../ssl.js");
    return mod.buildSslConfig;
  }

  it("returns undefined when DB_SSL=false", async () => {
    process.env.DB_SSL = "false";
    const buildSslConfig = await loadBuildSslConfig();
    expect(buildSslConfig()).toBeUndefined();
  });

  it("returns undefined when DB_SSL is unset", async () => {
    const buildSslConfig = await loadBuildSslConfig();
    expect(buildSslConfig()).toBeUndefined();
  });

  it("returns rejectUnauthorized:false for no-verify", async () => {
    process.env.DB_SSL = "no-verify";
    const buildSslConfig = await loadBuildSslConfig();
    expect(buildSslConfig()).toEqual({ rejectUnauthorized: false });
  });

  it("returns rejectUnauthorized:true when DB_SSL=true, no CA", async () => {
    process.env.DB_SSL = "true";
    const buildSslConfig = await loadBuildSslConfig();
    expect(buildSslConfig()).toEqual({ rejectUnauthorized: true });
  });

  it("reads CA file when DB_SSL=true + CA path", async () => {
    process.env.DB_SSL = "true";
    process.env.DB_SSL_CA_PATH = "/path/to/ca.pem";
    vi.spyOn(fs, "readFileSync").mockReturnValue("-----BEGIN CERTIFICATE-----");
    const buildSslConfig = await loadBuildSslConfig();
    expect(buildSslConfig()).toEqual({
      rejectUnauthorized: true,
      ca: "-----BEGIN CERTIFICATE-----",
    });
    expect(fs.readFileSync).toHaveBeenCalledWith("/path/to/ca.pem", "utf8");
  });
});
