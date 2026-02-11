#!/usr/bin/env node

const newContent = process.env.CLAUDE_TOOL_ARGS_new_str || '';

// Check for secrets
const secretPatterns = [
  /sk_live_[a-zA-Z0-9]+/,
  /-----BEGIN (RSA )?PRIVATE KEY-----/,
  /password\s*[:=]\s*['"][^'"]{8,}['"]/i,
];

for (const pattern of secretPatterns) {
  if (pattern.test(newContent)) {
    console.error('❌ BLOCKED: Potential secret detected');
    process.exit(2);
  }
}

// Warn about missing RLS context for Drizzle queries
const drizzleQueryMethods = [
  '.select(', '.insert(', '.update(', '.delete(',
  '.query.',
];

const hasDrizzleQuery = drizzleQueryMethods.some(method => newContent.includes(method));
const hasDbPrefix = newContent.includes('db.') || newContent.includes('tx.');

if (hasDbPrefix && hasDrizzleQuery) {
  const hasRlsContext =
    newContent.includes('withOrgContext') ||
    newContent.includes('withRLS') ||
    newContent.includes('SET LOCAL') ||
    newContent.includes('set_config');

  if (!hasRlsContext) {
    console.warn('⚠️  WARNING: Drizzle query without RLS context (withOrgContext, withRLS, or SET LOCAL).');
    console.warn('   All org-scoped queries must set SET LOCAL app.current_org inside a transaction.');
    console.warn('   RLS policies are defined via pgPolicy in packages/db/src/schema/');
  }
}

process.exit(0);
