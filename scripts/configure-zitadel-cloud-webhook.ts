/**
 * Zitadel Cloud webhook configuration script.
 *
 * Diagnoses and configures webhook event subscriptions on a Zitadel Cloud
 * instance. Ensures the webhook target exists and is subscribed to all
 * user lifecycle event groups.
 *
 * Usage:
 *   pnpm zitadel:cloud-webhook --diagnose              # Read-only diagnostic
 *   pnpm zitadel:cloud-webhook --webhook-url <url>      # Configure
 *   pnpm zitadel:cloud-webhook --dry-run                # Show planned changes
 *
 * Environment variables (or CLI args):
 *   ZITADEL_AUTHORITY          --authority     Zitadel Cloud instance URL
 *   ZITADEL_CLOUD_PAT          --token         Service account PAT
 *   ZITADEL_CLOUD_WEBHOOK_URL  --webhook-url   Production webhook endpoint
 *
 * Idempotent: safe to run multiple times.
 */

import {
  zitadelApi,
  findOrCreateTarget,
  setGroupExecution,
  WEBHOOK_EVENT_TYPES,
} from "./zitadel-helpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Config {
  authority: string;
  token: string;
  webhookUrl: string;
  targetName: string;
  diagnose: boolean;
  dryRun: boolean;
  deleteTargets: string[];
}

interface TargetInfo {
  id: string;
  name: string;
  endpoint?: string;
  targetType?: Record<string, unknown>;
}

interface ExecutionInfo {
  condition: {
    event?: { group?: string; event?: string };
    request?: unknown;
    response?: unknown;
  };
  targets?: string[];
}

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseConfig(): Config {
  const args = process.argv.slice(2);

  function getArg(flag: string): string | undefined {
    const idx = args.indexOf(flag);
    if (idx === -1 || idx + 1 >= args.length) return undefined;
    return args[idx + 1];
  }

  const authority =
    getArg("--authority") || process.env.ZITADEL_AUTHORITY || "";
  const token = getArg("--token") || process.env.ZITADEL_CLOUD_PAT || "";
  const webhookUrl =
    getArg("--webhook-url") || process.env.ZITADEL_CLOUD_WEBHOOK_URL || "";
  const targetName = getArg("--target-name") || "colophony-cloud-webhook";
  const diagnose = args.includes("--diagnose");
  const dryRun = args.includes("--dry-run");

  // Collect all --delete-target values
  const deleteTargets: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--delete-target" && i + 1 < args.length) {
      deleteTargets.push(args[i + 1]);
    }
  }

  // Strip trailing slash from authority
  const cleanAuthority = authority.replace(/\/+$/, "");

  if (!cleanAuthority) {
    console.error(
      "Error: --authority or ZITADEL_AUTHORITY is required.\n" +
        "Usage: pnpm zitadel:cloud-webhook --authority https://your-instance.zitadel.cloud --token <PAT>",
    );
    process.exit(1);
  }

  if (!token) {
    console.error(
      "Error: --token or ZITADEL_CLOUD_PAT is required.\n" +
        "Provide a Personal Access Token with IAM_OWNER or ORG_OWNER permissions.",
    );
    process.exit(1);
  }

  if (!diagnose && !dryRun && !webhookUrl) {
    console.error(
      "Error: --webhook-url or ZITADEL_CLOUD_WEBHOOK_URL is required for configuration.\n" +
        "Use --diagnose for read-only mode.",
    );
    process.exit(1);
  }

  return {
    authority: cleanAuthority,
    token,
    webhookUrl,
    targetName,
    diagnose,
    dryRun,
    deleteTargets,
  };
}

// ---------------------------------------------------------------------------
// Diagnostic functions
// ---------------------------------------------------------------------------

async function listTargets(
  token: string,
  baseUrl: string,
): Promise<TargetInfo[]> {
  const res = await zitadelApi<{
    targets?: TargetInfo[];
  }>(token, "/v2/actions/targets/search", "POST", {}, baseUrl);

  if (!res.ok) {
    console.error(`Failed to list targets (HTTP ${res.status}):`, res.data);
    return [];
  }

  return res.data.targets ?? [];
}

async function listExecutions(
  token: string,
  baseUrl: string,
): Promise<ExecutionInfo[]> {
  const res = await zitadelApi<{
    executions?: ExecutionInfo[];
  }>(token, "/v2/actions/executions/search", "POST", {}, baseUrl);

  if (!res.ok) {
    console.error(`Failed to list executions (HTTP ${res.status}):`, res.data);
    return [];
  }

  return res.data.executions ?? [];
}

async function deleteTarget(
  token: string,
  targetId: string,
  baseUrl: string,
): Promise<boolean> {
  const res = await zitadelApi(
    token,
    `/v2/actions/targets/${targetId}`,
    "DELETE",
    undefined,
    baseUrl,
  );

  if (!res.ok) {
    console.error(
      `  Failed to delete target ${targetId} (HTTP ${res.status}):`,
      res.data,
    );
    return false;
  }

  console.log(`  Deleted target: ${targetId}`);
  return true;
}

