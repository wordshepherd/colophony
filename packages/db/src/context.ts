import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { appPool } from "./client";

export type DrizzleDb = NodePgDatabase<Record<string, never>>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateUuid(id: string, name: string): void {
  if (!UUID_RE.test(id)) {
    throw new Error(`Invalid UUID format for ${name}`);
  }
}

/**
 * Execute a function within an RLS context.
 *
 * Acquires a dedicated connection from the pool, sets app.current_org
 * and/or app.user_id via set_config (transaction-local), runs the
 * callback inside a transaction, and releases the connection.
 *
 * CRITICAL: Uses set_config with is_local=true (equivalent to SET LOCAL).
 * Context is automatically cleared when the transaction ends.
 */
export async function withRls<T>(
  ctx: { orgId?: string; userId?: string },
  fn: (tx: DrizzleDb) => Promise<T>,
): Promise<T> {
  if (ctx.orgId) validateUuid(ctx.orgId, "orgId");
  if (ctx.userId) validateUuid(ctx.userId, "userId");

  const client = await appPool.connect();
  try {
    await client.query("BEGIN");

    if (ctx.orgId) {
      await client.query("SELECT set_config($1, $2, true)", [
        "app.current_org",
        ctx.orgId,
      ]);
    }
    if (ctx.userId) {
      await client.query("SELECT set_config($1, $2, true)", [
        "app.user_id",
        ctx.userId,
      ]);
    }

    const tx = drizzle(client);
    const result = await fn(tx);

    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
