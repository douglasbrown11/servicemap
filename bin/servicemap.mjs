#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scanScript = resolve(packageRoot, 'servicemap/scripts/scan-project.mjs');
const pageScript = resolve(packageRoot, 'servicemap/scripts/generate-page.mjs');
const desktopScript = resolve(packageRoot, 'servicemap/scripts/generate-desktop-app.mjs');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    command: 'generate',
    root: process.cwd(),
    mode: 'auto',
    dryRun: false,
    agent: 'codex',
    skillsDir: null,
  };

  if (args[0] === 'skills' && args[1] === 'install') {
    options.command = 'install-skill';
    args.splice(0, 2);
  }

  if (args[0] && !args[0].startsWith('-')) {
    options.command = args.shift();
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--root') options.root = args[++index] ?? options.root;
    if (arg === '--mode') options.mode = args[++index] ?? options.mode;
    if (arg === '--agent') options.agent = args[++index] ?? options.agent;
    if (arg === '--skills-dir') options.skillsDir = resolve(args[++index] ?? '.');
    if (arg === '--user') options.user = true;
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
  servicemap install-skill [--agent codex|claude|grok|all] [--skills-dir <path>]
  servicemap skills install [--agent codex|claude|grok|all]

Examples:
  npx servicemap
  npx servicemap -- --root ../my-app
  npx servicemap install-skill
  npx servicemap install-skill --agent all
  npx servicemap skills install --agent claude
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

function skillRoots(options) {
  if (options.skillsDir) return [options.skillsDir];

  const roots = {
    codex: resolve(homedir(), '.agents/skills'),
    agents: resolve(homedir(), '.agents/skills'),
    claude: resolve(homedir(), '.claude/skills'),
    grok: resolve(homedir(), '.grok/skills'),
  };

  if (options.agent === 'all') {
    return [...new Set([roots.codex, roots.claude, roots.grok])];
  }

  if (!roots[options.agent]) {
    throw new Error(`Unknown agent "${options.agent}". Use codex, claude, grok, agents, or all.`);
  }

  return [roots[options.agent]];
}

async function installSkill(options) {
  const source = resolve(packageRoot, 'servicemap');
  const roots = skillRoots(options);

  if (!existsSync(source)) {
    throw new Error(`Bundled skill folder not found: ${source}`);
  }

  if (options.dryRun) {
    for (const root of roots) {
      console.log(`Would install Servicemap skill to ${join(root, 'servicemap')}`);
    }
    return;
  }

  for (const root of roots) {
    const destination = join(root, 'servicemap');
    await mkdir(root, { recursive: true });
    await rm(destination, { recursive: true, force: true });
    await cp(source, destination, { recursive: true });
    console.log(`Installed Servicemap skill to ${destination}`);
  }

  console.log('Restart your AI app if /servicemap does not appear immediately.');
}

async function main() {
  const options = parseArgs();
  if (options.help) {
    help();
    return;
  }

  if (options.command === 'install-skill' || options.command === 'install') {
    await installSkill(options);
    return;
  }

  if (options.command !== 'generate') {
    throw new Error(`Unknown command "${options.command}". Use generate, install-skill, or skills install.`);
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
