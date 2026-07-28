/**
 * Produces the production build that the CI Playwright jobs run against.
 *
 * Why a build at all: `next dev --turbo` compiles a route on its first request,
 * and CI intermittently got a genuine 404 from a route at that boundary while its
 * already-compiled siblings kept serving 200 from the same process. `next start`
 * has no first-request compile boundary, so the failure mode cannot occur.
 *
 * Why a script rather than an inline env in package.json: `next build` inlines
 * `NEXT_PUBLIC_*` textually, so these values must match what the tests assume at
 * runtime exactly. Sharing `getPublicEnv` with `playwright.config.ts` and
 * `e2e/helpers/auth.ts` is what keeps them from drifting.
 *
 * Usage:
 *   pnpm --filter @colophony/web build:e2e                 # the nine normal suites
 *   OIDC_E2E=true pnpm --filter @colophony/web build:e2e   # the oidc suite
 */

import { spawnSync } from "child_process";
import { getPublicEnv } from "../e2e/e2e-env";

const isOidc = process.env.OIDC_E2E === "true";
const publicEnv = getPublicEnv(isOidc);

console.log(
  `Building @colophony/web for E2E (${isOidc ? "oidc" : "standard"} suites)`,
);
for (const [key, value] of Object.entries(publicEnv)) {
  console.log(`  ${key}=${value}`);
}

const result = spawnSync("next", ["build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    ...publicEnv,
    // Drops `output: "standalone"` for this build — see next.config.ts. The
    // standalone bundle is for the Docker image and `next start` warns when it
    // is present.
    NEXT_E2E_BUILD: "1",
  },
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
