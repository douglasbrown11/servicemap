#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scanScript = resolve(packageRoot, 'servicemap/scripts/scan-project.mjs');
const pageScript = resolve(packageRoot, 'servicemap/scripts/generate-page.mjs');
const desktopScript = resolve(packageRoot, 'servicemap/scripts/generate-desktop-app.mjs');

const universalRoot = () => resolve(homedir(), '.agents/skills');

const universalAgents = [
  'Amp',
  'Cline',
  'Codex',
  'Cursor',
  'Gemini CLI',
  'GitHub Copilot',
  'OpenCode',
  'Warp',
  'Zed',
];

const targetCatalog = [
  { id: 'claude', label: 'Claude Code', root: () => resolve(homedir(), '.claude/skills') },
  { id: 'grok', label: 'Grok', root: () => resolve(homedir(), '.grok/skills') },
  { id: 'aiderdesk', label: 'AiderDesk', root: () => resolve(homedir(), '.aider-desk/skills') },
  { id: 'astrbot', label: 'AstrBot', root: () => resolve(homedir(), '.astrbot/data/skills') },
  { id: 'autohand', label: 'Autohand Code CLI', root: () => resolve(homedir(), '.autohand/skills') },
  { id: 'augment', label: 'Augment', root: () => resolve(homedir(), '.augment/skills') },
  { id: 'ibm-bob', label: 'IBM Bob', root: () => resolve(homedir(), '.bob/skills') },
  { id: 'openclaw', label: 'OpenClaw', root: () => resolve(homedir(), '.openclaw/skills') },
  { id: 'codearts', label: 'CodeArts Agent', root: () => resolve(homedir(), '.codeartsdoer/skills') },
  { id: 'roo-code', label: 'Roo Code', root: () => resolve(homedir(), '.roo/skills') },
  { id: 'continue', label: 'Continue', root: () => resolve(homedir(), '.continue/skills') },
  { id: 'windsurf', label: 'Windsurf', root: () => resolve(homedir(), '.windsurf/skills') },
  { id: 'replit-agent', label: 'Replit Agent', root: () => resolve(homedir(), '.replit/skills') },
  { id: 'jetbrains-ai', label: 'JetBrains AI', root: () => resolve(homedir(), '.jetbrains-ai/skills') },
];

const targetAliases = new Map([
  ['codex', 'universal'],
  ['agents', 'universal'],
  ['universal', 'universal'],
  ['cursor', 'universal'],
  ['cline', 'universal'],
  ['opencode', 'universal'],
  ['zed', 'universal'],
  ['github-copilot', 'universal'],
  ['copilot', 'universal'],
  ['gemini-cli', 'universal'],
  ['chatgpt', 'universal'],
  ['openai', 'universal'],
  ['openai-api', 'universal'],
  ['gpt-6-astra', 'universal'],
  ['gpt-6-sol', 'universal'],
  ['gpt-6-luna', 'universal'],
  ['gpt-5.6-sol', 'universal'],
  ['gpt-5.6-terra', 'universal'],
  ['gpt-5.6-luna', 'universal'],
  ['anthropic', 'claude'],
  ['anthropic-api', 'claude'],
  ['claude-opus', 'claude'],
  ['claude-sonnet', 'claude'],
  ['claude-haiku', 'claude'],
  ['xai', 'grok'],
]);

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    command: 'generate',
    root: process.cwd(),
    mode: 'auto',
    dryRun: false,
    agent: 'codex',
    targets: null,
    skillsDir: null,
    allowedEmails: [],
    invokedWithoutArgs: args.length === 0,
    explicitCommand: false,
    generationRequested: false,
  };

  if (args[0] === 'skills' && args[1] === 'install') {
    options.command = 'install-skill';
    args.splice(0, 2);
  }

  if (args[0] && !args[0].startsWith('-')) {
    options.command = args.shift();
    options.explicitCommand = true;
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--root') {
      options.root = args[++index] ?? options.root;
      options.generationRequested = true;
    }
    if (arg === '--mode') {
      options.mode = args[++index] ?? options.mode;
      options.generationRequested = true;
    }
    if (arg === '--agent') options.agent = args[++index] ?? options.agent;
    if (arg === '--targets') options.targets = (args[++index] ?? '').split(',').map((target) => target.trim()).filter(Boolean);
    if (arg === '--allow-email') {
      options.allowedEmails.push(args[++index] ?? '');
      options.generationRequested = true;
    }
    if (arg === '--allow-emails') {
      options.allowedEmails.push(...(args[++index] ?? '').split(','));
      options.generationRequested = true;
    }
    if (arg === '--skills-dir') options.skillsDir = resolve(args[++index] ?? '.');
    if (arg === '--user') options.user = true;
    if (arg === '--survey') options.survey = true;
    if (arg === '--yes' || arg === '-y') options.yes = true;
    if (arg === '--dry-run') options.dryRun = true;
    if (arg === '--help' || arg === '-h') options.help = true;
  }

  options.root = resolve(options.root);
  return options;
}

