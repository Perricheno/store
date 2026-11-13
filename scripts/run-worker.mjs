import { existsSync } from 'node:fs';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
if(!process.env.DATABASE_URL)throw new Error('A separate worker needs PostgreSQL. Start the Compose environment; the embedded preview database only supports one process.');
await import('../apps/worker/src/index.ts');
