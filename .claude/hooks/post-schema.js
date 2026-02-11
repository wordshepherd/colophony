#!/usr/bin/env node

/**
 * Post-edit hook for Drizzle schema files.
 * Reminds to generate a migration after schema changes.
 */

console.log('📋 Drizzle schema changed. Remember to:');
console.log('   1. Run `pnpm db:generate` to generate a migration');
console.log('   2. Review the generated SQL in packages/db/drizzle/');
console.log('   3. Run `pnpm db:migrate` to apply it');
console.log('   4. If you added a new table, add pgPolicy for RLS in the schema');
