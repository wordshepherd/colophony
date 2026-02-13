import { drizzle } from 'drizzle-orm/node-postgres';
import { getAppPool, type DrizzleDb } from './db-setup';

export async function withTestRls<T>(
  ctx: { orgId?: string; userId?: string },
  fn: (tx: DrizzleDb) => Promise<T>,
): Promise<T> {
  const pool = getAppPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (ctx.userId) {
      await client.query('SELECT set_config($1, $2, true)', [
        'app.user_id',
        ctx.userId,
      ]);
    }
    if (ctx.orgId) {
      await client.query('SELECT set_config($1, $2, true)', [
        'app.current_org',
        ctx.orgId,
      ]);
    }
    const tx = drizzle(client);
    const result = await fn(tx);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
