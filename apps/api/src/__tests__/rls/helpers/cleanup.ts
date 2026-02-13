import { getAdminPool } from './db-setup';

export async function truncateAllTables(): Promise<void> {
  const pool = getAdminPool();
  const { rows } = await pool.query<{ tablename: string }>(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE '__drizzle%'
  `);
  if (rows.length === 0) return;
  const tables = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
  await pool.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE;`);
}
