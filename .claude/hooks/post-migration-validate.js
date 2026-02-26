#!/usr/bin/env node

/**
 * Post-edit hook for migration files.
 *
 * 1. Reminds to add RLS policies when a new table is created.
 * 2. Validates that the migration SQL file has a corresponding journal entry.
 */

const fs = require('fs');
const path = require('path');

const filePath = process.env.CLAUDE_TOOL_ARGS_file_path || '';
const newContent = process.env.CLAUDE_TOOL_ARGS_new_str || process.env.CLAUDE_TOOL_ARGS_content || '';

// ---------------------------------------------------------------------------
// Check 1: RLS policy reminder for CREATE TABLE
// ---------------------------------------------------------------------------

const createTableMatch = newContent.match(/CREATE TABLE\s+(?:"?(\w+)"?)/gi);

if (createTableMatch) {
  const globalTables = [
    'users', 'user_identities', 'organizations', '_prisma_migrations',
  ];

  const tables = createTableMatch.map(function (m) {
    const match = m.match(/CREATE TABLE\s+(?:"?(\w+)"?)/i);
    return match ? match[1] : null;
  }).filter(Boolean);

  const orgScopedTables = tables.filter(function (t) { return !globalTables.includes(t); });

  if (orgScopedTables.length > 0) {
    const hasRls = newContent.includes('ENABLE ROW LEVEL SECURITY');

    if (!hasRls) {
      console.warn('⚠️  REMINDER: New table(s) detected in migration: ' + orgScopedTables.join(', '));
      console.warn('   If these are org-scoped, you MUST add RLS policies:');
      console.warn('');
      orgScopedTables.forEach(function (table) {
        console.warn('   ALTER TABLE ' + table + ' ENABLE ROW LEVEL SECURITY;');
        console.warn('   ALTER TABLE ' + table + ' FORCE ROW LEVEL SECURITY;');
        console.warn('   CREATE POLICY org_isolation ON ' + table);
        console.warn('     FOR ALL USING (organization_id = current_setting(\'app.current_org\')::uuid)');
        console.warn('     WITH CHECK (organization_id = current_setting(\'app.current_org\')::uuid);');
        console.warn('   GRANT SELECT, INSERT, UPDATE, DELETE ON ' + table + ' TO app_user;');
        console.warn('');
      });
      console.warn('   Add these to packages/db/prisma/rls-policies.sql');
      console.warn('   Then run /db-reset to apply.');
    }
  }
}

// ---------------------------------------------------------------------------
// Check 2: Journal entry exists for this migration file
// ---------------------------------------------------------------------------

if (filePath && filePath.endsWith('.sql') && filePath.includes('migrations')) {
  const filename = path.basename(filePath, '.sql');

  // Skip meta files
  if (!filename.startsWith('_')) {
    const migIdx = filePath.lastIndexOf('/migrations/');
    if (migIdx !== -1) {
      const migrationsDir = filePath.substring(0, migIdx + '/migrations/'.length);
      const journalPath = path.join(migrationsDir, 'meta', '_journal.json');

      if (fs.existsSync(journalPath)) {
        try {
          const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
          const entries = journal.entries || [];
          const hasEntry = entries.some(function (e) { return e.tag === filename; });

          if (!hasEntry) {
            console.warn('');
            console.warn('⚠️  JOURNAL ENTRY MISSING: No _journal.json entry for "' + filename + '"');
            console.warn('   Drizzle migrate() will SILENTLY SKIP this migration without a journal entry.');
            console.warn('');
            console.warn('   Fix with:');
            console.warn('     node scripts/add-migration-journal.mjs ' + filename);
            console.warn('');
            console.warn('   Or validate all migrations:');
            console.warn('     node scripts/validate-migrations.mjs');
            console.warn('');
          }
        } catch (e) {
          // Journal parse error — don't block the edit
        }
      }
    }
  }
}

process.exit(0);
