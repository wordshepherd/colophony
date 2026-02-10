#!/usr/bin/env node

/**
 * Post-edit hook for email template files.
 * Reminds to generate text version when HTML email template is modified.
 */

const newContent = process.env.CLAUDE_TOOL_ARGS_new_str || '';
const filePath = process.env.CLAUDE_TOOL_ARGS_file_path || '';

// Only check email template files
if (!filePath.includes('email') || !filePath.includes('template')) {
  process.exit(0);
}

// Check if this looks like an email template method
const hasHtmlTemplate = newContent.includes('html:') || newContent.includes('<p>') || newContent.includes('<div>');
const hasTextVersion = newContent.includes('text:');

if (hasHtmlTemplate && !hasTextVersion) {
  console.warn('⚠️  REMINDER: Email template has HTML but may be missing text version.');
  console.warn('   Always provide both html and text properties for email accessibility.');
  console.warn('');
  console.warn('   Pattern:');
  console.warn('   return {');
  console.warn('     subject: "...",');
  console.warn('     html: "<html>...</html>",');
  console.warn('     text: "Plain text version for email clients that don\'t support HTML"');
  console.warn('   };');
}

// Check for XSS protection
if (hasHtmlTemplate) {
  const hasUserInput =
    newContent.includes('userName') ||
    newContent.includes('${') ||
    newContent.includes('` +');

  const hasEscaping =
    newContent.includes('escapeHtml') ||
    newContent.includes('sanitize') ||
    newContent.includes('encode');

  if (hasUserInput && !hasEscaping) {
    console.warn('⚠️  WARNING: User input in HTML template without escaping.');
    console.warn('   Use escapeHtml() to prevent XSS in email templates.');
    console.warn('');
    console.warn('   Example:');
    console.warn('   private escapeHtml(str: string): string {');
    console.warn('     return str');
    console.warn('       .replace(/&/g, "&amp;")');
    console.warn('       .replace(/</g, "&lt;")');
    console.warn('       .replace(/>/g, "&gt;")');
    console.warn('       .replace(/"/g, "&quot;")');
    console.warn('       .replace(/\'/g, "&#039;");');
    console.warn('   }');
  }
}

process.exit(0);
