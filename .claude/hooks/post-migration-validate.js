#!/usr/bin/env node

/**
 * Post-edit hook for migration files.
 * Reminds to add RLS policies when a new table is created.
 */

const newContent = process.env.CLAUDE_TOOL_ARGS_new_str || '';

// Detect CREATE TABLE statements
const createTableMatch = newContent.match(/CREATE TABLE\s+(?:"?(\w+)"?)/gi);
if (!createTableMatch) {
  process.exit(0);
}

// Tables that should NOT have RLS (global tables)
const globalTables = [
  'users', 'user_identities', 'organizations', '_prisma_migrations',
];

const tables = createTableMatch.map(m => {
  const match = m.match(/CREATE TABLE\s+(?:"?(\w+)"?)/i);
  return match ? match[1] : null;
}).filter(Boolean);

const orgScopedTables = tables.filter(t => !globalTables.includes(t));

if (orgScopedTables.length > 0) {
  const hasRls = newContent.includes('ENABLE ROW LEVEL SECURITY');

  if (!hasRls) {
    console.warn('⚠️  REMINDER: New table(s) detected in migration: ' + orgScopedTables.join(', '));
    console.warn('   If these are org-scoped, you MUST add RLS policies:');
    console.warn('');
    orgScopedTables.forEach(table => {
      console.warn(`   ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      console.warn(`   ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
      console.warn(`   CREATE POLICY org_isolation ON ${table}`);
      console.warn(`     FOR ALL USING (organization_id = current_org_id())`);
      console.warn(`     WITH CHECK (organization_id = current_org_id());`);
      console.warn(`   GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO app_user;`);
      console.warn('');
    });
    console.warn('   Add these to packages/db/prisma/rls-policies.sql');
    console.warn('   Then run /db-reset to apply.');
  }
}

process.exit(0);
