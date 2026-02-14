import { describe, it, expect } from "vitest";
import {
  zitadelWebhookPayloadSchema,
  zitadelWebhookUserSchema,
} from "./types.js";

describe("zitadelWebhookPayloadSchema", () => {
  const validPayload = {
    eventType: "user.created",
    eventId: "evt-001",
    creationDate: "2026-01-01T00:00:00Z",
    user: { userId: "u-1", email: "a@b.com" },
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

  it("rejects missing eventId", () => {
    const { eventId: _, ...rest } = validPayload;
    expect(zitadelWebhookPayloadSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects empty eventId", () => {
    expect(
      zitadelWebhookPayloadSchema.safeParse({
        ...validPayload,
        eventId: "",
      }).success,
    ).toBe(false);
  });

  it("rejects empty eventType", () => {
    expect(
      zitadelWebhookPayloadSchema.safeParse({
        ...validPayload,
        eventType: "",
      }).success,
    ).toBe(false);
  });

  it("rejects empty creationDate", () => {
    expect(
      zitadelWebhookPayloadSchema.safeParse({
        ...validPayload,
        creationDate: "",
      }).success,
    ).toBe(false);
  });

  it("accepts unknown eventType strings", () => {
    const result = zitadelWebhookPayloadSchema.safeParse({
      ...validPayload,
      eventType: "org.created",
    });
    expect(result.success).toBe(true);
  });

  it("accepts payload without user field", () => {
    const { user: _, ...rest } = validPayload;
    expect(zitadelWebhookPayloadSchema.safeParse(rest).success).toBe(true);
  });

  it("accepts user object without userId (lenient ingress)", () => {
    const result = zitadelWebhookPayloadSchema.safeParse({
      ...validPayload,
      user: { email: "a@b.com" },
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
