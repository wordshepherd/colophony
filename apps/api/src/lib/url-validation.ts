import dns from 'node:dns';

/**
 * SSRF validation utilities for outbound HTTP calls to user-controlled URLs.
 *
 * Extracted from trust.service.ts for reuse across webhooks, federation, and
 * any future outbound call site. Validates that resolved IP addresses are not
 * in private/reserved ranges.
 */

export class SsrfValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfValidationError';
  }
}

export function isPrivateIPv4(addr: string): boolean {
  const parts = addr.split('.').map(Number);
  if (parts.length !== 4) return false;
  const [a, b] = parts;

  return (
    a === 10 || // 10.0.0.0/8
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) || // 192.168.0.0/16
    a === 127 || // 127.0.0.0/8
    (a === 169 && b === 254) || // 169.254.0.0/16
    a === 0 // 0.0.0.0/8
  );
}

export function isPrivateIPv6(addr: string): boolean {
  const normalized = addr.toLowerCase();
  if (normalized === '::1') return true; // loopback

  // ULA fc00::/7 — fc00::–fdff::
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  // Link-local fe80::/10 — fe80::–febf::
  // First 10 bits are 1111 1110 10, so second hex digit ranges 8–b
  if (normalized.length >= 4 && normalized.startsWith('fe')) {
    const thirdChar = normalized[2];
    if (thirdChar >= '8' && thirdChar <= 'b') return true;
  }

  return false;
}

/**
 * Resolve a hostname and check that none of the resolved addresses are
 * in private/reserved IP ranges.
 *
 * @throws SsrfValidationError if any resolved address is private
 */
export async function resolveAndCheckPrivateIp(
  hostname: string,
): Promise<void> {
  // Strip port from hostname before DNS resolution
  const bareHost = hostname.replace(/:\d+$/, '');

  // Block IP literals directly — DNS resolution may fail for these,
  // bypassing the private address check entirely
  if (isPrivateIPv4(bareHost)) {
    throw new SsrfValidationError(
      `IP literal resolves to private IPv4 address: ${bareHost}`,
    );
  }
  if (isPrivateIPv6(bareHost) || bareHost === '::1') {
    throw new SsrfValidationError(
      `IP literal resolves to private IPv6 address: ${bareHost}`,
    );
  }

  // Resolve both IPv4 and IPv6
  const [ipv4Addrs, ipv6Addrs] = await Promise.all([
    dns.promises.resolve4(bareHost).catch(() => [] as string[]),
    dns.promises.resolve6(bareHost).catch(() => [] as string[]),
  ]);

  for (const addr of ipv4Addrs) {
    if (isPrivateIPv4(addr)) {
      throw new SsrfValidationError(
        `Resolved to private IPv4 address: ${addr}`,
      );
    }
  }

  for (const addr of ipv6Addrs) {
    if (isPrivateIPv6(addr)) {
      throw new SsrfValidationError(
        `Resolved to private IPv6 address: ${addr}`,
      );
    }
  }
}

/**
 * Validate a URL for outbound HTTP calls. Ensures:
 * 1. URL is well-formed
 * 2. HTTPS is required (unless devMode)
 * 3. Hostname does not resolve to private/reserved IPs
 *
 * @param url - The outbound URL to validate
 * @param opts.devMode - When true, allows HTTP and skips private IP checks
 * @throws SsrfValidationError if the URL fails validation
 */
export async function validateOutboundUrl(
  url: string,
  opts?: { devMode?: boolean },
): Promise<void> {
  const devMode = opts?.devMode ?? false;

  // Skip all checks in dev mode
  if (devMode) return;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SsrfValidationError(`Invalid URL: ${url}`);
  }

  // Require HTTPS in production
  if (parsed.protocol !== 'https:') {
    throw new SsrfValidationError(
      `HTTPS required for outbound URLs, got ${parsed.protocol}`,
    );
  }

  // Check IP literals directly (hostname without brackets for IPv6)
  const hostname = parsed.hostname.replace(/^\[/, '').replace(/]$/, '');
  if (isPrivateIPv4(hostname) || isPrivateIPv6(hostname)) {
    throw new SsrfValidationError(
      `URL resolves to private IP address: ${hostname}`,
    );
  }

  // DNS resolve + check
  await resolveAndCheckPrivateIp(hostname);
}
