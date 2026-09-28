#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scanScript = resolve(packageRoot, 'servicemap/scripts/scan-project.mjs');
const pageScript = resolve(packageRoot, 'servicemap/scripts/generate-page.mjs');
const desktopScript = resolve(packageRoot, 'servicemap/scripts/generate-desktop-app.mjs');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    root: process.cwd(),
    mode: 'auto',
    dryRun: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--root') options.root = args[++index] ?? options.root;
    if (arg === '--mode') options.mode = args[++index] ?? options.mode;
    if (arg === '--dry-run') options.dryRun = true;
    if (arg === '--help' || arg === '-h') options.help = true;
  }

  options.root = resolve(options.root);
  return options;
}

function help() {
  console.log(`Servicemap

Usage:
  servicemap [--root <project>] [--mode auto|page|desktop] [--dry-run]

Examples:
  npx servicemap
  npx servicemap -- --root ../my-app
  servicemap --mode desktop
`);
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function readScan(root) {
  const scanPath = resolve(root, '.servicemap/internal-servicemap.json');
  return JSON.parse(await readFile(scanPath, 'utf8'));
}

async function main() {
  const options = parseArgs();
  if (options.help) {
    help();
    return;
  }

  if (!['auto', 'page', 'desktop'].includes(options.mode)) {
    throw new Error(`Unknown mode "${options.mode}". Use auto, page, or desktop.`);
  }

  await run(process.execPath, [scanScript, '--root', options.root]);
  const scan = await readScan(options.root);
  const selectedMode = options.mode === 'auto'
    ? scan.project?.framework === 'static' ? 'desktop' : 'page'
    : options.mode;

  console.log(`Servicemap detected ${scan.summary?.serviceCount ?? 0} services.`);
  console.log(`Framework: ${scan.project?.framework ?? 'unknown'}`);
  console.log(`Mode: ${selectedMode}`);

  if (options.dryRun) return;

  if (selectedMode === 'desktop') {
    await run(process.execPath, [desktopScript, '--root', options.root]);
  } else {
    await run(process.execPath, [pageScript, '--root', options.root]);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
