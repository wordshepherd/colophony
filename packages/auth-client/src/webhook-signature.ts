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
 * Verifies a Zitadel webhook signature using HMAC-SHA256.
 *
 * Handles hex, base64, and `sha256=`-prefixed signature formats.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyZitadelSignature(
  rawBody: Buffer | string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature || !secret) return false;

  const received = parseSignature(signature);
  const expected = createHmac("sha256", secret).update(rawBody).digest();

  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}
