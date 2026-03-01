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

// Warn about outbound fetch without SSRF validation
const filePath = process.env.CLAUDE_TOOL_ARGS_file_path || '';
const userUrlVars = ['endpointUrl', 'webhookUrl', 'callbackUrl', 'targetUrl'];
const hasFetch = newContent.includes('fetch(');
const hasUserUrl = userUrlVars.some(v => newContent.includes(v));
const hasSsrfGuard =
  newContent.includes('validateOutboundUrl') ||
  newContent.includes('resolveAndCheckPrivateIp');

if (hasFetch && hasUserUrl && !hasSsrfGuard) {
  console.warn('⚠️  WARNING: fetch() with user-controlled URL detected without SSRF validation.');
  console.warn('   Use validateOutboundUrl() from apps/api/src/lib/url-validation.ts');
}

// Warn about unused orgId in service/worker files
const isServiceOrWorker = filePath.includes('/services/') || filePath.includes('/workers/');
if (isServiceOrWorker && newContent.includes('_orgId')) {
  console.warn('⚠️  WARNING: Unused _orgId parameter detected in service/worker file.');
  console.warn('   Organization ID should be used for explicit filtering (defense-in-depth with RLS).');
}

process.exit(0);
