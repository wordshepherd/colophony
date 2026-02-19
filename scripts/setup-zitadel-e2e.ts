/**
 * Zitadel E2E provisioning script.
 *
 * Automates Zitadel setup for OIDC E2E tests:
 * 1. Wait for Zitadel health
 * 2. Authenticate via service user or admin PAT
 * 3. Create/find project + OIDC app
 * 4. Create/find test user
 * 5. Insert user into Colophony DB + add org membership
 * 6. Write config to apps/web/e2e/.zitadel-e2e-config.json
 *
 * Idempotent: checks for existing resources before creating.
 *
 * Usage:
 *   tsx scripts/setup-zitadel-e2e.ts
 */

import { writeFileSync } from "fs";
import { resolve } from "path";
import { Pool } from "pg";

const ZITADEL_URL = process.env.ZITADEL_URL || "http://localhost:8080";
const MASTERKEY =
  process.env.ZITADEL_MASTERKEY || "MasterkeyNeedsToHave32Characters";
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://colophony:password@localhost:5432/colophony";

const E2E_PROJECT_NAME = "colophony-e2e";
const E2E_APP_NAME = "colophony-e2e-web";
const E2E_REDIRECT_URI = "http://localhost:3010/auth/callback";
const E2E_POST_LOGOUT_URI = "http://localhost:3010";

const TEST_USER_EMAIL = "e2e-test@colophony.dev";
const TEST_USER_PASSWORD = "E2eTestPassword1!";
const TEST_USER_FIRST = "E2E";
const TEST_USER_LAST = "TestUser";

const CONFIG_OUTPUT = resolve(
  __dirname,
  "../apps/web/e2e/.zitadel-e2e-config.json",
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitForHealth(
  maxRetries = 30,
  intervalMs = 2000,
): Promise<void> {
  console.log(`Waiting for Zitadel at ${ZITADEL_URL}...`);
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${ZITADEL_URL}/debug/healthz`);
      if (res.ok) {
        console.log("Zitadel is healthy.");
        return;
      }
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Zitadel not healthy after ${maxRetries * intervalMs}ms`);
}

/**
 * Get an admin access token.
 *
 * Zitadel `start-from-init` creates a default admin user (zitadel-admin@zitadel.localhost).
 * We authenticate via the management API's machine user PAT or via the admin API.
 *
 * For simplicity in local dev, we use the Admin API with the default admin credentials.
 * The exact mechanism depends on Zitadel version — we try PAT first, then password grant.
 */
async function getAdminToken(): Promise<string> {
  // Try 1: Use the system API with masterkey (simplest for start-from-init)
  // Zitadel system API accepts masterkey as Bearer token for system-level operations
  // But management API needs a proper OIDC token. Let's create a PAT via system API.

  // First, list instances to find the default instance
  const instanceRes = await fetch(
    `${ZITADEL_URL}/system/v1/instances/_search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MASTERKEY}`,
      },
      body: JSON.stringify({ query: { limit: 1 } }),
    },
  );

  if (!instanceRes.ok) {
    throw new Error(
      `Failed to list Zitadel instances: ${instanceRes.status} ${await instanceRes.text()}`,
    );
  }

  // For management API calls, we need a valid access token.
  // Strategy: find the default IAM admin user via system API, then create a PAT.
  const instanceData = (await instanceRes.json()) as {
    result?: Array<{ id: string }>;
  };
  if (!instanceData.result?.length) {
    throw new Error("No Zitadel instances found");
  }

  // Find the default admin user (created by start-from-init)
  const usersRes = await fetch(`${ZITADEL_URL}/management/v1/users/_search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Zitadel accepts masterkey as Bearer token for the default instance
      Authorization: `Bearer ${MASTERKEY}`,
      "x-zitadel-orgid": "0", // IAM org
    },
    body: JSON.stringify({
      queries: [
        {
          emailQuery: {
            emailAddress: "zitadel-admin@zitadel.localhost",
            method: "TEXT_QUERY_METHOD_EQUALS",
          },
        },
      ],
    }),
  });

  if (!usersRes.ok) {
    // Fallback: try password grant with the Zitadel Console client_id
    // The Console app is always created by start-from-init
    const tokenRes = await fetch(`${ZITADEL_URL}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: "zitadel-console", // Default Console app client ID
        username: "zitadel-admin@zitadel.localhost",
        password: "Password1!",
        scope: "openid urn:zitadel:iam:org:project:id:zitadel:aud",
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      throw new Error(
        `Failed to get admin token: ${tokenRes.status} ${body}\n` +
          "Ensure Zitadel was started with `start-from-init` and default admin credentials.",
      );
    }

    const tokenData = (await tokenRes.json()) as { access_token: string };
    return tokenData.access_token;
  }

  // Use masterkey directly for management API (works when Zitadel accepts it)
  return MASTERKEY;
}

