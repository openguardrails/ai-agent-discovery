#!/usr/bin/env node

import('../dist/cli.js').catch((err) => {
  console.error('Failed to load AI Agent Discovery CLI:', err.message);
  console.error('Please run "npm run build" first.');
  process.exit(1);
});
