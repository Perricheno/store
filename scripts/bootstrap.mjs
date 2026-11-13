import { randomBytes } from 'node:crypto';
import { mkdir, open, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = join(root, '.env.local');
const secretsDir = join(root, '.secrets');
const credentialsPath = join(secretsDir, 'local-credentials.txt');
async function exists(path) {
  try { await access(path, constants.F_OK); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
if (await exists(envPath) || await exists(credentialsPath)) {
  console.error('Local configuration already exists; refusing to overwrite it.');
  process.exit(1);
}
await mkdir(secretsDir, { recursive: true, mode: 0o700 });
const email = 'owner@urbanmag.local';
const password = randomBytes(24).toString('base64url');
const secret = () => randomBytes(32).toString('hex');
const config = [
  'APP_ENV=development',
  'APIPAY_MODE=mock',
  'APP_URL=http://localhost:3000',
  'STAFF_URL=http://localhost:3000',
  `PGLITE_DATA_DIR=${JSON.stringify(join(root, '.data', 'local'))}`,
  `APP_SECRET=${secret()}`,
  `MAIL_ENCRYPTION_KEY=${secret()}`,
  `BOOTSTRAP_OWNER_EMAIL=${email}`,
  `BOOTSTRAP_OWNER_PASSWORD=${password}`,
  '',
].join('\n');
const envFile = await open(envPath, 'wx', 0o600);
try { await envFile.writeFile(config); } finally { await envFile.close(); }
const credentials = await open(credentialsPath, 'wx', 0o600);
try { await credentials.writeFile(`Local owner email: ${email}\nLocal owner password: ${password}\nChange the password when signing in.\n`); } finally { await credentials.close(); }
console.log('Created .env.local and .secrets/local-credentials.txt with private local credentials.');
console.log('Run npm run db:migrate, then npm run dev.');
