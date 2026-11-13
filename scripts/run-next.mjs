import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const mode = process.argv[2] || 'dev';
const args = ['node_modules/next/dist/bin/next', mode, 'apps/web'];
if (mode !== 'build') args.push('--hostname', '127.0.0.1');
const child = spawn(process.execPath, [...args, ...process.argv.slice(3)], { stdio: 'inherit', env: process.env });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 1));
