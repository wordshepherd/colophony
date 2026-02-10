#!/usr/bin/env node
const { execSync } = require('child_process');

console.log('🔄 Regenerating Prisma client...');
try {
  execSync('pnpm db:generate', { stdio: 'inherit' });
  console.log('✅ Prisma client updated');
} catch (error) {
  console.error('❌ Failed to generate Prisma client');
  process.exit(1);
}