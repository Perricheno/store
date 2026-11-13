#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative, sep } from 'node:path';

function fail(message) { throw new Error(message); }
function run(command, args) { return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
try {
  const flags = {};
  const options = new Set(['--env', '--version', '--manifest', '--commit', '--from-dev-tag']);
  for (let i = 2; i < process.argv.length; i++) {
    const key = process.argv[i];
    if (flags[key] !== undefined) fail(`Повторный параметр: ${key}`);
    if (options.has(key)) {
      const value = process.argv[++i];
      if (!value || value.startsWith('--')) fail(`Не указано значение ${key}`);
      flags[key] = value;
    } else if (['--tag', '--publish', '--tested'].includes(key)) flags[key] = true;
    else fail(`Неизвестный параметр: ${key}`);
  }
  const env = flags['--env'], version = flags['--version'], manifest = flags['--manifest'];
  if (!['dev', 'prod'].includes(env) || !/^\d+\.\d+\.\d+$/.test(version || '') || !manifest) fail('Использование: --env dev|prod --version X.Y.Z --manifest docs/releases/FILE.json [--commit SHA] [--tag] [--publish] [--from-dev-tag dev/vX.Y.Z --tested]');
  if (env === 'prod' && (!/^dev\/v\d+\.\d+\.\d+$/.test(flags['--from-dev-tag'] || '') || !flags['--tested'])) fail('Production требует --from-dev-tag dev/vX.Y.Z и явного подтверждения --tested.');
  const root = run('git', ['rev-parse', '--show-toplevel']);
  const rel = relative(root, resolve(manifest)).split(sep).join('/');
  if (!/^docs\/releases\/[\w.-]+\.json$/.test(rel)) fail('Манифест должен находиться в docs/releases/.');
  const ref = flags['--commit'] || (env === 'prod' ? flags['--from-dev-tag'] : 'HEAD');
  const sha = run('git', ['rev-parse', '--verify', `${ref}^{commit}`]);
  if (env === 'prod' && sha !== run('git', ['rev-parse', '--verify', `${flags['--from-dev-tag']}^{commit}`])) fail('Production должен указывать на коммит выбранного dev-тега.');
  const committed = run('git', ['show', `${sha}:${rel}`]);
  if (readFileSync(resolve(manifest), 'utf8').trim() !== committed) fail('Манифест должен совпадать с файлом в выпускаемом коммите.');
  const data = JSON.parse(committed);
  const categories = ['Added', 'Improved', 'Fixed', 'Changed', 'Removed'];
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(k => !categories.includes(k))) fail('Манифест содержит неизвестные поля.');
  for (const key of categories) if (!Array.isArray(data[key]) || data[key].some(item => typeof item !== 'string' || !item.trim() || /[\r\n]/.test(item))) fail(`Категория ${key} должна быть массивом непустых однострочных пунктов.`);
  const short = run('git', ['rev-parse', '--short=12', sha]);
  const title = `Urbanmag ${env} v${version} · ${short}`;
  const url = env === 'dev' ? 'https://dev-u.perricheno.com' : 'https://u.perricheno.com';
  const body = categories.map(key => `## ${key}\n\n${data[key].length ? data[key].map(x => `- ${x.trim()}`).join('\n') : '- Нет.'}`).join('\n\n') + `\n\nПодготовлено в ${env} · Urbanmag ${short}\n${url}\n`;
  const tag = `${env}/v${version}`;
  const dir = mkdtempSync(join(tmpdir(), 'urbanmag-release-'));
  try {
    const file = join(dir, 'notes.md');
    writeFileSync(file, body, { mode: 0o600 });
    if (flags['--tag']) run('git', ['tag', '-a', tag, sha, '-F', file]);
    if (flags['--publish']) {
      if (run('git', ['rev-parse', '--verify', `${tag}^{commit}`]) !== sha) fail('Локальный тег указывает на другой коммит.');
      run('gh', ['release', 'create', tag, '--verify-tag', '--title', title, '--notes-file', file, ...(env === 'dev' ? ['--prerelease'] : ['--latest'])]);
    }
    process.stdout.write(`# ${title}\n\n${body}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
} catch (error) {
  console.error(`Ошибка релиза: ${error.stderr?.toString().trim() || error.message}`);
  process.exitCode = 1;
}
