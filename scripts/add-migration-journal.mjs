#!/usr/bin/env node

/**
 * Adds a journal entry for a manually-created migration SQL file.
 *
 * Usage:
 *   node scripts/add-migration-journal.js <migration-name>
 *
 * Example:
 *   node scripts/add-migration-journal.js 0031_my_new_migration
 *
 * The script:
 * 1. Verifies the .sql file exists in packages/db/migrations/
 * 2. Checks the journal doesn't already have an entry for this tag
 * 3. Computes the next idx and a monotonic `when` timestamp
 * 4. Appends the entry and writes the journal
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(
  import.meta.dirname,
  '..',
  'packages',
  'db',
  'migrations',
);
const JOURNAL_PATH = join(MIGRATIONS_DIR, 'meta', '_journal.json');

const migrationName = process.argv[2];

if (!migrationName) {
  console.error('Usage: node scripts/add-migration-journal.js <migration-name>');
  console.error('Example: node scripts/add-migration-journal.js 0031_my_new_migration');
  process.exit(1);
}

// Strip .sql extension if provided
const tag = migrationName.replace(/\.sql$/, '');
const sqlFile = join(MIGRATIONS_DIR, `${tag}.sql`);

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

if (!existsSync(sqlFile)) {
  console.error(`ERROR: SQL file not found: ${sqlFile}`);
  console.error(`Create the migration file first, then run this script.`);
  process.exit(1);
}

if (!existsSync(JOURNAL_PATH)) {
  console.error('ERROR: _journal.json not found at', JOURNAL_PATH);
  process.exit(1);
}

const journal = JSON.parse(readFileSync(JOURNAL_PATH, 'utf-8'));
const entries = journal.entries || [];

const existing = entries.find((e) => e.tag === tag);
if (existing) {
  console.log(`Journal already has entry for "${tag}" at idx ${existing.idx}. Nothing to do.`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Compute next idx and timestamp
// ---------------------------------------------------------------------------

const nextIdx = entries.length;
const lastWhen = entries.length > 0 ? entries[entries.length - 1].when : Date.now();

// Use a timestamp 200M ms (~2.3 days) after the last entry, matching existing pattern
const nextWhen = lastWhen + 200_000_000;

const newEntry = {
  idx: nextIdx,
  version: '7',
  when: nextWhen,
  tag,
  breakpoints: true,
};

entries.push(newEntry);
journal.entries = entries;

writeFileSync(JOURNAL_PATH, JSON.stringify(journal, null, 2) + '\n');

console.log(`✅ Added journal entry for "${tag}" (idx ${nextIdx}, when ${nextWhen})`);
console.log(`   Run \`pnpm db:migrate\` to apply the migration.`);