function help() {
  console.log(`Servicemap

Usage:
  servicemap
  servicemap generate [--root <project>] [--mode auto|page|desktop] [--allow-emails <list>] [--dry-run]
  servicemap --root <project> [--mode auto|page|desktop] [--allow-emails <list>] [--dry-run]
  servicemap install-skill [--survey] [--agent codex|claude|grok|all] [--targets <ids>]
  servicemap skills install [--survey] [--agent codex|claude|grok|all]

Examples:
  npx servicemap
  npx servicemap generate --root ../my-app --allow-emails founder@example.com,ops@example.com
  npx servicemap -- --root ../my-app
  npx servicemap install-skill
  npx servicemap install-skill --survey
  npx servicemap install-skill --agent all
  npx servicemap install-skill --targets codex,claude,cursor
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

function targetsByIds(ids) {
  const byId = new Map(targetCatalog.map((target) => [target.id, target]));
  const targets = [];
  let includeUniversal = false;

  for (const id of ids) {
    const resolvedId = targetAliases.get(id) ?? id;
    if (resolvedId === 'universal') {
      includeUniversal = true;
      continue;
    }
    const target = byId.get(resolvedId);
    if (!target) {
      throw new Error(`Unknown target "${id}". Use --survey to choose from the list.`);
    }
    targets.push(target);
  }

  if (includeUniversal) {
    targets.unshift({ id: 'universal', label: 'Universal', root: universalRoot });
  }

  return targets;
}

function targetsForOptions(options) {
  if (options.targets?.length) return targetsByIds(options.targets);
  if (options.agent === 'all') return [{ id: 'universal', label: 'Universal', root: universalRoot }, ...targetCatalog];
  return targetsByIds([options.agent]);
}

function skillRootsForTargets(options, targets) {
  if (options.skillsDir && targets.length) return [options.skillsDir];
  return [...new Set(targets.map((target) => target.root()))];
}

function renderSurvey(selected, cursor) {
  console.clear();
  console.log('Which agents do you want to install Servicemap to?\n');
  console.log('— Universal (.agents/skills) — always included —');
  for (const agent of universalAgents) {
    console.log(`  • ${agent}`);
  }
  console.log('\n— Additional agents —');
  console.log('Use ↑/↓, Space to select, Enter to install.\n');

  targetCatalog.forEach((target, index) => {
    const pointer = index === cursor ? '>' : ' ';
    const checked = selected.has(target.id) ? 'x' : ' ';
    console.log(`${pointer} [${checked}] ${target.label}`);
  });
}

function runTargetSurvey() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return Promise.resolve([]);
  }

  const selected = new Set();
  let cursor = 0;

  return new Promise((resolvePromise) => {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    renderSurvey(selected, cursor);

    const onKeypress = (_str, key) => {
      if (key.name === 'up') cursor = (cursor - 1 + targetCatalog.length) % targetCatalog.length;
      if (key.name === 'down') cursor = (cursor + 1) % targetCatalog.length;
      if (key.name === 'space') {
        const id = targetCatalog[cursor].id;
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
      }
      if (key.name === 'return') {
        process.stdin.setRawMode(false);
        process.stdin.off('keypress', onKeypress);
        console.log('');
        resolvePromise(targetCatalog.filter((target) => selected.has(target.id)));
        return;
      }
      if (key.ctrl && key.name === 'c') {
        process.stdin.setRawMode(false);
        process.stdin.off('keypress', onKeypress);
        process.exit(130);
      }

      renderSurvey(selected, cursor);
    };

    process.stdin.on('keypress', onKeypress);
  });
}

async function installSkill(options) {
  const source = resolve(packageRoot, 'servicemap');
  const selectedTargets = options.survey && !options.yes
    ? [{ id: 'universal', label: 'Universal', root: universalRoot }, ...await runTargetSurvey()]
    : targetsForOptions(options);
  const roots = skillRootsForTargets(options, selectedTargets);

  if (!existsSync(source)) {
    throw new Error(`Bundled skill folder not found: ${source}`);
  }

  if (roots.length === 0) {
    console.log('No targets selected. Nothing was installed.');
    return;
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

  if (options.command === 'generate' && !options.explicitCommand && !options.generationRequested) {
    options.command = 'install-skill';
    options.survey = true;
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

  const scanArgs = [scanScript, '--root', options.root];
  for (const email of options.allowedEmails) {
    scanArgs.push('--allow-email', email);
  }
  await run(process.execPath, scanArgs);
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
