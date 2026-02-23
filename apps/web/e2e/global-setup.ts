/**
 * Playwright global setup — validates seed data and infrastructure health.
 *
 * Checks:
 * 1. Seed data exists (all projects)
 * 2. tusd + MinIO reachable (uploads project)
 * 3. Zitadel reachable + config exists (oidc project)
 *
 * NOTE: Playwright passes ALL configured projects to globalSetup, even when
 * `--project` filters the run. We parse process.argv to detect which project
 * was actually requested, falling back to "all" if no --project flag is found.
 */

import { existsSync } from "fs";
import { resolve } from "path";
import { getOrgBySlug, getUserByEmail, disconnectDb } from "./helpers/db";

/**
 * Determine which projects are being run by checking process.argv.
 * Playwright doesn't filter FullConfig.projects for globalSetup,
 * so we parse the CLI args directly.
 */
function getRequestedProjects(): Set<string> {
  const args = process.argv;
  const projects = new Set<string>();

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--project" && args[i + 1]) {
      projects.add(args[i + 1]);
    }
    // Handle --project=name format
    const match = args[i]?.match(/^--project=(.+)$/);
    if (match) {
      projects.add(match[1]);
    }
  }

  // If no --project flag, all projects will run
  if (projects.size === 0) {
    projects.add("submissions");
    projects.add("uploads");
    projects.add("oidc");
    projects.add("embed");
  }

  return projects;
}

async function isReachable(url: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export default async function globalSetup() {
  const requestedProjects = getRequestedProjects();

  // 1. Seed data validation (required by all projects)
  const org = await getOrgBySlug("quarterly-review");
  if (!org) {
    await disconnectDb();
    throw new Error(
      'E2E prerequisite failed: seed org "quarterly-review" not found.\n' +
        "Run `pnpm db:seed` to populate seed data before running E2E tests.",
    );
  }

  const user = await getUserByEmail("writer@example.com");
  if (!user) {
    await disconnectDb();
    throw new Error(
      'E2E prerequisite failed: seed user "writer@example.com" not found.\n' +
        "Run `pnpm db:seed` to populate seed data before running E2E tests.",
    );
  }

  // 2. Upload infrastructure health check
  if (requestedProjects.has("uploads")) {
    const tusdOk = await isReachable("http://localhost:1080");
    if (!tusdOk) {
      await disconnectDb();
      throw new Error(
        "E2E prerequisite failed: tusd not reachable at http://localhost:1080.\n" +
          "Run `docker compose -f docker-compose.yml -f docker-compose.e2e.yml up tusd minio minio-setup -d`",
      );
    }

    const minioOk = await isReachable(
      "http://localhost:9000/minio/health/live",
    );
    if (!minioOk) {
      await disconnectDb();
      throw new Error(
        "E2E prerequisite failed: MinIO not reachable at http://localhost:9000.\n" +
          "Run `docker compose -f docker-compose.yml -f docker-compose.e2e.yml up minio minio-setup -d`",
      );
    }
  }

  // 3. OIDC infrastructure health check
  if (requestedProjects.has("oidc")) {
    const zitadelOk = await isReachable("http://localhost:8080/debug/healthz");
    if (!zitadelOk) {
      await disconnectDb();
      throw new Error(
        "E2E prerequisite failed: Zitadel not reachable at http://localhost:8080.\n" +
          "Run `docker compose --profile auth up -d`",
      );
    }

    const configPath = resolve(__dirname, ".zitadel-e2e-config.json");
    if (!existsSync(configPath)) {
      await disconnectDb();
      throw new Error(
        "E2E prerequisite failed: .zitadel-e2e-config.json not found.\n" +
          "Run `pnpm --filter @colophony/web e2e:setup-oidc` to provision Zitadel test data.",
      );
    }
  }

  await disconnectDb();
}
