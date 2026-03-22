import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Parses a signature string that may be:
 * - hex-encoded
 * - base64-encoded
 * - prefixed with `sha256=`
 */
function parseSignature(sig: string): Buffer {
  const s = sig.startsWith("sha256=") ? sig.slice(7) : sig;
  if (/^[a-f0-9]+$/i.test(s)) return Buffer.from(s, "hex");
  return Buffer.from(s, "base64");
}

/**
 * Parses Zitadel's timestamp-prefixed signature format: `t=<timestamp>,v1=<hex-hmac>`.
 * Returns the timestamp and hex signature, or null if format doesn't match.
 */
function parseTimestampSignature(
  sig: string,
): { timestamp: string; hmac: string } | null {
  const match = sig.match(/^t=(\d+),v1=([a-f0-9]+)$/i);
  if (!match) return null;
  return { timestamp: match[1], hmac: match[2] };
}

/**
 * Verifies a Zitadel webhook signature using HMAC-SHA256.
 *
 * Supports two formats:
 * 1. Timestamp-prefixed (Zitadel Actions v2): `t=<timestamp>,v1=<hex-hmac>`
 *    HMAC is computed over `<timestamp>.<body>`
 * 2. Simple: hex, base64, or `sha256=`-prefixed HMAC of body
 *
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyZitadelSignature(
  rawBody: Buffer | string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature || !secret) return false;

  // Try timestamp-prefixed format first (Zitadel Actions v2)
  const tsSig = parseTimestampSignature(signature);
  if (tsSig) {
    const received = Buffer.from(tsSig.hmac, "hex");
    const payload = `${tsSig.timestamp}.${typeof rawBody === "string" ? rawBody : rawBody.toString("utf8")}`;
    const expected = createHmac("sha256", secret).update(payload).digest();
    if (received.length !== expected.length) return false;
    return timingSafeEqual(received, expected);
  }

  // Fallback: simple HMAC of body
  const received = parseSignature(signature);
  const expected = createHmac("sha256", secret).update(rawBody).digest();

  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}
