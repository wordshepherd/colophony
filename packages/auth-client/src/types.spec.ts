import { describe, it, expect } from "vitest";
import {
  zitadelWebhookPayloadSchema,
  zitadelEventPayloadSchema,
  zitadelWebhookUserSchema,
} from "./types.js";

describe("zitadelWebhookPayloadSchema", () => {
  const validPayload = {
    aggregateID: "agg-001",
    aggregateType: "user",
    resourceOwner: "org-1",
    instanceID: "inst-1",
    version: "v2",
    sequence: 1,
    event_type: "user.human.added",
    created_at: "2026-01-01T00:00:00Z",
    userID: "system-user",
    event_payload: { userName: "alice", email: "a@b.com" },
  };

  it("accepts a valid payload", () => {
    const result = zitadelWebhookPayloadSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("preserves unknown root fields (.passthrough)", () => {
    const result = zitadelWebhookPayloadSchema.safeParse({
      ...validPayload,
      customField: "extra",
      nested: { a: 1 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customField).toBe("extra");
      expect(result.data.nested).toEqual({ a: 1 });
    }
  });

  it("rejects missing aggregateID", () => {
    const { aggregateID: _, ...rest } = validPayload;
    expect(zitadelWebhookPayloadSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects empty aggregateID", () => {
    expect(
      zitadelWebhookPayloadSchema.safeParse({
        ...validPayload,
        aggregateID: "",
      }).success,
    ).toBe(false);
  });

  it("rejects empty event_type", () => {
    expect(
      zitadelWebhookPayloadSchema.safeParse({
        ...validPayload,
        event_type: "",
      }).success,
    ).toBe(false);
  });

  it("rejects empty created_at", () => {
    expect(
      zitadelWebhookPayloadSchema.safeParse({
        ...validPayload,
        created_at: "",
      }).success,
    ).toBe(false);
  });

  it("accepts unknown event_type strings", () => {
    const result = zitadelWebhookPayloadSchema.safeParse({
      ...validPayload,
      event_type: "org.created",
    });
    expect(result.success).toBe(true);
  });

  it("accepts payload without event_payload field", () => {
    const { event_payload: _, ...rest } = validPayload;
    expect(zitadelWebhookPayloadSchema.safeParse(rest).success).toBe(true);
  });

  it("accepts event_payload without email (lenient ingress)", () => {
    const result = zitadelWebhookPayloadSchema.safeParse({
      ...validPayload,
      event_payload: { userName: "alice" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-object inputs", () => {
    expect(zitadelWebhookPayloadSchema.safeParse([]).success).toBe(false);
    expect(zitadelWebhookPayloadSchema.safeParse("str").success).toBe(false);
    expect(zitadelWebhookPayloadSchema.safeParse(123).success).toBe(false);
    expect(zitadelWebhookPayloadSchema.safeParse(null).success).toBe(false);
  });
});

describe("zitadelEventPayloadSchema", () => {
  it("preserves unknown fields (.passthrough)", () => {
    const result = zitadelEventPayloadSchema.safeParse({
      userName: "alice",
      unknownField: "keep-me",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.unknownField).toBe("keep-me");
    }
  });

  it("accepts empty object (all fields optional)", () => {
    expect(zitadelEventPayloadSchema.safeParse({}).success).toBe(true);
  });
});

// Legacy schema — kept for backwards compatibility
describe("zitadelWebhookUserSchema", () => {
  it("preserves unknown user fields (.passthrough)", () => {
    const result = zitadelWebhookUserSchema.safeParse({
      userId: "u-1",
      unknownField: "keep-me",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.unknownField).toBe("keep-me");
    }
  });

  it("accepts empty object (all fields optional)", () => {
    expect(zitadelWebhookUserSchema.safeParse({}).success).toBe(true);
  });
});
