import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

async function main() {
  // Explicit environment variables win; never load local credentials into a production process.
  if (process.env.APP_ENV !== 'production' && !process.env.DATABASE_URL && existsSync(resolve('.env.local'))) {
    process.loadEnvFile(resolve('.env.local'));
  }
  const { initCore, closeCore } = await import('@urbanmag/core');
  try {
    await initCore();
    console.log('Database schema and initial data are ready.');
  } finally {
    await closeCore();
  }
}
main().catch(() => { console.error('Database initialization failed. Check configuration and database availability.'); process.exitCode = 1; });
