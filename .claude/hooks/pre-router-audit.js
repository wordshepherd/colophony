#!/usr/bin/env node

/**
 * Pre-edit hook for tRPC router files.
 * Warns if sensitive operations are missing audit logging.
 */

const newContent = process.env.CLAUDE_TOOL_ARGS_new_str || '';
const filePath = process.env.CLAUDE_TOOL_ARGS_file_path || '';

// Only check router files
if (!filePath.includes('/routers/') || !filePath.endsWith('.router.ts')) {
  process.exit(0);
}

// Sensitive operations that should be audited
const sensitivePatterns = [
  { pattern: /\.status\s*[=:]\s*['"](?:ACCEPTED|REJECTED|UNDER_REVIEW)/i, action: 'status transition' },
  { pattern: /\.delete\(|\.deleteMany\(/i, action: 'deletion' },
  { pattern: /payment\.create|checkout.*session/i, action: 'payment creation' },
  { pattern: /deleteUserData|erasure|anonymize/i, action: 'GDPR erasure' },
  { pattern: /role\s*[=:]\s*['"](?:ADMIN|EDITOR)/i, action: 'role change' },
];

const hasSensitiveOp = sensitivePatterns.find(({ pattern }) => pattern.test(newContent));
const hasAuditLog =
  newContent.includes('auditService') ||
  newContent.includes('audit.log') ||
  newContent.includes('AuditActions');

if (hasSensitiveOp && !hasAuditLog) {
  console.warn(`⚠️  WARNING: Router contains ${hasSensitiveOp.action} but no audit logging.`);
  console.warn('   GDPR Article 30 requires logging all sensitive actions.');
  console.warn('   Add: await auditService.log({ action: AuditActions.XXX, ... })');
  console.warn('   See: apps/api/src/modules/audit/audit.service.ts for available actions.');
}

process.exit(0);
