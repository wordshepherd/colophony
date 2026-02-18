import { createORPCClient, createSafeClient } from "@orpc/client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import type { ContractRouterClient } from "@orpc/contract";
import { colophonyContract } from "./contract.js";

// ---------------------------------------------------------------------------
// Auth types
// ---------------------------------------------------------------------------

export type ColophonyBearerAuth = {
  type: "bearer";
  token: string | (() => string | Promise<string>);
};

export type ColophonyApiKeyAuth = {
  type: "apiKey";
  key: string;
};

export type ColophonyAuth = ColophonyBearerAuth | ColophonyApiKeyAuth;

// ---------------------------------------------------------------------------
// Client options
// ---------------------------------------------------------------------------

export interface ColophonyClientOptions {
  /** Base URL of the Colophony API (e.g. "https://api.example.com/v1"). */
  baseUrl: string;
  /** Authentication credentials. */
  auth: ColophonyAuth;
  /** Organization ID header. String or async function for dynamic switching. */
  orgId?: string | (() => string | Promise<string>);
  /**
   * Custom fetch implementation (useful for testing or server-side usage).
   * Receives the Request object built by the oRPC link.
   */
  fetch?: (request: Request) => Promise<Response>;
}

// ---------------------------------------------------------------------------
// Client types
// ---------------------------------------------------------------------------

/**
 * Recursively converts Date fields to string to reflect JSON serialization.
 * The REST API returns JSON, so Date schemas become ISO strings on the wire.
 */
export type JsonifyDates<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? Array<JsonifyDates<U>>
    : T extends object
      ? { [K in keyof T]: JsonifyDates<T[K]> }
      : T;

/**
 * Recursively maps a nested oRPC client so procedure return types have
 * Date fields replaced with string (reflecting JSON wire format).
 * Leaves inputs unchanged — oRPC serializes Date inputs automatically.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonifiedRouterClient<T> = T extends (...args: any[]) => Promise<infer R>
  ? (...args: Parameters<T>) => Promise<JsonifyDates<R>>
  : { [K in keyof T]: JsonifiedRouterClient<T[K]> };

/** Internal type matching the raw contract (Date outputs). */
type RawClient = ContractRouterClient<typeof colophonyContract>;

/** Public client type with JSON-accurate output types (dates as strings). */
export type ColophonyClient = JsonifiedRouterClient<RawClient>;

// ---------------------------------------------------------------------------
// Header builder
// ---------------------------------------------------------------------------

async function buildHeaders(
  options: ColophonyClientOptions,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  // Auth header
  if (options.auth.type === "bearer") {
    const token =
      typeof options.auth.token === "function"
        ? await options.auth.token()
        : options.auth.token;
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    headers["X-Api-Key"] = options.auth.key;
  }

  // Org context header
  if (options.orgId !== undefined) {
    const orgId =
      typeof options.orgId === "function"
        ? await options.orgId()
        : options.orgId;
    headers["X-Organization-Id"] = orgId;
  }

  return headers;
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

/**
 * Creates a typed Colophony REST API client.
 *
 * @example
 * ```ts
 * const client = createColophonyClient({
 *   baseUrl: "https://api.example.com/v1",
 *   auth: { type: "bearer", token: () => getAccessToken() },
 *   orgId: "org-uuid",
 * });
 *
 * const submissions = await client.submissions.list({ page: 1, limit: 10 });
 * ```
 */
export function createColophonyClient(
  options: ColophonyClientOptions,
): ColophonyClient {
  const link = new OpenAPILink(colophonyContract, {
    url: options.baseUrl,
    headers: () => buildHeaders(options),
    ...(options.fetch ? { fetch: (request) => options.fetch!(request) } : {}),
  });

  return createORPCClient<RawClient>(link) as unknown as ColophonyClient;
}

/**
 * Creates a safe Colophony REST API client that returns tuples instead of throwing.
 *
 * Each call returns `[error, data, isDefined, isSuccess]`:
 * - Success: `[null, data, false, true]`
 * - Defined error (typed ORPCError): `[error, undefined, true, false]`
 * - Unexpected error: `[error, undefined, false, false]`
 *
 * @example
 * ```ts
 * const client = createSafeColophonyClient({
 *   baseUrl: "https://api.example.com/v1",
 *   auth: { type: "apiKey", key: "col_live_abc123" },
 * });
 *
 * const [error, data, isDefined, isSuccess] = await client.submissions.list({});
 * if (isSuccess) {
 *   console.log(data.items);
 * }
 * ```
 */
export function createSafeColophonyClient(options: ColophonyClientOptions) {
  const client = createColophonyClient(options);
  return createSafeClient(client);
}