function printDiagnostic(
  targets: TargetInfo[],
  executions: ExecutionInfo[],
): void {
  console.log("\n--- Targets ---");
  if (targets.length === 0) {
    console.log("  (none)");
  } else {
    for (const t of targets) {
      const endpoint = t.endpoint || "(no endpoint)";
      const type = t.targetType
        ? Object.keys(t.targetType).join(", ")
        : "unknown";
      console.log(`  ${t.id}  ${t.name}  ${endpoint}  [${type}]`);
    }
  }

  console.log("\n--- Executions ---");
  const eventExecutions = executions.filter((e) => e.condition?.event);
  const otherExecutions = executions.filter((e) => !e.condition?.event);

  if (eventExecutions.length === 0) {
    console.log("  (no event executions)");
  } else {
    for (const e of eventExecutions) {
      const event = e.condition.event!;
      const label = event.group
        ? `group: ${event.group}`
        : event.event
          ? `event: ${event.event}`
          : "unknown";
      const targetIds = e.targets?.join(", ") || "(no targets)";
      console.log(`  [${label}] → targets: [${targetIds}]`);
    }
  }

  if (otherExecutions.length > 0) {
    console.log(`\n  (${otherExecutions.length} non-event executions omitted)`);
  }

  // Coverage analysis
  console.log("\n--- Coverage Analysis ---");
  const configuredGroups = eventExecutions
    .filter((e) => e.condition.event?.group)
    .map((e) => e.condition.event!.group!);

  const hasUserGroup = configuredGroups.includes("user");
  const hasUserHumanGroup = configuredGroups.includes("user.human");

  console.log(
    `  "user" group:       ${hasUserGroup ? "configured" : "MISSING"}`,
  );
  console.log(
    `  "user.human" group: ${hasUserHumanGroup ? "configured" : "MISSING"}`,
  );

  if (hasUserGroup) {
    console.log("\n  The 'user' group covers all user lifecycle events.");
  } else if (hasUserHumanGroup) {
    console.log(
      "\n  The 'user.human' group covers user.human.* events but MISSES:",
    );
    console.log("    - user.deactivated");
    console.log("    - user.reactivated");
    console.log("    - user.removed");
  } else {
    console.log(
      "\n  No user event groups configured. The webhook will not receive any user events.",
    );
  }

  console.log("\n  Supported event types (from webhook handler):");
  for (const et of WEBHOOK_EVENT_TYPES) {
    const covered =
      hasUserGroup || (hasUserHumanGroup && et.startsWith("user.human."));
    console.log(`    ${covered ? "✓" : "✗"} ${et}`);
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Event groups to configure — "user" is the broadest group covering all user events */
const CLOUD_EVENT_GROUPS = ["user", "user.human"] as const;

async function configure(config: Config): Promise<void> {
  // Find or create target
  console.log(`\nFinding/creating webhook target: ${config.targetName}`);
  console.log(`  URL: ${config.webhookUrl}`);

  const { targetId, signingKey } = await findOrCreateTarget(
    config.token,
    config.targetName,
    config.webhookUrl,
    "10s",
    config.authority,
  );

  // Set group executions
  console.log("\nConfiguring event group executions...");
  for (const group of CLOUD_EVENT_GROUPS) {
    console.log(`  Setting execution for group: ${group}`);
    await setGroupExecution(config.token, group, targetId, config.authority);
  }

  // Signing key warning
  if (signingKey) {
    console.log("\n=== SIGNING KEY (save this — shown only once) ===");
    console.log(`  ${signingKey}`);
    console.log(
      "  Set this as ZITADEL_WEBHOOK_SECRET in your production environment.",
    );
  } else {
    console.log("\n  Target already existed — signing key was not returned.");
    console.log(
      "  Ensure ZITADEL_WEBHOOK_SECRET is set in your production environment.",
    );
    console.log(
      "  To regenerate: delete the target in Zitadel Cloud Console (Actions → Targets), then rerun.",
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const config = parseConfig();

  console.log("=== Zitadel Cloud Webhook Configuration ===");
  console.log(`  Authority:   ${config.authority}`);
  console.log(`  Target name: ${config.targetName}`);
  console.log(
    `  Mode:        ${config.diagnose ? "diagnose" : config.dryRun ? "dry-run" : "configure"}`,
  );

  // Verify connectivity
  console.log("\nVerifying API access...");
  const targets = await listTargets(config.token, config.authority);
  const executions = await listExecutions(config.token, config.authority);

  // Always show diagnostic
  printDiagnostic(targets, executions);

  if (config.diagnose) {
    console.log("\n=== Diagnose complete (read-only) ===");
    return;
  }

  // Delete stale targets if requested
  if (config.deleteTargets.length > 0) {
    console.log("\n--- Deleting stale targets ---");
    for (const targetId of config.deleteTargets) {
      const target = targets.find((t) => t.id === targetId);
      if (!target) {
        console.error(`  Target ${targetId} not found — skipping`);
        continue;
      }
      if (config.dryRun) {
        console.log(`  Would delete: ${targetId} (${target.name})`);
      } else {
        await deleteTarget(config.token, targetId, config.authority);
      }
    }
  }

  if (config.dryRun) {
    console.log("\n--- Dry Run: Planned Changes ---");
    console.log(
      `  1. Find or create target: ${config.targetName} → ${config.webhookUrl}`,
    );
    for (const group of CLOUD_EVENT_GROUPS) {
      console.log(
        `  2. Set execution: group "${group}" → target ${config.targetName}`,
      );
    }
    console.log("\n=== Dry run complete (no changes made) ===");
    return;
  }

  // Configure
  await configure(config);

  // Re-diagnose to verify
  console.log("\n--- Verifying configuration ---");
  const newTargets = await listTargets(config.token, config.authority);
  const newExecutions = await listExecutions(config.token, config.authority);
  printDiagnostic(newTargets, newExecutions);

  console.log("\n=== Configuration complete ===");
}

main().catch((err) => {
  console.error("\nConfiguration failed:", err);
  process.exit(1);
});
