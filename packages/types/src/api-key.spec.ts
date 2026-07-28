import { describe, it, expect } from "vitest";
import {
  apiKeyScopeSchema,
  createApiKeySchema,
  apiKeyResponseSchema,
} from "./api-key.js";

describe("apiKeyScopeSchema", () => {
  it("rejects the retired payments:read scope", () => {
    expect(apiKeyScopeSchema.safeParse("payments:read").success).toBe(false);
  });

  it("still accepts the payment-transactions scopes", () => {
    // These are the scopes payment guards actually use. `payments:read` was a
    // separate, unenforced name — deleting the wrong line would show up here.
    expect(
      apiKeyScopeSchema.safeParse("payment-transactions:read").success,
    ).toBe(true);
    expect(
      apiKeyScopeSchema.safeParse("payment-transactions:write").success,
    ).toBe(true);
  });
});

describe("createApiKeySchema", () => {
  it("rejects a request asking for payments:read", () => {
    const result = createApiKeySchema.safeParse({
      name: "Reporting key",
      scopes: ["payments:read"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a request asking for a live scope", () => {
    const result = createApiKeySchema.safeParse({
      name: "Reporting key",
      scopes: ["payment-transactions:read"],
    });
    expect(result.success).toBe(true);
  });
});

describe("apiKeyResponseSchema", () => {
  const storedKey = {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Seed Read-Only Key",
    scopes: ["submissions:read"],
    keyPrefix: "col_live_000",
    createdAt: new Date(),
    expiresAt: null,
    lastUsedAt: null,
    revokedAt: null,
  };

  it("tolerates a stored scope the enum no longer declares", () => {
    // This field is read back from the JSONB column. Validating it against the
    // enum would turn a key granted a since-retired scope into a 500 on
    // `apiKeys.list` rather than a listing — which is exactly why removing a
    // scope needs a data migration, not just an enum edit.
    const result = apiKeyResponseSchema.safeParse({
      ...storedKey,
      scopes: ["submissions:read", "payments:read"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a key with no scopes left", () => {
    const result = apiKeyResponseSchema.safeParse({ ...storedKey, scopes: [] });
    expect(result.success).toBe(true);
  });
});
