#!/usr/bin/env node

/**
 * Pre-edit hook for route handler files.
 * Warns if sensitive operations are missing audit logging.
 */

const newContent = process.env.CLAUDE_TOOL_ARGS_new_str || '';
const filePath = process.env.CLAUDE_TOOL_ARGS_file_path || '';

// Only check route files (Fastify routes and ts-rest handlers)
const isRouteFile =
  filePath.includes('/routes/') ||
  filePath.includes('/handlers/') ||
  filePath.includes('.route.ts') ||
  filePath.includes('.handler.ts');

if (!isRouteFile) {
  process.exit(0);
}

// Sensitive operations that should be audited
const sensitivePatterns = [
  { pattern: /\.status\s*[=:]\s*['"](?:ACCEPTED|REJECTED|UNDER_REVIEW)/i, action: 'status transition' },
  { pattern: /\.delete\(|db\.delete\(/i, action: 'deletion' },
  { pattern: /insert\(payments\)|checkout.*session/i, action: 'payment creation' },
  { pattern: /deleteUserData|erasure|anonymize/i, action: 'GDPR erasure' },
  { pattern: /role\s*[=:]\s*['"](?:ADMIN|EDITOR)/i, action: 'role change' },
];

const hasSensitiveOp = sensitivePatterns.find(({ pattern }) => pattern.test(newContent));
const hasAuditLog =
  newContent.includes('auditService') ||
  newContent.includes('audit.log') ||
  newContent.includes('AuditActions') ||
  newContent.includes('logAuditEvent');

if (hasSensitiveOp && !hasAuditLog) {
  console.warn(`⚠️  WARNING: Route contains ${hasSensitiveOp.action} but no audit logging.`);
  console.warn('   GDPR Article 30 requires logging all sensitive actions.');
  console.warn('   Add: await auditService.log({ action: AuditActions.XXX, ... })');
  console.warn('   See: apps/api/src/services/audit.service.ts for available actions.');
}

process.exit(0);
