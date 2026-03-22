/**
 * Zitadel dev provisioning script.
 *
 * Automates Zitadel setup for local development (port 3000/4000):
 * 1. Wait for Zitadel health
 * 2. Read machine-user PAT
 * 3. Create/find project + OIDC app
 * 4. Create/find test user + sync to Colophony DB
 * 5. Set up webhook target + executions for user lifecycle events
 * 6. Patch apps/api/.env and apps/web/.env.local with Zitadel config
 *
 * Idempotent: checks for existing resources before creating.
 * Separate project/app from E2E to avoid conflicts.
 *
 * Usage:
 *   pnpm zitadel:setup
 *   # or: tsx scripts/setup-zitadel-dev.ts
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

import {
  ZITADEL_URL,
  TEST_USER_EMAIL,
  TEST_USER_PASSWORD,
  TEST_USER_FIRST,
  TEST_USER_LAST,
  waitForHealth,
  getAdminToken,
  findOrCreateProject,
  findOrCreateOidcApp,
  findOrCreateUser,
  ensureColophonyUser,
  disableMfaRequirement,
  setupWebhookExecutions,
} from "./zitadel-helpers";

const DEV_PROJECT_NAME = "colophony-dev";
const DEV_APP_NAME = "colophony-dev-web";
const DEV_REDIRECT_URI = "http://localhost:3000/auth/callback";
const DEV_POST_LOGOUT_URI = "http://localhost:3000";

const API_ENV_PATH = resolve(__dirname, "../apps/api/.env");
const WEB_ENV_PATH = resolve(__dirname, "../apps/web/.env.local");

// ---------------------------------------------------------------------------
// .env file patcher
// ---------------------------------------------------------------------------

/**
 * Patch a .env file: if key exists, replace its value; if not, append.
 * Creates the file if it doesn't exist.
 */
function patchEnvFile(filePath: string, patches: Record<string, string>): void {
  let content = "";
  if (existsSync(filePath)) {
    content = readFileSync(filePath, "utf-8");
  }

  for (const [key, value] of Object.entries(patches)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    const line = `${key}=${value}`;
    if (regex.test(content)) {
      content = content.replace(regex, line);
    } else {
      // Ensure trailing newline before appending
      if (content.length > 0 && !content.endsWith("\n")) {
        content += "\n";
      }
      content += line + "\n";
    }
  }

  writeFileSync(filePath, content);
  console.log(`  Patched: ${filePath}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Zitadel Dev Setup ===\n");

  // 1. Wait for Zitadel
  await waitForHealth();

  // 2. Get admin token
  console.log("\nReading admin PAT...");
  const token = getAdminToken();

  // 3. Disable MFA requirement
  console.log("\nConfiguring login policy...");
  await disableMfaRequirement(token);

  // 4. Create project
  console.log("\nSetting up project...");
  const projectId = await findOrCreateProject(token, DEV_PROJECT_NAME);

  // 5. Create OIDC app
  console.log("\nSetting up OIDC app...");
  const { clientId } = await findOrCreateOidcApp(
    token,
    projectId,
    DEV_APP_NAME,
    [DEV_REDIRECT_URI],
    [DEV_POST_LOGOUT_URI],
  );

  // 6. Create test user in Zitadel
  console.log("\nSetting up test user...");
  const zitadelUserId = await findOrCreateUser(
    token,
    TEST_USER_EMAIL,
    TEST_USER_PASSWORD,
    TEST_USER_FIRST,
    TEST_USER_LAST,
  );

  // 7. Insert into Colophony DB
  console.log("\nSyncing to Colophony DB...");
  await ensureColophonyUser(zitadelUserId, TEST_USER_EMAIL, "quarterly-review");

  // 8. Set up webhook target + executions
  console.log("\nSetting up webhook executions...");
  const DEV_WEBHOOK_URL = "http://host.docker.internal:4000/webhooks/zitadel";
  const signingKey = await setupWebhookExecutions(
    token,
    "colophony-dev-webhook",
    DEV_WEBHOOK_URL,
  );

  // 9. Patch .env files
  // API uses projectId for audience validation (Zitadel JWT aud claim = project ID)
  // Web uses clientId for the OIDC client
  console.log("\nPatching .env files...");

  const apiEnvPatches: Record<string, string> = {
    ZITADEL_AUTHORITY: ZITADEL_URL,
    ZITADEL_CLIENT_ID: projectId,
  };

  if (signingKey) {
    apiEnvPatches.ZITADEL_WEBHOOK_SECRET = signingKey;
    console.log("  Webhook signing key obtained from new target.");
  } else {
    // Target already existed — check if secret is already in .env
    let hasSecret = false;
    if (existsSync(API_ENV_PATH)) {
      const envContent = readFileSync(API_ENV_PATH, "utf-8");
      hasSecret = /^ZITADEL_WEBHOOK_SECRET=.+$/m.test(envContent);
    }
    if (!hasSecret) {
      console.warn(
        "\n⚠️  Webhook target already exists but ZITADEL_WEBHOOK_SECRET is not set in .env.",
      );
      console.warn(
        "   The signing key is only returned when the target is first created.",
      );
      console.warn(
        "   To regenerate: delete the target in Zitadel UI (Actions → Targets), then rerun this script.",
      );
    }
  }

  patchEnvFile(API_ENV_PATH, apiEnvPatches);

  patchEnvFile(WEB_ENV_PATH, {
    NEXT_PUBLIC_ZITADEL_AUTHORITY: ZITADEL_URL,
    NEXT_PUBLIC_ZITADEL_CLIENT_ID: clientId,
  });

  console.log("\n=== Dev setup complete ===");
  console.log(`\nTest user: ${TEST_USER_EMAIL} / ${TEST_USER_PASSWORD}`);
  console.log("Restart dev servers (pnpm dev) to pick up the new .env values.");
}

main().catch((err) => {
  console.error("\nSetup failed:", err);
  process.exit(1);
});
