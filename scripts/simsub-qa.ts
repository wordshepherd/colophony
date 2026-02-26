/**
 * Sim-Sub (BSAP) Manual QA Test Script
 *
 * Validates cross-instance sim-sub enforcement end-to-end:
 * - Fingerprint computation
 * - S2S HTTP-signed request
 * - DID resolution
 * - Conflict detection
 * - Admin override
 *
 * Prerequisites:
 *   docker compose -f docker-compose.yml -f docker-compose.simsub-qa.yml up -d postgres postgres-b redis
 *   Instance A: PORT=4000, DB on 5432 (standard dev DB)
 *   Instance B: PORT=5000, DB on 5434
 *
 * Usage: tsx scripts/simsub-qa.ts
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve pg from @colophony/db's dependencies (not hoisted to root)
const require = createRequire(
  path.resolve(__dirname, "../packages/db/src/client.ts"),
);
const { Pool } = require("pg") as typeof import("pg");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const INSTANCE_A_URL = process.env.INSTANCE_A_URL ?? "http://localhost:4000";
const INSTANCE_B_URL = process.env.INSTANCE_B_URL ?? "http://localhost:5000";

const DB_A_URL =
  process.env.DB_A_URL ??
  "postgresql://colophony:password@localhost:5432/colophony";
const DB_B_URL =
  process.env.DB_B_URL ??
  "postgresql://colophony:password@localhost:5434/colophony";

const INSTANCE_A_DOMAIN = "localhost:4000";
const INSTANCE_B_DOMAIN = "localhost:5000";

// Test content — same title/content produces same fingerprint on both instances
const SHARED_TITLE = "The Vanishing Point";
const SHARED_CONTENT =
  "A meditation on the geometry of loss, where parallel lines of memory converge at infinity.";
const UNIQUE_TITLE = "Unrelated Manuscript";
const UNIQUE_CONTENT =
  "This is a completely different piece with no overlap whatsoever.";

// API key for Instance B (seeded by this script)
const INSTANCE_B_API_KEY = "col_live_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const INSTANCE_B_API_KEY_HASH = crypto
  .createHash("sha256")
  .update(INSTANCE_B_API_KEY)
  .digest("hex");
const INSTANCE_B_API_KEY_PREFIX = "col_live_bbb";

// Admin API key for Instance B (for override endpoint)
const INSTANCE_B_ADMIN_KEY = "col_live_bbbbbbbbbbbbbbbbbbbbbbbbbbbadmin";
const INSTANCE_B_ADMIN_KEY_HASH = crypto
  .createHash("sha256")
  .update(INSTANCE_B_ADMIN_KEY)
  .digest("hex");
const INSTANCE_B_ADMIN_KEY_PREFIX = "col_live_bbb";

// Generate Ed25519 keypairs for federation
const keypairA = crypto.generateKeyPairSync("ed25519");
const keypairB = crypto.generateKeyPairSync("ed25519");

const publicKeyA = keypairA.publicKey
  .export({ type: "spki", format: "pem" })
  .toString();
const privateKeyA = keypairA.privateKey
  .export({ type: "pkcs8", format: "pem" })
  .toString();
const publicKeyB = keypairB.publicKey
  .export({ type: "spki", format: "pem" })
  .toString();
const privateKeyB = keypairB.privateKey
  .export({ type: "pkcs8", format: "pem" })
  .toString();

// ---------------------------------------------------------------------------
// Fingerprint computation (mirrors fingerprint.service.ts)
// ---------------------------------------------------------------------------

function computeFingerprint(
  title: string,
  contentText: string | null,
  fileHashes: string[] = [],
): string {
  const normalize = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();
  const sorted = [...fileHashes].sort();
  const input =
    normalize(title) +
    "\0" +
    normalize(contentText ?? "") +
    "\0" +
    sorted.join(",");
  return crypto.createHash("sha256").update(input).digest("hex");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const migrationsFolder = path.resolve(__dirname, "../packages/db/migrations");

async function applyMigrations(pool: Pool): Promise<void> {
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
    entries: Array<{ tag: string }>;
  };

  for (const entry of journal.entries) {
    const sqlPath = path.join(migrationsFolder, `${entry.tag}.sql`);
    const sql = fs.readFileSync(sqlPath, "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await pool.query(statement);
    }
  }
}

async function setupDbB(pool: Pool): Promise<void> {
  // Create roles (same as init-db.sh, but idempotent)
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user LOGIN PASSWORD 'app_password'
          NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      ELSE
        ALTER ROLE app_user NOSUPERUSER NOBYPASSRLS;
      END IF;
    END $$;
  `);
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'audit_writer') THEN
        CREATE ROLE audit_writer NOLOGIN
          NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      ELSE
        ALTER ROLE audit_writer NOSUPERUSER NOBYPASSRLS;
      END IF;
    END $$;
  `);
  await pool.query("GRANT USAGE ON SCHEMA public TO audit_writer");

  // Reset schema
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.query("GRANT ALL ON SCHEMA public TO PUBLIC");
  await pool.query("GRANT USAGE ON SCHEMA public TO app_user");

  // Apply all migrations
  await applyMigrations(pool);

  // Grant DML to app_user
  await pool.query(
    "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user",
  );
  await pool.query(
    "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user",
  );
  await pool.query(
    "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user",
  );
  await pool.query(
    "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user",
  );
  // Revoke audit direct writes (same as RLS test setup)
  await pool.query(
    'REVOKE INSERT, UPDATE, DELETE ON "audit_events" FROM app_user',
  );
}

interface SeedIds {
  orgId: string;
  userId: string;
  adminUserId: string;
  periodSimSubId: string;
  periodNoSimSubId: string;
  publicationId: string;
}

async function seedInstanceA(
  pool: Pool,
): Promise<SeedIds & { submissionId: string }> {
  // Use the existing seed org — look up quarterly-review
  const { rows: orgs } = await pool.query<{ id: string }>(
    `SELECT id FROM organizations WHERE slug = 'quarterly-review' LIMIT 1`,
  );
  if (orgs.length === 0) {
    throw new Error("Instance A seed data missing. Run `pnpm db:seed` first.");
  }
  const orgId = orgs[0].id;

  // Get the existing admin user
  const { rows: admins } = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE email = 'editor@quarterlyreview.org' LIMIT 1`,
  );
  const adminUserId = admins[0].id;

  // Create test user for sim-sub (shared identity across instances)
  const { rows: existingUser } = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE email = 'alice@localhost' LIMIT 1`,
  );
  let userId: string;
  if (existingUser.length > 0) {
    userId = existingUser[0].id;
  } else {
    const { rows: newUser } = await pool.query<{ id: string }>(
      `INSERT INTO users (email, zitadel_user_id, email_verified, email_verified_at)
       VALUES ('alice@localhost', 'simsub-qa-alice', true, NOW())
       RETURNING id`,
    );
    userId = newUser[0].id;
  }

  // Ensure membership in the org
  await pool.query(
    `INSERT INTO organization_members (organization_id, user_id, role)
     VALUES ($1, $2, 'READER')
     ON CONFLICT (organization_id, user_id) DO NOTHING`,
    [orgId, userId],
  );

  // Create a publication for the period
  const { rows: pubs } = await pool.query<{ id: string }>(
    `INSERT INTO publications (organization_id, name, slug, status)
     VALUES ($1, 'SimSub Test Pub A', 'simsub-test-pub-a', 'ACTIVE')
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [orgId],
  );
  let publicationId: string;
  if (pubs.length > 0) {
    publicationId = pubs[0].id;
  } else {
    const { rows: existPub } = await pool.query<{ id: string }>(
      `SELECT id FROM publications WHERE slug = 'simsub-test-pub-a' LIMIT 1`,
    );
    publicationId = existPub[0].id;
  }

  // Create sim-sub period (with simSubProhibited = true)
  const { rows: existPeriod } = await pool.query<{ id: string }>(
    `SELECT id FROM submission_periods WHERE name = 'SimSub QA Period A' AND organization_id = $1 LIMIT 1`,
    [orgId],
  );
  let periodSimSubId: string;
  if (existPeriod.length > 0) {
    periodSimSubId = existPeriod[0].id;
  } else {
    const { rows: newPeriod } = await pool.query<{ id: string }>(
      `INSERT INTO submission_periods (organization_id, name, opens_at, closes_at, sim_sub_prohibited, publication_id)
       VALUES ($1, 'SimSub QA Period A', NOW() - interval '7 days', NOW() + interval '30 days', true, $2)
       RETURNING id`,
      [orgId, publicationId],
    );
    periodSimSubId = newPeriod[0].id;
  }

  // Create manuscript + version + submission with shared content
  const sharedFingerprint = computeFingerprint(SHARED_TITLE, SHARED_CONTENT);

  const { rows: ms } = await pool.query<{ id: string }>(
    `INSERT INTO manuscripts (owner_id, title, description) VALUES ($1, $2, 'QA test manuscript')
     RETURNING id`,
    [userId, SHARED_TITLE],
  );
  const manuscriptId = ms[0].id;

  const { rows: mv } = await pool.query<{ id: string }>(
    `INSERT INTO manuscript_versions (manuscript_id, version_number, label, content_fingerprint)
     VALUES ($1, 1, 'QA v1', $2)
     RETURNING id`,
    [manuscriptId, sharedFingerprint],
  );
  const versionId = mv[0].id;

  const { rows: sub } = await pool.query<{ id: string }>(
    `INSERT INTO submissions (organization_id, submitter_id, submission_period_id, manuscript_version_id, title, content, status, submitted_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'SUBMITTED', NOW())
     RETURNING id`,
    [orgId, userId, periodSimSubId, versionId, SHARED_TITLE, SHARED_CONTENT],
  );
  const submissionId = sub[0].id;

  // Seed federation config for Instance A
  await pool.query(`DELETE FROM federation_config WHERE singleton = true`);
  await pool.query(
    `INSERT INTO federation_config (singleton, public_key, private_key, key_id, mode, enabled)
     VALUES (true, $1, $2, $3, 'open', true)`,
    [publicKeyA, privateKeyA, `${INSTANCE_A_DOMAIN}#main`],
  );

  // Seed trusted peer pointing to Instance B
  await pool.query(
    `DELETE FROM trusted_peers WHERE domain = $1 AND organization_id = $2`,
    [INSTANCE_B_DOMAIN, orgId],
  );
  await pool.query(
    `INSERT INTO trusted_peers (organization_id, domain, instance_url, public_key, key_id, granted_capabilities, status, initiated_by)
     VALUES ($1, $2, $3, $4, $5, $6, 'active', 'local')`,
    [
      orgId,
      INSTANCE_B_DOMAIN,
      INSTANCE_B_URL,
      publicKeyB,
      `${INSTANCE_B_DOMAIN}#main`,
      JSON.stringify({ "simsub.respond": true }),
    ],
  );

  // We don't need a period without sim-sub on instance A
  return {
    orgId,
    userId,
    adminUserId,
    periodSimSubId,
    periodNoSimSubId: "", // not needed
    publicationId,
    submissionId,
  };
}

async function seedInstanceB(pool: Pool): Promise<SeedIds> {
  // Create org (Instance B DB is freshly set up, no conflicts)
  const { rows: existOrgs } = await pool.query<{ id: string }>(
    `SELECT id FROM organizations WHERE slug = 'instance-b-mag' LIMIT 1`,
  );
  let orgId: string;
  if (existOrgs.length > 0) {
    orgId = existOrgs[0].id;
  } else {
    const { rows: newOrgs } = await pool.query<{ id: string }>(
      `INSERT INTO organizations (name, slug, settings)
       VALUES ('Instance B Magazine', 'instance-b-mag', '{"maxFileSize": 10485760}')
       RETURNING id`,
    );
    orgId = newOrgs[0].id;
  }

  // Create admin user
  const { rows: adminUsers } = await pool.query<{ id: string }>(
    `INSERT INTO users (email, zitadel_user_id, email_verified, email_verified_at)
     VALUES ('admin-b@localhost', 'simsub-qa-admin-b', true, NOW())
     ON CONFLICT DO NOTHING
     RETURNING id`,
  );
  let adminUserId: string;
  if (adminUsers.length > 0) {
    adminUserId = adminUsers[0].id;
  } else {
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE email = 'admin-b@localhost' LIMIT 1`,
    );
    adminUserId = rows[0].id;
  }

  // Create test user (same email as Instance A for DID resolution)
  const { rows: existingUser } = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE email = 'alice@localhost' LIMIT 1`,
  );
  let userId: string;
  if (existingUser.length > 0) {
    userId = existingUser[0].id;
  } else {
    const { rows: newUser } = await pool.query<{ id: string }>(
      `INSERT INTO users (email, zitadel_user_id, email_verified, email_verified_at)
       VALUES ('alice@localhost', 'simsub-qa-alice-b', true, NOW())
       RETURNING id`,
    );
    userId = newUser[0].id;
  }

  // Memberships
  await pool.query(
    `INSERT INTO organization_members (organization_id, user_id, role)
     VALUES ($1, $2, 'ADMIN')
     ON CONFLICT (organization_id, user_id) DO NOTHING`,
    [orgId, adminUserId],
  );
  await pool.query(
    `INSERT INTO organization_members (organization_id, user_id, role)
     VALUES ($1, $2, 'READER')
     ON CONFLICT (organization_id, user_id) DO NOTHING`,
    [orgId, userId],
  );

  // Publication
  const { rows: existPub } = await pool.query<{ id: string }>(
    `SELECT id FROM publications WHERE slug = 'instance-b-journal' AND organization_id = $1 LIMIT 1`,
    [orgId],
  );
  let publicationId: string;
  if (existPub.length > 0) {
    publicationId = existPub[0].id;
  } else {
    const { rows: newPub } = await pool.query<{ id: string }>(
      `INSERT INTO publications (organization_id, name, slug, status)
       VALUES ($1, 'Instance B Journal', 'instance-b-journal', 'ACTIVE')
       RETURNING id`,
      [orgId],
    );
    publicationId = newPub[0].id;
  }

  // Sim-sub period
  const { rows: p1 } = await pool.query<{ id: string }>(
    `INSERT INTO submission_periods (organization_id, name, opens_at, closes_at, sim_sub_prohibited, publication_id)
     VALUES ($1, 'SimSub QA Period B', NOW() - interval '7 days', NOW() + interval '30 days', true, $2)
     RETURNING id`,
    [orgId, publicationId],
  );
  const periodSimSubId = p1[0].id;

  // Non-sim-sub period
  const { rows: p2 } = await pool.query<{ id: string }>(
    `INSERT INTO submission_periods (organization_id, name, opens_at, closes_at, sim_sub_prohibited, publication_id)
     VALUES ($1, 'Open Period B (no sim-sub)', NOW() - interval '7 days', NOW() + interval '30 days', false, $2)
     RETURNING id`,
    [orgId, publicationId],
  );
  const periodNoSimSubId = p2[0].id;

  // API keys — submitter key (scoped to submissions:write + submissions:read)
  await pool.query(
    `INSERT INTO api_keys (organization_id, created_by, name, key_hash, key_prefix, scopes)
     VALUES ($1, $2, 'QA Submitter Key', $3, $4, $5)`,
    [
      orgId,
      userId,
      INSTANCE_B_API_KEY_HASH,
      INSTANCE_B_API_KEY_PREFIX,
      JSON.stringify(["submissions:read", "submissions:write", "periods:read"]),
    ],
  );

  // Admin key (scoped to submissions:write + admin endpoints)
  await pool.query(
    `INSERT INTO api_keys (organization_id, created_by, name, key_hash, key_prefix, scopes)
     VALUES ($1, $2, 'QA Admin Key', $3, $4, $5)`,
    [
      orgId,
      adminUserId,
      INSTANCE_B_ADMIN_KEY_HASH,
      INSTANCE_B_ADMIN_KEY_PREFIX,
      JSON.stringify([
        "submissions:read",
        "submissions:write",
        "periods:read",
        "periods:write",
      ]),
    ],
  );

  // Federation config for Instance B
  await pool.query(`DELETE FROM federation_config WHERE singleton = true`);
  await pool.query(
    `INSERT INTO federation_config (singleton, public_key, private_key, key_id, mode, enabled)
     VALUES (true, $1, $2, $3, 'open', true)`,
    [publicKeyB, privateKeyB, `${INSTANCE_B_DOMAIN}#main`],
  );

  // Trusted peer pointing to Instance A
  await pool.query(
    `INSERT INTO trusted_peers (organization_id, domain, instance_url, public_key, key_id, granted_capabilities, status, initiated_by)
     VALUES ($1, $2, $3, $4, $5, $6, 'active', 'local')`,
    [
      orgId,
      INSTANCE_A_DOMAIN,
      INSTANCE_A_URL,
      publicKeyA,
      `${INSTANCE_A_DOMAIN}#main`,
      JSON.stringify({ "simsub.respond": true }),
    ],
  );

  return {
    orgId,
    userId,
    adminUserId,
    periodSimSubId,
    periodNoSimSubId,
    publicationId,
  };
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function createDraftSubmission(
  instanceUrl: string,
  apiKey: string,
  orgId: string,
  opts: {
    title: string;
    content: string;
    periodId: string;
    userId: string;
  },
  dbPool: Pool,
): Promise<string> {
  // Create manuscript + version directly in DB (API doesn't have a combined endpoint)
  const fingerprint = computeFingerprint(opts.title, opts.content);

  const { rows: ms } = await dbPool.query<{ id: string }>(
    `INSERT INTO manuscripts (owner_id, title) VALUES ($1, $2) RETURNING id`,
    [opts.userId, opts.title],
  );
  const { rows: mv } = await dbPool.query<{ id: string }>(
    `INSERT INTO manuscript_versions (manuscript_id, version_number, content_fingerprint)
     VALUES ($1, 1, $2) RETURNING id`,
    [ms[0].id, fingerprint],
  );

  // Create DRAFT submission
  const { rows: sub } = await dbPool.query<{ id: string }>(
    `INSERT INTO submissions (organization_id, submitter_id, submission_period_id, manuscript_version_id, title, content, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT')
     RETURNING id`,
    [orgId, opts.userId, opts.periodId, mv[0].id, opts.title, opts.content],
  );

  return sub[0].id;
}

async function submitSubmission(
  instanceUrl: string,
  apiKey: string,
  submissionId: string,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(
    `${instanceUrl}/v1/submissions/${submissionId}/submit`,
    {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
    },
  );
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function grantOverride(
  instanceUrl: string,
  apiKey: string,
  submissionId: string,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(
    `${instanceUrl}/federation/sim-sub/override/${submissionId}`,
    {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
      },
    },
  );
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function getSimSubChecks(
  instanceUrl: string,
  apiKey: string,
  submissionId: string,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(
    `${instanceUrl}/federation/sim-sub/checks/${submissionId}`,
    {
      headers: { "X-Api-Key": apiKey },
    },
  );
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=== Sim-Sub QA Test Suite ===\n");

  const poolA = new Pool({ connectionString: DB_A_URL, max: 3 });
  const poolB = new Pool({ connectionString: DB_B_URL, max: 3 });

  // Track IDs for cleanup
  const cleanupIdsA: string[] = [];

  try {
    // -----------------------------------------------------------------------
    // Phase 1: Setup
    // -----------------------------------------------------------------------
    console.log("[SETUP] Preparing Instance B database...");
    await setupDbB(poolB);
    console.log("[SETUP] Instance B migrations applied");

    console.log("[SETUP] Seeding Instance A...");
    const seedA = await seedInstanceA(poolA);
    cleanupIdsA.push(seedA.submissionId);
    console.log(
      `[SETUP] Instance A seeded (org=${seedA.orgId.slice(0, 8)}..., submission=${seedA.submissionId.slice(0, 8)}...)`,
    );

    console.log("[SETUP] Seeding Instance B...");
    const seedB = await seedInstanceB(poolB);
    console.log(
      `[SETUP] Instance B seeded (org=${seedB.orgId.slice(0, 8)}..., periods: sim-sub=${seedB.periodSimSubId.slice(0, 8)}..., no-sim-sub=${seedB.periodNoSimSubId.slice(0, 8)}...)`,
    );

    // Verify fingerprints match
    const fpShared = computeFingerprint(SHARED_TITLE, SHARED_CONTENT);
    const fpUnique = computeFingerprint(UNIQUE_TITLE, UNIQUE_CONTENT);
    console.log(`[SETUP] Shared fingerprint: ${fpShared.slice(0, 16)}...`);
    console.log(`[SETUP] Unique fingerprint: ${fpUnique.slice(0, 16)}...`);
    console.log();

    // Quick health check — verify both instances are running
    console.log("[PREFLIGHT] Checking instance health...");
    try {
      const [healthA, healthB] = await Promise.all([
        fetch(`${INSTANCE_A_URL}/health`).then((r) => r.ok),
        fetch(`${INSTANCE_B_URL}/health`).then((r) => r.ok),
      ]);
      if (!healthA) throw new Error("Instance A not responding");
      if (!healthB) throw new Error("Instance B not responding");
      console.log("[PREFLIGHT] Both instances healthy\n");
    } catch (e) {
      console.error(
        `[PREFLIGHT] Instance health check failed: ${e instanceof Error ? e.message : e}`,
      );
      console.error(
        "\nMake sure both API instances are running. See scripts/simsub-qa-README.md for instructions.",
      );
      process.exit(1);
    }

    // -----------------------------------------------------------------------
    // Test 1: Submit to non-sim-sub period → no check
    // -----------------------------------------------------------------------
    console.log(
      "[TEST 1] Submit to non-sim-sub period → should succeed (no check)",
    );
    const sub1Id = await createDraftSubmission(
      INSTANCE_B_URL,
      INSTANCE_B_API_KEY,
      seedB.orgId,
      {
        title: SHARED_TITLE,
        content: SHARED_CONTENT,
        periodId: seedB.periodNoSimSubId,
        userId: seedB.userId,
      },
      poolB,
    );
    const res1 = await submitSubmission(
      INSTANCE_B_URL,
      INSTANCE_B_API_KEY,
      sub1Id,
    );
    assert(res1.status === 200, `Status 200 (got ${res1.status})`);
    // Verify no sim-sub check was recorded
    const checks1 = await getSimSubChecks(
      INSTANCE_B_URL,
      INSTANCE_B_ADMIN_KEY,
      sub1Id,
    );
    const checksArr1 = Array.isArray(checks1.body) ? checks1.body : [];
    assert(
      checksArr1.length === 0,
      `No sim-sub check recorded (found ${checksArr1.length})`,
    );
    console.log();

    // -----------------------------------------------------------------------
    // Test 2: Submit unique manuscript to sim-sub period → CLEAR
    // -----------------------------------------------------------------------
    console.log(
      "[TEST 2] Submit unique manuscript to sim-sub period → should CLEAR",
    );
    const sub2Id = await createDraftSubmission(
      INSTANCE_B_URL,
      INSTANCE_B_API_KEY,
      seedB.orgId,
      {
        title: UNIQUE_TITLE,
        content: UNIQUE_CONTENT,
        periodId: seedB.periodSimSubId,
        userId: seedB.userId,
      },
      poolB,
    );
    const res2 = await submitSubmission(
      INSTANCE_B_URL,
      INSTANCE_B_API_KEY,
      sub2Id,
    );
    assert(res2.status === 200, `Status 200 (got ${res2.status})`);

    // Verify sim-sub check recorded as CLEAR
    const checks2 = await getSimSubChecks(
      INSTANCE_B_URL,
      INSTANCE_B_ADMIN_KEY,
      sub2Id,
    );
    const checksArr2 = Array.isArray(checks2.body) ? checks2.body : [];
    assert(
      checksArr2.length > 0,
      `Sim-sub check recorded (found ${checksArr2.length})`,
    );
    if (checksArr2.length > 0) {
      const check = checksArr2[0] as Record<string, unknown>;
      assert(check.result === "CLEAR", `Result is CLEAR (got ${check.result})`);
      const remoteResults = check.remote_results ?? check.remoteResults;
      assert(
        Array.isArray(remoteResults) && remoteResults.length > 0,
        `Remote peer was queried (${Array.isArray(remoteResults) ? remoteResults.length : 0} results)`,
      );
      if (Array.isArray(remoteResults) && remoteResults.length > 0) {
        const peer = remoteResults[0] as Record<string, unknown>;
        assert(
          peer.domain === INSTANCE_A_DOMAIN,
          `Peer domain is ${INSTANCE_A_DOMAIN} (got ${peer.domain})`,
        );
        assert(
          peer.status === "checked",
          `Peer status is checked (got ${peer.status})`,
        );
      }
    }
    console.log();

    // -----------------------------------------------------------------------
    // Test 3: Submit same manuscript to sim-sub period → CONFLICT
    // -----------------------------------------------------------------------
    console.log(
      "[TEST 3] Submit duplicate manuscript to sim-sub period → should CONFLICT",
    );
    const sub3Id = await createDraftSubmission(
      INSTANCE_B_URL,
      INSTANCE_B_API_KEY,
      seedB.orgId,
      {
        title: SHARED_TITLE,
        content: SHARED_CONTENT,
        periodId: seedB.periodSimSubId,
        userId: seedB.userId,
      },
      poolB,
    );
    const res3 = await submitSubmission(
      INSTANCE_B_URL,
      INSTANCE_B_API_KEY,
      sub3Id,
    );
    assert(res3.status === 409, `Status 409 (got ${res3.status})`);
    if (res3.body && typeof res3.body === "object") {
      const body = res3.body as Record<string, unknown>;
      // oRPC error format: { defined, code, status, message, data: { conflicts, remoteResults } }
      const data = (body.data ?? body) as Record<string, unknown>;
      const localConflicts = data?.conflicts as unknown[] | undefined;
      const remoteResults = data?.remoteResults as
        | Array<Record<string, unknown>>
        | undefined;

      // Aggregate: local conflicts + remote conflicts
      const allConflicts = [
        ...(localConflicts ?? []),
        ...(remoteResults ?? []).flatMap((r) =>
          Array.isArray(r.conflicts) ? r.conflicts : [],
        ),
      ];
      assert(
        allConflicts.length > 0,
        `Conflict details present (${allConflicts.length} conflicts: ${localConflicts?.length ?? 0} local, ${(remoteResults ?? []).reduce((n, r) => n + (Array.isArray(r.conflicts) ? r.conflicts.length : 0), 0)} remote)`,
      );
      if (allConflicts.length > 0) {
        const c = allConflicts[0] as Record<string, unknown>;
        console.log(
          `  → Conflict from: ${c.publicationName}, period: ${c.periodName}`,
        );
      }
      if (Array.isArray(remoteResults) && remoteResults.length > 0) {
        const peer = remoteResults[0];
        assert(
          peer.domain === INSTANCE_A_DOMAIN,
          `Remote conflict from ${INSTANCE_A_DOMAIN} (got ${peer.domain})`,
        );
      }
    }
    console.log();

    // -----------------------------------------------------------------------
    // Test 4: Admin override + re-submit → success despite conflict
    // -----------------------------------------------------------------------
    console.log(
      "[TEST 4] Admin override + re-submit → should succeed despite conflict",
    );

    // First reset the submission to DRAFT so it can be re-submitted
    await poolB.query(
      `UPDATE submissions SET status = 'DRAFT', submitted_at = NULL WHERE id = $1`,
      [sub3Id],
    );

    // Grant override
    const overrideRes = await grantOverride(
      INSTANCE_B_URL,
      INSTANCE_B_ADMIN_KEY,
      sub3Id,
    );
    assert(
      overrideRes.status === 200,
      `Override granted (status ${overrideRes.status})`,
    );

    // Re-submit
    const res4 = await submitSubmission(
      INSTANCE_B_URL,
      INSTANCE_B_API_KEY,
      sub3Id,
    );
    assert(res4.status === 200, `Re-submit succeeded (status ${res4.status})`);

    // Brief delay to let the API transaction commit
    await new Promise((r) => setTimeout(r, 500));

    // Verify submission is now SUBMITTED
    const { rows: finalSub } = await poolB.query<{
      status: string;
      sim_sub_override: boolean;
    }>(`SELECT status, sim_sub_override FROM submissions WHERE id = $1`, [
      sub3Id,
    ]);
    if (finalSub.length > 0) {
      assert(
        finalSub[0].status === "SUBMITTED",
        `Status is SUBMITTED (got ${finalSub[0].status})`,
      );
      assert(finalSub[0].sim_sub_override === true, `sim_sub_override is true`);
    }
    console.log();

    // -----------------------------------------------------------------------
    // Summary
    // -----------------------------------------------------------------------
    const total = passed + failed;
    console.log(`=== ${passed}/${total} assertions passed ===`);
    if (failed > 0) {
      console.error(`\n${failed} assertion(s) FAILED`);
      process.exitCode = 1;
    }
  } finally {
    // -----------------------------------------------------------------------
    // Phase 3: Cleanup — remove test data from Instance A (leave base seed)
    // -----------------------------------------------------------------------
    console.log("\n[CLEANUP] Removing test data from Instance A...");
    try {
      // Delete test submissions, manuscripts, versions, federation data we added
      await poolA.query(
        `DELETE FROM submissions WHERE title = $1 AND status = 'SUBMITTED' AND submitter_id IN (SELECT id FROM users WHERE email = 'alice@localhost')`,
        [SHARED_TITLE],
      );
      await poolA.query(
        `DELETE FROM manuscript_versions WHERE manuscript_id IN (SELECT id FROM manuscripts WHERE owner_id IN (SELECT id FROM users WHERE email = 'alice@localhost') AND title = $1)`,
        [SHARED_TITLE],
      );
      await poolA.query(
        `DELETE FROM manuscripts WHERE owner_id IN (SELECT id FROM users WHERE email = 'alice@localhost') AND title = $1`,
        [SHARED_TITLE],
      );
      await poolA.query(`DELETE FROM trusted_peers WHERE domain = $1`, [
        INSTANCE_B_DOMAIN,
      ]);
      await poolA.query(
        `DELETE FROM submission_periods WHERE name = 'SimSub QA Period A'`,
      );
      await poolA.query(
        `DELETE FROM publications WHERE slug = 'simsub-test-pub-a'`,
      );
      await poolA.query(
        `DELETE FROM organization_members WHERE user_id IN (SELECT id FROM users WHERE email = 'alice@localhost')`,
      );
      await poolA.query(`DELETE FROM users WHERE email = 'alice@localhost'`);
      // Restore federation config to disabled (don't delete — it may be auto-recreated)
      await poolA.query(`UPDATE federation_config SET enabled = false`);
      console.log("[CLEANUP] Instance A test data removed");
    } catch (e) {
      console.warn(
        `[CLEANUP] Warning: Instance A cleanup failed: ${e instanceof Error ? e.message : e}`,
      );
    }

    // Instance B database can be dropped entirely (docker compose down handles it)
    console.log(
      "[CLEANUP] Instance B: run `docker compose -f docker-compose.yml -f docker-compose.simsub-qa.yml down postgres-b` to remove",
    );

    await poolA.end();
    await poolB.end();
  }
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
