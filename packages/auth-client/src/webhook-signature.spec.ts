import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyZitadelSignature } from "./webhook-signature.js";

const SECRET = "test-webhook-secret";
const BODY = '{"eventType":"user.created","eventId":"ev-1"}';

function sign(body: string, secret: string, format: "hex" | "base64"): string {
  return createHmac("sha256", secret).update(body).digest(format);
}

function signTimestamped(
  body: string,
  secret: string,
  timestamp: string,
): string {
  const hmac = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return `t=${timestamp},v1=${hmac}`;
}

describe("verifyZitadelSignature", () => {
  // Timestamp-prefixed format (Zitadel Actions v2)
  it("accepts valid timestamp-prefixed signature", () => {
    const sig = signTimestamped(BODY, SECRET, "1774150830");
    expect(verifyZitadelSignature(BODY, sig, SECRET)).toBe(true);
  });

  it("accepts timestamp-prefixed signature with Buffer body", () => {
    const sig = signTimestamped(BODY, SECRET, "1774150830");
    expect(verifyZitadelSignature(Buffer.from(BODY), sig, SECRET)).toBe(true);
  });

  it("rejects timestamp-prefixed signature with wrong secret", () => {
    const sig = signTimestamped(BODY, SECRET, "1774150830");
    expect(verifyZitadelSignature(BODY, sig, "wrong-secret")).toBe(false);
  });

  it("rejects timestamp-prefixed signature with tampered body", () => {
    const sig = signTimestamped(BODY, SECRET, "1774150830");
    expect(verifyZitadelSignature("tampered", sig, SECRET)).toBe(false);
  });

  // Simple format (legacy)
  it("accepts valid hex signature", () => {
    const sig = sign(BODY, SECRET, "hex");
    expect(verifyZitadelSignature(BODY, sig, SECRET)).toBe(true);
  });

  it("accepts valid base64 signature", () => {
    const sig = sign(BODY, SECRET, "base64");
    expect(verifyZitadelSignature(BODY, sig, SECRET)).toBe(true);
  });

  it("accepts sha256= prefixed hex signature", () => {
    const sig = "sha256=" + sign(BODY, SECRET, "hex");
    expect(verifyZitadelSignature(BODY, sig, SECRET)).toBe(true);
  });

  it("accepts sha256= prefixed base64 signature", () => {
    const sig = "sha256=" + sign(BODY, SECRET, "base64");
    expect(verifyZitadelSignature(BODY, sig, SECRET)).toBe(true);
  });

  it("accepts Buffer body", () => {
    const sig = sign(BODY, SECRET, "hex");
    expect(verifyZitadelSignature(Buffer.from(BODY), sig, SECRET)).toBe(true);
  });

  // Rejection cases
  it("rejects invalid signature", () => {
    expect(verifyZitadelSignature(BODY, "deadbeef", SECRET)).toBe(false);
  });

  it("rejects tampered body", () => {
    const sig = sign(BODY, SECRET, "hex");
    expect(verifyZitadelSignature("tampered", sig, SECRET)).toBe(false);
  });

  it("rejects wrong secret", () => {
    const sig = sign(BODY, SECRET, "hex");
    expect(verifyZitadelSignature(BODY, sig, "wrong-secret")).toBe(false);
  });

  it("returns false for undefined signature", () => {
    expect(verifyZitadelSignature(BODY, undefined, SECRET)).toBe(false);
  });

  it("returns false for empty string signature", () => {
    expect(verifyZitadelSignature(BODY, "", SECRET)).toBe(false);
  });

  it("returns false for empty secret", () => {
    const sig = sign(BODY, SECRET, "hex");
    expect(verifyZitadelSignature(BODY, sig, "")).toBe(false);
  });
});
