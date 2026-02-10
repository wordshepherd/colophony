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

// Warn about missing RLS context
const prismaQueryMethods = [
  'findMany', 'findFirst', 'findUnique', 'findFirstOrThrow', 'findUniqueOrThrow',
  'create', 'createMany', 'update', 'updateMany', 'upsert',
  'delete', 'deleteMany', 'count', 'aggregate', 'groupBy',
];

if (newContent.includes('prisma.')) {
  const hasPrismaQuery = prismaQueryMethods.some(method => newContent.includes(method));
  if (hasPrismaQuery && !newContent.includes('withOrgContext') && !newContent.includes('$transaction')) {
    console.warn('⚠️  WARNING: Prisma query without RLS context (withOrgContext or $transaction).');
    console.warn('   All org-scoped queries must go through withOrgContext() — see packages/db/src/context.ts');
  }
}

process.exit(0);