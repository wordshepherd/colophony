#!/usr/bin/env node

/**
 * Validates that migration SQL files and _journal.json are in sync.
 *
 * Checks:
 * 1. Every .sql file in migrations/ has a corresponding journal entry
 * 2. Every journal entry has a corresponding .sql file
 * 3. Journal idx values are sequential (0, 1, 2, ...)
 * 4. Journal `when` timestamps are monotonically non-decreasing
 * 5. Journal tags match the SQL filename (without .sql extension)
 *
 * Usage:
 *   node scripts/validate-migrations.js [--fix]
 *
 * --fix: Auto-add missing journal entries for orphaned SQL files
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';

const MIGRATIONS_DIR = join(
  import.meta.dirname,
  '..',
  'packages',
  'db',
  'migrations',
);
const JOURNAL_PATH = join(MIGRATIONS_DIR, 'meta', '_journal.json');

const fix = process.argv.includes('--fix');

let exitCode = 0;
const errors = [];
const warnings = [];

function error(msg) {
  errors.push(msg);
  exitCode = 1;
}

function warn(msg) {
  warnings.push(msg);
}

// ---------------------------------------------------------------------------
// 1. Load journal
// ---------------------------------------------------------------------------

if (!existsSync(JOURNAL_PATH)) {
  console.error('ERROR: _journal.json not found at', JOURNAL_PATH);
  process.exit(1);
}

const journal = JSON.parse(readFileSync(JOURNAL_PATH, 'utf-8'));
const entries = journal.entries || [];

// ---------------------------------------------------------------------------
// 2. Load SQL files
// ---------------------------------------------------------------------------

const sqlFiles = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const sqlTags = new Set(sqlFiles.map((f) => f.replace(/\.sql$/, '')));
const journalTags = new Set(entries.map((e) => e.tag));

// ---------------------------------------------------------------------------
// 3. Check for orphaned SQL files (no journal entry)
// ---------------------------------------------------------------------------

const orphanedSql = [...sqlTags].filter((tag) => !journalTags.has(tag));

if (orphanedSql.length > 0) {
  if (fix) {
    // Auto-add missing journal entries
    let nextIdx = entries.length;
    let lastWhen =
      entries.length > 0 ? entries[entries.length - 1].when : Date.now();

    for (const tag of orphanedSql) {
      lastWhen += 200_000_000; // ~2.3 day gap
      const newEntry = {
        idx: nextIdx,
        version: '7',
        when: lastWhen,
        tag,
        breakpoints: true,
      };
      entries.push(newEntry);
      console.log(`FIXED: Added journal entry for ${tag} (idx ${nextIdx})`);
      nextIdx++;
    }

    // Re-sort entries by tag to maintain numeric order
    entries.sort((a, b) => a.tag.localeCompare(b.tag, undefined, { numeric: true }));

    // Re-index after sort
    entries.forEach((e, i) => {
      e.idx = i;
    });

    journal.entries = entries;
    writeFileSync(JOURNAL_PATH, JSON.stringify(journal, null, 2) + '\n');
    console.log('Journal updated.');
  } else {
    for (const tag of orphanedSql) {
      error(
        `ORPHAN: ${tag}.sql exists but has no journal entry. Run with --fix to auto-add.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Check for phantom journal entries (no SQL file)
// ---------------------------------------------------------------------------

const phantomEntries = [...journalTags].filter((tag) => !sqlTags.has(tag));

for (const tag of phantomEntries) {
  error(`PHANTOM: Journal entry for "${tag}" has no corresponding .sql file.`);
}

// ---------------------------------------------------------------------------
// 5. Check sequential idx
// ---------------------------------------------------------------------------

for (let i = 0; i < entries.length; i++) {
  if (entries[i].idx !== i) {
    error(
      `IDX GAP: Entry "${entries[i].tag}" has idx ${entries[i].idx}, expected ${i}.`,
    );
  }
}

// ---------------------------------------------------------------------------
// 6. Check monotonic timestamps
// ---------------------------------------------------------------------------

for (let i = 1; i < entries.length; i++) {
  if (entries[i].when < entries[i - 1].when) {
    warn(
      `TIMESTAMP: Entry "${entries[i].tag}" (when: ${entries[i].when}) has an earlier timestamp than "${entries[i - 1].tag}" (when: ${entries[i - 1].when}).`,
    );
  }
}

// ---------------------------------------------------------------------------
// 7. Check tag matches expected filename pattern
// ---------------------------------------------------------------------------

for (const entry of entries) {
  const expectedFile = `${entry.tag}.sql`;
  if (!sqlFiles.includes(expectedFile) && !phantomEntries.includes(entry.tag)) {
    // Already caught in phantom check
  }
  if (entry.version !== '7') {
    warn(
      `VERSION: Entry "${entry.tag}" has version "${entry.version}", expected "7".`,
    );
  }
}

// ---------------------------------------------------------------------------
// 8. Report
// ---------------------------------------------------------------------------

if (warnings.length > 0) {
  console.warn('\nWarnings:');
  for (const w of warnings) {
    console.warn(`  ⚠️  ${w}`);
  }
}

if (errors.length > 0) {
  console.error('\nErrors:');
  for (const e of errors) {
    console.error(`  ❌ ${e}`);
  }
  console.error(
    `\n${errors.length} error(s) found. Fix these before running migrations.`,
  );
} else if (!fix) {
  console.log(
    `✅ Migration journal is consistent. ${sqlFiles.length} SQL files, ${entries.length} journal entries.`,
  );
}

process.exit(exitCode);
