/**
 * Zitadel E2E provisioning script.
 *
 * Automates Zitadel setup for OIDC E2E tests:
 * 1. Wait for Zitadel health
 * 2. Read machine-user PAT (created by start-from-init via FIRSTINSTANCE env vars)
 * 3. Create/find project + OIDC app (with JWT access tokens)
 * 4. Create/find test user
 * 5. Insert user into Colophony DB + add org membership
 * 6. Set up webhook target + executions for user lifecycle events
 * 7. Write config to apps/web/e2e/.zitadel-e2e-config.json
 *
 * Idempotent: checks for existing resources before creating.
 *
 * Usage:
 *   tsx scripts/setup-zitadel-e2e.ts
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

const E2E_PROJECT_NAME = "colophony-e2e";
const E2E_APP_NAME = "colophony-e2e-web";
const E2E_WEB_PORT = process.env.E2E_WEB_PORT || "3010";
const E2E_REDIRECT_URI = `http://localhost:${E2E_WEB_PORT}/auth/callback`;
const E2E_POST_LOGOUT_URI = `http://localhost:${E2E_WEB_PORT}`;

// Also allow port 3000 (dev server) so the same Zitadel app works for manual QA
const DEV_REDIRECT_URI = "http://localhost:3000/auth/callback";
const DEV_POST_LOGOUT_URI = "http://localhost:3000";

const CONFIG_OUTPUT = resolve(
  __dirname,
  "../apps/web/e2e/.zitadel-e2e-config.json",
);
const API_ENV_PATH = resolve(__dirname, "../apps/api/.env");

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Zitadel E2E Setup ===\n");

  // 1. Wait for Zitadel
  await waitForHealth();

  // 2. Get admin token (PAT from start-from-init machine user)
  console.log("\nReading admin PAT...");
  const token = getAdminToken();

  // 3. Disable MFA requirement for E2E tests
  console.log("\nConfiguring login policy...");
  await disableMfaRequirement(token);

  // 4. Create project
  console.log("\nSetting up project...");
  const projectId = await findOrCreateProject(token, E2E_PROJECT_NAME);

  // 5. Create OIDC app
  console.log("\nSetting up OIDC app...");
  const { clientId } = await findOrCreateOidcApp(
    token,
    projectId,
    E2E_APP_NAME,
    [E2E_REDIRECT_URI, DEV_REDIRECT_URI],
    [E2E_POST_LOGOUT_URI, DEV_POST_LOGOUT_URI],
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
  const { userId, orgId } = await ensureColophonyUser(
    zitadelUserId,
    TEST_USER_EMAIL,
    "quarterly-review",
  );

  // 8. Set up webhook target + executions
  const E2E_API_PORT = process.env.E2E_API_PORT || "4010";
  const E2E_WEBHOOK_URL = `http://host.docker.internal:${E2E_API_PORT}/webhooks/zitadel`;
  console.log("\nSetting up webhook executions...");
  const signingKey = await setupWebhookExecutions(
    token,
    "colophony-e2e-webhook",
    E2E_WEBHOOK_URL,
  );

  // 9. Write config file
  // projectId is used as ZITADEL_CLIENT_ID for the API's audience validation,
  // since Zitadel JWT access tokens put the project ID in the `aud` claim.
  const config: Record<string, string> = {
    authority: ZITADEL_URL,
    clientId,
    projectId,
    testUserEmail: TEST_USER_EMAIL,
    testUserPassword: TEST_USER_PASSWORD,
    testUserId: userId,
    testOrgId: orgId,
    zitadelUserId,
  };

  if (signingKey) {
    config.webhookSecret = signingKey;

    // Patch ZITADEL_WEBHOOK_SECRET into API .env so the E2E API process
    // can verify webhook signatures (it loads .env via tsx --env-file)
    let envContent = "";
    if (existsSync(API_ENV_PATH)) {
      envContent = readFileSync(API_ENV_PATH, "utf-8");
    }
    const key = "ZITADEL_WEBHOOK_SECRET";
    const line = `${key}=${signingKey}`;
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, line);
    } else {
      if (envContent.length > 0 && !envContent.endsWith("\n")) {
        envContent += "\n";
      }
      envContent += line + "\n";
    }
    writeFileSync(API_ENV_PATH, envContent);
    console.log(`  Patched ZITADEL_WEBHOOK_SECRET into ${API_ENV_PATH}`);
  }

  writeFileSync(CONFIG_OUTPUT, JSON.stringify(config, null, 2) + "\n");
  console.log(`\nConfig written to: ${CONFIG_OUTPUT}`);
  console.log("\n=== Setup complete ===");
}

main().catch((err) => {
  console.error("\nSetup failed:", err);
  process.exit(1);
});
