import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SignOptions {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string | Buffer;
  privateKey: string;
  keyId: string;
}

export interface SignResult {
  headers: Record<string, string>;
}

export interface VerifyOptions {
  maxAge?: number;
  keyLookup: (keyId: string) => Promise<string | null>;
}

export interface VerifyInput {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string | Buffer;
}

export interface VerifyResult {
  valid: boolean;
  keyId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALGORITHM = 'ed25519';
const DEFAULT_MAX_AGE = 300; // 5 minutes

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute Content-Digest header value per RFC 9530.
 * Format: sha-256=:<base64>:
 */
function computeContentDigest(body: string | Buffer): string {
  const hash = crypto.createHash('sha256').update(body).digest('base64');
  return `sha-256=:${hash}:`;
}

/**
 * Build the signature base string per RFC 9421.
 * Covered components: @method, @target-uri, content-digest (if body), date
 */
function buildSignatureBase(
  method: string,
  url: string,
  headers: Record<string, string>,
  hasBody: boolean,
): { base: string; coveredComponents: string[] } {
  const components: string[] = ['@method', '@target-uri'];
  if (hasBody) {
    components.push('content-digest');
  }
  components.push('date');

  const lines: string[] = [];

  for (const component of components) {
    if (component === '@method') {
      lines.push(`"@method": ${method.toUpperCase()}`);
    } else if (component === '@target-uri') {
      lines.push(`"@target-uri": ${url}`);
    } else {
      const headerValue = headers[component.toLowerCase()];
      if (headerValue === undefined) {
        throw new Error(`Missing required header: ${component}`);
      }
      lines.push(`"${component}": ${headerValue}`);
    }
  }

  const params = `(${components.map((c) => `"${c}"`).join(' ')});alg="${ALGORITHM}";keyid="${headers['signature-input-keyid'] || ''}"`;
  lines.push(`"@signature-params": ${params}`);

  return { base: lines.join('\n'), coveredComponents: components };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sign an outbound federation request with HTTP Message Signatures (RFC 9421).
 *
 * Adds Signature-Input, Signature, Content-Digest (if body), and Date headers.
 */
export function signFederationRequest(opts: SignOptions): SignResult {
  const { method, url, body, privateKey, keyId } = opts;
  const headers = { ...opts.headers };

  // Ensure Date header
  if (!headers['date']) {
    headers['date'] = new Date().toUTCString();
  }

  // Compute Content-Digest for body
  const hasBody = body !== undefined && body !== null && body !== '';
  if (hasBody) {
    headers['content-digest'] = computeContentDigest(body);
  }

  // Build signature base
  const coveredComponents = ['@method', '@target-uri'];
  if (hasBody) {
    coveredComponents.push('content-digest');
  }
  coveredComponents.push('date');

  const signatureParams = `(${coveredComponents.map((c) => `"${c}"`).join(' ')});alg="${ALGORITHM}";keyid="${keyId}"`;

  // Build base string with the actual params
  const headersCopy = { ...headers, 'signature-input-keyid': keyId };
  const { base } = buildSignatureBase(method, url, headersCopy, hasBody);

  // Sign with Ed25519
  const keyObj = crypto.createPrivateKey(privateKey);
  const signature = crypto.sign(null, Buffer.from(base), keyObj);
  const signatureB64 = signature.toString('base64');

  headers['signature-input'] = `sig1=${signatureParams}`;
  headers['signature'] = `sig1=:${signatureB64}:`;

  // Clean up internal marker
  delete headers['signature-input-keyid'];

  return { headers };
}

/**
 * Verify an inbound federation request signature (RFC 9421).
 *
 * Validates timestamp freshness, Content-Digest (RFC 9530), and Ed25519 signature.
 */
export async function verifyFederationSignature(
  opts: VerifyOptions,
  input: VerifyInput,
): Promise<VerifyResult> {
  const { maxAge = DEFAULT_MAX_AGE, keyLookup } = opts;
  const { method, url, headers, body } = input;

  // Normalize header keys to lowercase
  const normalizedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalizedHeaders[key.toLowerCase()] = value;
  }

  // Extract Signature-Input and Signature
  const signatureInput = normalizedHeaders['signature-input'];
  const signatureHeader = normalizedHeaders['signature'];

  if (!signatureInput || !signatureHeader) {
    throw new Error('Missing Signature or Signature-Input headers');
  }

  // Parse Signature-Input: sig1=("@method" "@target-uri" ...);alg="ed25519";keyid="..."
  const sigInputMatch = signatureInput.match(
    /^sig1=\(([^)]*)\);alg="([^"]+)";keyid="([^"]+)"$/,
  );
  if (!sigInputMatch) {
    throw new Error('Invalid Signature-Input format');
  }

  const [, componentStr, alg, keyId] = sigInputMatch;
  if (alg !== ALGORITHM) {
    throw new Error(`Unsupported algorithm: ${alg}`);
  }

  // Parse Signature: sig1=:<base64>:
  const sigMatch = signatureHeader.match(/^sig1=:([A-Za-z0-9+/=]+):$/);
  if (!sigMatch) {
    throw new Error('Invalid Signature format');
  }
  const signatureBytes = Buffer.from(sigMatch[1], 'base64');

  // Validate timestamp freshness — date header is required for replay protection
  const dateHeader = normalizedHeaders['date'];
  if (!dateHeader) {
    throw new Error('Missing required Date header for replay protection');
  }
  const requestTime = new Date(dateHeader).getTime();
  if (Number.isNaN(requestTime)) {
    throw new Error('Invalid Date header format');
  }
  const now = Date.now();
  if (Math.abs(now - requestTime) > maxAge * 1000) {
    throw new Error('Signature expired: timestamp outside allowed window');
  }

  // Verify Content-Digest if body is present
  const hasBody = body !== undefined && body !== null && body !== '';
  if (hasBody) {
    const expectedDigest = normalizedHeaders['content-digest'];
    if (!expectedDigest) {
      throw new Error('Missing Content-Digest header for request with body');
    }
    const actualDigest = computeContentDigest(body);
    if (expectedDigest !== actualDigest) {
      throw new Error('Content-Digest mismatch: body has been tampered with');
    }
  }

  // Look up public key
  const publicKeyPem = await keyLookup(keyId);
  if (!publicKeyPem) {
    throw new Error(`Unknown keyId: ${keyId}`);
  }

  // Reconstruct signature base
  const components = componentStr.split(' ').map((c) => c.replace(/"/g, ''));

  const lines: string[] = [];
  for (const component of components) {
    if (component === '@method') {
      lines.push(`"@method": ${method.toUpperCase()}`);
    } else if (component === '@target-uri') {
      lines.push(`"@target-uri": ${url}`);
    } else {
      const headerValue = normalizedHeaders[component.toLowerCase()];
      if (headerValue === undefined) {
        throw new Error(
          `Missing required header referenced in signature: ${component}`,
        );
      }
      lines.push(`"${component}": ${headerValue}`);
    }
  }

  const params = `(${components.map((c) => `"${c}"`).join(' ')});alg="${ALGORITHM}";keyid="${keyId}"`;
  lines.push(`"@signature-params": ${params}`);
  const base = lines.join('\n');

  // Verify Ed25519 signature
  const keyObj = crypto.createPublicKey(publicKeyPem);
  const valid = crypto.verify(null, Buffer.from(base), keyObj, signatureBytes);

  return { valid, keyId };
}

/**
 * Compute Content-Digest for external use (e.g., test verification).
 */
export { computeContentDigest };