interface ApiResponse<T> {
  ok: boolean;
  status: number;
  data: T;
}

async function zitadelApi<T>(
  token: string,
  path: string,
  method: string = "POST",
  body?: unknown,
): Promise<ApiResponse<T>> {
  const res = await fetch(`${ZITADEL_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

// ---------------------------------------------------------------------------
// Provisioning
// ---------------------------------------------------------------------------

async function findOrCreateProject(token: string): Promise<string> {
  // Search for existing project
  const search = await zitadelApi<{
    result?: Array<{ id: string; name: string }>;
  }>(token, "/management/v1/projects/_search", "POST", {
    queries: [
      {
        nameQuery: {
          name: E2E_PROJECT_NAME,
          method: "TEXT_QUERY_METHOD_EQUALS",
        },
      },
    ],
  });

  if (search.ok && search.data.result?.length) {
    console.log(`Found existing project: ${search.data.result[0].id}`);
    return search.data.result[0].id;
  }

  // Create project
  const create = await zitadelApi<{ id: string }>(
    token,
    "/management/v1/projects",
    "POST",
    { name: E2E_PROJECT_NAME },
  );

  if (!create.ok) {
    throw new Error(`Failed to create project: ${JSON.stringify(create.data)}`);
  }

  console.log(`Created project: ${create.data.id}`);
  return create.data.id;
}

async function findOrCreateOidcApp(
  token: string,
  projectId: string,
): Promise<{ appId: string; clientId: string }> {
  // Search for existing app
  const search = await zitadelApi<{
    result?: Array<{
      id: string;
      name: string;
      oidcConfig?: { clientId: string };
    }>;
  }>(token, `/management/v1/projects/${projectId}/apps/_search`, "POST", {});

  const existing = search.data.result?.find((a) => a.name === E2E_APP_NAME);
  if (existing?.oidcConfig) {
    console.log(`Found existing OIDC app: ${existing.oidcConfig.clientId}`);
    return { appId: existing.id, clientId: existing.oidcConfig.clientId };
  }

  // Create OIDC app
  const create = await zitadelApi<{
    appId: string;
    clientId: string;
  }>(token, `/management/v1/projects/${projectId}/apps/oidc`, "POST", {
    name: E2E_APP_NAME,
    redirectUris: [E2E_REDIRECT_URI],
    postLogoutRedirectUris: [E2E_POST_LOGOUT_URI],
    responseTypes: ["OIDC_RESPONSE_TYPE_CODE"],
    grantTypes: ["OIDC_GRANT_TYPE_AUTHORIZATION_CODE"],
    appType: "OIDC_APP_TYPE_USER_AGENT",
    authMethodType: "OIDC_AUTH_METHOD_TYPE_NONE", // PKCE (no client secret)
    devMode: true, // Allow http redirects in dev
  });

  if (!create.ok) {
    throw new Error(
      `Failed to create OIDC app: ${JSON.stringify(create.data)}`,
    );
  }

  console.log(`Created OIDC app: ${create.data.clientId}`);
  return { appId: create.data.appId, clientId: create.data.clientId };
}

async function findOrCreateUser(token: string): Promise<string> {
  // Search for existing user
  const search = await zitadelApi<{
    result?: Array<{ userId: string }>;
  }>(token, "/v2/users", "POST", {
    queries: [
      {
        emailQuery: {
          emailAddress: TEST_USER_EMAIL,
          method: "TEXT_QUERY_METHOD_EQUALS",
        },
      },
    ],
  });

  if (search.ok && search.data.result?.length) {
    console.log(`Found existing user: ${search.data.result[0].userId}`);
    return search.data.result[0].userId;
  }

  // Create human user
  const create = await zitadelApi<{ userId: string }>(
    token,
    "/v2/users/human",
    "POST",
    {
      username: TEST_USER_EMAIL,
      profile: {
        givenName: TEST_USER_FIRST,
        familyName: TEST_USER_LAST,
      },
      email: {
        email: TEST_USER_EMAIL,
        isVerified: true,
      },
      password: {
        password: TEST_USER_PASSWORD,
        changeRequired: false,
      },
    },
  );

  if (!create.ok) {
    throw new Error(`Failed to create user: ${JSON.stringify(create.data)}`);
  }

  console.log(`Created user: ${create.data.userId}`);
  return create.data.userId;
}

async function ensureColophonyUser(
  zitadelUserId: string,
): Promise<{ userId: string; orgId: string }> {
  const pool = new Pool({ connectionString: DATABASE_URL, max: 2 });

  try {
    // Check if user already exists
    const existing = await pool.query<{ id: string }>(
      "SELECT id FROM users WHERE zitadel_user_id = $1",
      [zitadelUserId],
    );

    let userId: string;
    if (existing.rows.length > 0) {
      userId = existing.rows[0].id;
      console.log(`Found existing Colophony user: ${userId}`);
    } else {
      const insert = await pool.query<{ id: string }>(
        "INSERT INTO users (email, zitadel_user_id) VALUES ($1, $2) RETURNING id",
        [TEST_USER_EMAIL, zitadelUserId],
      );
      userId = insert.rows[0].id;
      console.log(`Created Colophony user: ${userId}`);
    }

    // Find or use the seed org
    const orgResult = await pool.query<{ id: string }>(
      "SELECT id FROM organizations WHERE slug = 'quarterly-review' LIMIT 1",
    );

    if (orgResult.rows.length === 0) {
      throw new Error(
        'Seed org "quarterly-review" not found. Run `pnpm db:seed` first.',
      );
    }

    const orgId = orgResult.rows[0].id;

    // Add membership if not exists
    const memberExists = await pool.query(
      "SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2",
      [orgId, userId],
    );

    if (memberExists.rows.length === 0) {
      await pool.query(
        "INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, $3)",
        [orgId, userId, "ADMIN"],
      );
      console.log(`Added user to org ${orgId} as ADMIN`);
    }

    return { userId, orgId };
  } finally {
    await pool.end();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Zitadel E2E Setup ===\n");

  // 1. Wait for Zitadel
  await waitForHealth();

  // 2. Get admin token
  console.log("\nAuthenticating as admin...");
  const token = await getAdminToken();

  // 3. Create project
  console.log("\nSetting up project...");
  const projectId = await findOrCreateProject(token);

  // 4. Create OIDC app
  console.log("\nSetting up OIDC app...");
  const { clientId } = await findOrCreateOidcApp(token, projectId);

  // 5. Create test user in Zitadel
  console.log("\nSetting up test user...");
  const zitadelUserId = await findOrCreateUser(token);

  // 6. Insert into Colophony DB
  console.log("\nSyncing to Colophony DB...");
  const { userId, orgId } = await ensureColophonyUser(zitadelUserId);

  // 7. Write config file
  const config = {
    authority: ZITADEL_URL,
    clientId,
    projectId,
    testUserEmail: TEST_USER_EMAIL,
    testUserPassword: TEST_USER_PASSWORD,
    testUserId: userId,
    testOrgId: orgId,
    zitadelUserId,
  };

  writeFileSync(CONFIG_OUTPUT, JSON.stringify(config, null, 2) + "\n");
  console.log(`\nConfig written to: ${CONFIG_OUTPUT}`);
  console.log("\n=== Setup complete ===");
}

main().catch((err) => {
  console.error("\nSetup failed:", err);
  process.exit(1);
});
