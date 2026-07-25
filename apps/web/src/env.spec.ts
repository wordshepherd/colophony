/**
 * @vitest-environment node
 *
 * The web suite defaults to jsdom, where `window` is always defined — which would
 * make getServerEnv()'s browser guard fire in every case. This module is
 * server-side configuration, so it is tested under node and the browser guard is
 * exercised explicitly by stubbing `window`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * env.ts parses at module load, so every case must re-import it with a fresh
 * module registry after mutating process.env. vi.resetModules() before each
 * dynamic import is what makes that work.
 */

const ORIGINAL_ENV = { ...process.env };

function setEnv(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
}

async function loadEnv() {
  vi.resetModules();
  return import("./env");
}

beforeEach(() => {
  // Start from a clean slate so a stray value in the ambient environment cannot
  // make a negative case pass.
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("NEXT_PUBLIC_") || key.startsWith("SENTRY_")) {
      delete process.env[key];
    }
  }
  delete process.env.API_URL;
  delete process.env.SKIP_ENV_VALIDATION;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("clientEnv", () => {
  it("parses a fully specified client environment", async () => {
    setEnv({
      NEXT_PUBLIC_API_URL: "https://api.example.com",
      NEXT_PUBLIC_APP_URL: "https://app.example.com",
      NEXT_PUBLIC_TUS_URL: "https://tus.example.com/files/",
      NEXT_PUBLIC_ZITADEL_AUTHORITY: "https://auth.example.com",
      NEXT_PUBLIC_ZITADEL_CLIENT_ID: "client-123",
      NEXT_PUBLIC_SENTRY_ENVIRONMENT: "staging",
      NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: "0.5",
    });

    const { clientEnv } = await loadEnv();

    expect(clientEnv.NEXT_PUBLIC_API_URL).toBe("https://api.example.com");
    expect(clientEnv.NEXT_PUBLIC_ZITADEL_CLIENT_ID).toBe("client-123");
    expect(clientEnv.NEXT_PUBLIC_SENTRY_ENVIRONMENT).toBe("staging");
  });

  it("coerces the traces sample rate from string to number", async () => {
    setEnv({ NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: "0.25" });

    const { clientEnv } = await loadEnv();

    expect(clientEnv.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE).toBe(0.25);
    expect(typeof clientEnv.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE).toBe(
      "number",
    );
  });

  it("applies defaults when optional values are unset", async () => {
    const { clientEnv } = await loadEnv();

    expect(clientEnv.NEXT_PUBLIC_API_URL).toBe("http://localhost:4000");
    expect(clientEnv.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    expect(clientEnv.NEXT_PUBLIC_TUS_URL).toBe("http://localhost:1080/files/");
    expect(clientEnv.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE).toBe(0);
  });

  it("throws on a malformed NEXT_PUBLIC_API_URL", async () => {
    setEnv({ NEXT_PUBLIC_API_URL: "not-a-url" });

    await expect(loadEnv()).rejects.toThrow(/NEXT_PUBLIC_API_URL/);
  });

  it("rejects a traces sample rate above 1", async () => {
    setEnv({ NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: "5" });

    await expect(loadEnv()).rejects.toThrow(
      /NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE/,
    );
  });

  it("skips validation when SKIP_ENV_VALIDATION is set", async () => {
    setEnv({
      SKIP_ENV_VALIDATION: "1",
      NEXT_PUBLIC_API_URL: "not-a-url",
    });

    const { clientEnv } = await loadEnv();

    expect(clientEnv.NEXT_PUBLIC_API_URL).toBe("not-a-url");
  });
});

describe("getServerEnv", () => {
  it("applies the API_URL default when unset", async () => {
    const { getServerEnv } = await loadEnv();

    expect(getServerEnv().API_URL).toBe("http://localhost:4000");
  });

  it("reads server-only Sentry values", async () => {
    setEnv({
      SENTRY_DSN: "https://abc@sentry.example.com/1",
      SENTRY_ENVIRONMENT: "production",
      SENTRY_TRACES_SAMPLE_RATE: "0.1",
      SENTRY_ORG: "colophony",
    });

    const { getServerEnv } = await loadEnv();
    const env = getServerEnv();

    expect(env.SENTRY_ENVIRONMENT).toBe("production");
    expect(env.SENTRY_TRACES_SAMPLE_RATE).toBe(0.1);
    expect(env.SENTRY_ORG).toBe("colophony");
  });

  it("throws on a malformed API_URL", async () => {
    setEnv({ API_URL: "://broken" });

    const { getServerEnv } = await loadEnv();

    expect(() => getServerEnv()).toThrow(/API_URL/);
  });

  it("throws if called in a browser context", async () => {
    const { getServerEnv } = await loadEnv();
    vi.stubGlobal("window", {});

    try {
      expect(() => getServerEnv()).toThrow(/called in the browser/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
