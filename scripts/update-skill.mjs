import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cp, mkdir, mkdtemp, readFile, realpath, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile);
const registry = 'https://registry.npmjs.org';
async function npm(args) {
  const { stdout } = await exec(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { timeout: 120000, maxBuffer: 1024 * 1024 });
  return stdout;
}
function newer(next, current) {
  if (!/^\d+\.\d+\.\d+$/.test(next)) throw new Error(`Unsupported release version: ${next}`);
  if (!/^\d+\.\d+\.\d+$/.test(current ?? '')) return true;
  const a = next.split('.').map(Number), b = current.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
export async function updateSkill(destination, { runNpm = npm, allowCheckout = false } = {}) {
  const root = existsSync(destination) ? await realpath(destination) : resolve(destination);
  if (!allowCheckout && (existsSync(join(root, '.git')) || existsSync(join(dirname(root), '.git')))) {
    return 'Skipped update of development checkout.';
  }
  await mkdir(dirname(root), { recursive: true });
  const lock = `${root}.update-lock`;
  try { await mkdir(lock); } catch (error) {
    if (error.code === 'EEXIST') return 'Another update is running; using installed copy.';
    throw error;
  }
  let staging;
  try {
    const latest = JSON.parse(await runNpm(['view', 'servicemap@latest', 'version', '--json', `--registry=${registry}`]));
    let current;
    try { current = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version; } catch {}
    if (!newer(latest, current)) return `ServiceMap ${current} is current.`;
    staging = await mkdtemp(join(dirname(root), '.servicemap-update-'));
    await runNpm(['install', '--prefix', staging, `servicemap@${latest}`, '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', `--registry=${registry}`]);
    const source = join(staging, 'node_modules', 'servicemap');
    const manifest = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
    if (manifest.name !== 'servicemap' || manifest.version !== latest) throw new Error('Downloaded package identity mismatch');
    for (const file of ['SKILL.md', 'bin/servicemap.mjs', 'scripts/update-skill.mjs']) {
      if (!existsSync(join(source, file))) throw new Error(`Release missing ${file}`);
    }
    const ready = join(staging, 'ready');
    await cp(source, ready, { recursive: true });
    const backup = join(staging, 'previous');
    const hadPrevious = existsSync(root);
    if (hadPrevious) await rename(root, backup);
    try { await rename(ready, root); } catch (error) {
      if (hadPrevious) await rename(backup, root);
      throw error;
    }
    return `Updated ServiceMap to ${latest}. Re-read ${join(root, 'SKILL.md')}.`;
  } finally {
    if (staging) await rm(staging, { recursive: true, force: true });
    await rm(lock, { recursive: true, force: true });
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(await updateSkill(resolve(dirname(fileURLToPath(import.meta.url)), '..'))); }
  catch (error) { console.error(`ServiceMap update failed; installed copy retained: ${error.message}`); process.exitCode = 1; }
}
