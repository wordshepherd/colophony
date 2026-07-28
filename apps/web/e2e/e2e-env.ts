/**
 * Shared environment contract for the E2E stack.
 *
 * Three consumers need to agree on these values and previously did so by
 * coincidence — each declaring its own copy:
 *
 * - `playwright.config.ts` — ports for both webServers
 * - `scripts/build-e2e.ts` — the `NEXT_PUBLIC_*` values baked into the CI build
 * - `e2e/helpers/auth.ts` — the OIDC authority/client that the localStorage
 *   session key is derived from
 *
 * The coincidence stopped being safe when CI moved to `next build` + `next start`.
 * `next build` inlines `NEXT_PUBLIC_*` textually (see `src/env.ts`), so the app's
 * copy of the OIDC authority and client id is fixed at build time while the test's
 * copy is fixed in `helpers/auth.ts`. If the two disagree by one character, the
 * injected session lands under a key the app never reads and every authenticated
 * suite fails at once, with no error pointing at the cause.
 *
 * One definition, three importers.
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

/**
 * E2E servers run on dedicated ports so they never collide with dev servers on
 * the default ports (4000/3000).
 */
export const E2E_API_PORT = 4010;
export const E2E_WEB_PORT = 3010;

/**
 * Placeholder OIDC identity for the nine suites that do not drive a real login.
 * `oidc-client-ts` derives its localStorage key from exactly these two values —
 * see `src/lib/oidc.ts`, which builds the UserManager from the matching
 * `NEXT_PUBLIC_*` pair.
 */
export const OIDC_AUTHORITY = "http://test-idp:8080";
export const OIDC_CLIENT_ID = "test-client";

/** Where tusd is published for the uploads suite. */
export const E2E_TUS_URL = "http://localhost:1080/files/";

export interface ZitadelE2EConfig {
  authority: string;
  clientId: string;
  /**
   * Used for API audience validation: Zitadel JWTs put the project id (not the
   * client id) in the `aud` claim.
   */
  projectId: string;
}

const ZITADEL_CONFIG_PATH = resolve(__dirname, ".zitadel-e2e-config.json");

/**
 * Reads the Zitadel config written by `scripts/setup-zitadel-e2e.ts`, or null
 * when the oidc suite has not been provisioned.
 */
export function readZitadelConfig(): ZitadelE2EConfig | null {
  if (!existsSync(ZITADEL_CONFIG_PATH)) return null;
  return JSON.parse(
    readFileSync(ZITADEL_CONFIG_PATH, "utf-8"),
  ) as ZitadelE2EConfig;
}

/**
 * The `NEXT_PUBLIC_*` values for an E2E build.
 *
 * In CI these are baked in by `scripts/build-e2e.ts`; locally the dev server
 * receives the same values at runtime from `playwright.config.ts`. Both call this
 * function so the two paths cannot drift.
 *
 * The `oidc` suite is the reason this takes a parameter: it drives a real Zitadel
 * login and so needs the provisioned authority and client id, which means it
 * cannot share a build with the other nine suites.
 */
export function getPublicEnv(isOidc: boolean): Record<string, string> {
  const zitadel = isOidc ? readZitadelConfig() : null;

  return {
    NEXT_PUBLIC_API_URL: `http://localhost:${E2E_API_PORT}`,
    NEXT_PUBLIC_TUS_URL: E2E_TUS_URL,
    NEXT_PUBLIC_ZITADEL_AUTHORITY: zitadel?.authority ?? OIDC_AUTHORITY,
    NEXT_PUBLIC_ZITADEL_CLIENT_ID: zitadel?.clientId ?? OIDC_CLIENT_ID,
  };
}
