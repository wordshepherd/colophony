#!/usr/bin/env node

/**
 * Pre-edit validation for frontend files
 *
 * Checks for:
 * 1. Missing 'use client' directive in interactive components
 * 2. tRPC queries without organization context awareness
 * 3. Incorrect import paths for shadcn components
 * 4. Missing error handling patterns
 */

const fs = require('fs');

const filePath = process.env.CLAUDE_TOOL_ARGS_file_path || '';
const newContent = process.env.CLAUDE_TOOL_ARGS_new_str || process.env.CLAUDE_TOOL_ARGS_content || '';

// Check if this is a component file
const isComponent = filePath.includes('/components/') && filePath.endsWith('.tsx');
const isPage = filePath.includes('/app/') && filePath.endsWith('page.tsx');
const isHook = filePath.includes('/hooks/') && filePath.endsWith('.ts');

const warnings = [];
const errors = [];

// Check for 'use client' in components that need it
if (isComponent || isPage) {
  const hasUseClient = newContent.includes("'use client'") || newContent.includes('"use client"');
  const hasInteractivePatterns =
    newContent.includes('useState') ||
    newContent.includes('useEffect') ||
    newContent.includes('onClick') ||
    newContent.includes('onChange') ||
    newContent.includes('onSubmit') ||
    newContent.includes('trpc.');

  if (hasInteractivePatterns && !hasUseClient) {
    warnings.push("Interactive component missing 'use client' directive. Add it at the top of the file.");
  }
}

// Check for incorrect shadcn import paths
if (newContent.includes("from '@/components/button'") ||
    newContent.includes("from '@/components/input'") ||
    newContent.includes("from '@/components/card'")) {
  warnings.push("Import shadcn components from '@/components/ui/*' not '@/components/*'");
}

// Check for tRPC queries that might need organization context
if (newContent.includes('trpc.') && newContent.includes('.useQuery')) {
  if (!newContent.includes('useOrganization') &&
      !newContent.includes('currentOrg') &&
      (newContent.includes('submissions') ||
       newContent.includes('files') ||
       newContent.includes('payments'))) {
    warnings.push("tRPC query for org-scoped data. Consider using useOrganization() to verify context.");
  }
}

// Check for form components missing error handling
if (newContent.includes('useForm') || newContent.includes('onSubmit')) {
  if (!newContent.includes('setError') && !newContent.includes('error') && !newContent.includes('Alert')) {
    warnings.push("Form component missing error state handling. Consider adding error display.");
  }
}

// Check for hooks that don't start with 'use'
if (isHook) {
  const exportMatch = newContent.match(/export\s+function\s+(\w+)/);
  if (exportMatch && !exportMatch[1].startsWith('use')) {
    warnings.push(`Hook function '${exportMatch[1]}' should start with 'use' prefix.`);
  }
}

// Output warnings
if (warnings.length > 0) {
  console.log('Frontend validation warnings:');
  warnings.forEach(w => console.log(`  ⚠️  ${w}`));
}

if (errors.length > 0) {
  console.log('Frontend validation errors:');
  errors.forEach(e => console.log(`  ❌  ${e}`));
  process.exit(2); // Block the edit
}

// Exit with 0 to allow the edit (warnings don't block)
process.exit(0);
