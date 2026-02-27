// DO NOT EDIT — generated SDK client. Customizations belong in a wrapper.

import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./generated/openapi.js";

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
// SDK options
// ---------------------------------------------------------------------------

export interface ColophonySDKOptions {
  /** Base URL of the Colophony API (e.g. "https://api.example.com/v1"). */
  baseUrl: string;
  /** Authentication credentials — bearer token or API key. */
  auth: ColophonyAuth;
  /** Organization ID header. String or async function for dynamic switching. */
  orgId?: string | (() => string | Promise<string>);
  /** Custom fetch implementation (useful for testing or server-side usage). */
  fetch?: typeof globalThis.fetch;
}

// ---------------------------------------------------------------------------
// SDK factory
// ---------------------------------------------------------------------------

/**
 * Creates a typed Colophony REST API client.
 *
 * @example
 * ```ts
 * import { createColophonySDK } from "@colophony/sdk";
 *
 * const sdk = createColophonySDK({
 *   baseUrl: "https://api.example.com/v1",
 *   auth: { type: "bearer", token: () => getAccessToken() },
 *   orgId: "org-uuid",
 * });
 *
 * const { data, error } = await sdk.GET("/submissions", {
 *   params: { query: { page: 1, limit: 10 } },
 * });
 * ```
 */
export function createColophonySDK(options: ColophonySDKOptions) {
  const client = createClient<paths>({
    baseUrl: options.baseUrl,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });

  // Auth + org context middleware
  const authMiddleware: Middleware = {
    async onRequest({ request }) {
      // Auth header
      if (options.auth.type === "bearer") {
        const token =
          typeof options.auth.token === "function"
            ? await options.auth.token()
            : options.auth.token;
        request.headers.set("Authorization", `Bearer ${token}`);
      } else {
        request.headers.set("X-Api-Key", options.auth.key);
      }

      // Org context header
      if (options.orgId !== undefined) {
        const orgId =
          typeof options.orgId === "function"
            ? await options.orgId()
            : options.orgId;
        request.headers.set("X-Organization-Id", orgId);
      }

      return request;
    },
  };

  client.use(authMiddleware);

  return client;
}

/** Type alias for the SDK client instance. */
export type ColophonySDK = ReturnType<typeof createColophonySDK>;
