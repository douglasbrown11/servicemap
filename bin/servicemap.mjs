#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, rm, symlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryUrl = 'https://github.com/douglasbrown11/servicemap.git';
const stableSourceRoot = () => resolve(homedir(), '.servicemap/source');
const scanScript = resolve(packageRoot, 'servicemap/scripts/scan-project.mjs');
const pageScript = resolve(packageRoot, 'servicemap/scripts/generate-page.mjs');
const desktopScript = resolve(packageRoot, 'servicemap/scripts/generate-desktop-app.mjs');

const universalRoot = () => resolve(homedir(), '.agents/skills');

const universalAgents = [
  'Amp',
  'Antigravity',
  'Antigravity CLI',
  'Cline',
  'Codex',
  'Cursor',
  'Deep Agents',
  'Dexto',
  'Droid',
  'Firebender',
  'Gemini CLI',
  'GitHub Copilot',
  'Kilo Code',
  'Kimi Code CLI',
  'Loaf',
  'OpenCode',
  'Sarvam Code',
  'Warp',
  'Zed',
];

const targetCatalog = [
  { id: 'aider-desk', label: 'AiderDesk', root: () => resolve(homedir(), '.aider-desk/skills') },
  { id: 'astrbot', label: 'AstrBot', root: () => resolve(homedir(), '.astrbot/data/skills') },
  { id: 'autohand-code', label: 'Autohand Code CLI', root: () => resolve(homedir(), '.autohand/skills') },
  { id: 'augment', label: 'Augment', root: () => resolve(homedir(), '.augment/skills') },
  { id: 'bob', label: 'IBM Bob', root: () => resolve(homedir(), '.bob/skills') },
  { id: 'claude-code', label: 'Claude Code', root: () => resolve(homedir(), '.claude/skills') },
  { id: 'openclaw', label: 'OpenClaw', root: () => resolve(homedir(), '.openclaw/skills') },
  { id: 'codearts-agent', label: 'CodeArts Agent', root: () => resolve(homedir(), '.codeartsdoer/skills') },
  { id: 'codebuddy', label: 'CodeBuddy', root: () => resolve(homedir(), '.codebuddy/skills') },
  { id: 'codemaker', label: 'Codemaker', root: () => resolve(homedir(), '.codemaker/skills') },
  { id: 'codestudio', label: 'Code Studio', root: () => resolve(homedir(), '.codestudio/skills') },
  { id: 'command-code', label: 'Command Code', root: () => resolve(homedir(), '.commandcode/skills') },
  { id: 'continue', label: 'Continue', root: () => resolve(homedir(), '.continue/skills') },
  { id: 'cortex', label: 'Cortex Code', root: () => resolve(homedir(), '.snowflake/cortex/skills') },
  { id: 'crush', label: 'Crush', root: () => resolve(homedir(), '.config/crush/skills') },
  { id: 'devin', label: 'Devin for Terminal', root: () => resolve(homedir(), '.config/devin/skills') },
  { id: 'forgecode', label: 'ForgeCode', root: () => resolve(homedir(), '.forge/skills') },
  { id: 'fx', label: 'fx', root: () => resolve(homedir(), '.fx/skills') },
  { id: 'goose', label: 'Goose', root: () => resolve(homedir(), '.config/goose/skills') },
  { id: 'grok', label: 'Grok Build', root: () => resolve(homedir(), '.grok/skills') },
  { id: 'hermes-agent', label: 'Hermes Agent', root: () => resolve(homedir(), '.hermes/skills') },
  { id: 'inference-sh', label: 'inference.sh', root: () => resolve(homedir(), '.inferencesh/skills') },
  { id: 'jazz', label: 'Jazz', root: () => resolve(homedir(), '.jazz/skills') },
  { id: 'junie', label: 'Junie', root: () => resolve(homedir(), '.junie/skills') },
  { id: 'iflow-cli', label: 'iFlow CLI', root: () => resolve(homedir(), '.iflow/skills') },
  { id: 'kimchi', label: 'Kimchi', root: () => resolve(homedir(), '.config/kimchi/harness/skills') },
  { id: 'kiro-cli', label: 'Kiro CLI', root: () => resolve(homedir(), '.kiro/skills') },
  { id: 'kode', label: 'Kode', root: () => resolve(homedir(), '.kode/skills') },
  { id: 'lingma', label: 'Lingma', root: () => resolve(homedir(), '.lingma/skills') },
  { id: 'mcpjam', label: 'MCPJam', root: () => resolve(homedir(), '.mcpjam/skills') },
  { id: 'minimax-code', label: 'MiniMax Code', root: () => resolve(homedir(), '.minimax/skills') },
  { id: 'mistral-vibe', label: 'Mistral Vibe', root: () => resolve(homedir(), '.vibe/skills') },
  { id: 'moxby', label: 'Moxby', root: () => resolve(homedir(), '.moxby/skills') },
  { id: 'mux', label: 'Mux', root: () => resolve(homedir(), '.mux/skills') },
  { id: 'openhands', label: 'OpenHands', root: () => resolve(homedir(), '.openhands/skills') },
  { id: 'ona', label: 'Ona', root: () => resolve(homedir(), '.ona/skills') },
  { id: 'pi', label: 'Pi', root: () => resolve(homedir(), '.pi/agent/skills') },
  { id: 'posit-assistant', label: 'Posit Assistant', root: () => resolve(homedir(), '.posit/assistant/skills') },
  { id: 'qoder', label: 'Qoder', root: () => resolve(homedir(), '.qoder/skills') },
  { id: 'qoder-cn', label: 'Qoder CN', root: () => resolve(homedir(), '.qoder-cn/skills') },
  { id: 'qwen-code', label: 'Qwen Code', root: () => resolve(homedir(), '.qwen/skills') },
  { id: 'reasonix', label: 'Reasonix', root: () => resolve(homedir(), '.reasonix/skills') },
  { id: 'rovodev', label: 'Rovo Dev', root: () => resolve(homedir(), '.rovodev/skills') },
  { id: 'roo', label: 'Roo Code', root: () => resolve(homedir(), '.roo/skills') },
  { id: 'tabnine-cli', label: 'Tabnine CLI', root: () => resolve(homedir(), '.tabnine/agent/skills') },
  { id: 'terramind', label: 'Terramind', root: () => resolve(homedir(), '.terramind/skills') },
  { id: 'tinycloud', label: 'Tinycloud', root: () => resolve(homedir(), '.tinycloud/skills') },
  { id: 'trae', label: 'Trae', root: () => resolve(homedir(), '.trae/skills') },
  { id: 'trae-cn', label: 'Trae CN', root: () => resolve(homedir(), '.trae-cn/skills') },
  { id: 'windsurf', label: 'Windsurf', root: () => resolve(homedir(), '.windsurf/skills') },
  { id: 'zcode', label: 'ZCode', root: () => resolve(homedir(), '.zcode/skills') },
  { id: 'zencoder', label: 'Zencoder', root: () => resolve(homedir(), '.zencoder/skills') },
  { id: 'zenflow', label: 'Zenflow', root: () => resolve(homedir(), '.zencoder/skills') },
  { id: 'neovate', label: 'Neovate', root: () => resolve(homedir(), '.neovate/skills') },
  { id: 'pochi', label: 'Pochi', root: () => resolve(homedir(), '.pochi/skills') },
  { id: 'adal', label: 'AdaL', root: () => resolve(homedir(), '.adal/skills') },
  { id: 'jetbrains-ai', label: 'JetBrains AI', root: () => resolve(homedir(), '.jetbrains-ai/skills') },
];

const targetAliases = new Map([
  ['codex', 'universal'],
  ['agents', 'universal'],
  ['universal', 'universal'],
  ['cursor', 'universal'],
  ['cline', 'universal'],
  ['antigravity', 'universal'],
  ['antigravity-cli', 'universal'],
  ['deep-agents', 'universal'],
  ['deepagents', 'universal'],
  ['dexto', 'universal'],
  ['droid', 'universal'],
  ['firebender', 'universal'],
  ['opencode', 'universal'],
  ['open-code', 'universal'],
  ['zed', 'universal'],
  ['github-copilot', 'universal'],
  ['copilot', 'universal'],
  ['gemini-cli', 'universal'],
  ['kilo', 'universal'],
  ['kilo-code', 'universal'],
  ['kimi', 'universal'],
  ['kimi-code', 'universal'],
  ['kimi-code-cli', 'universal'],
  ['loaf', 'universal'],
  ['sarvam', 'universal'],
  ['sarvam-code', 'universal'],
  ['chatgpt', 'universal'],
  ['openai', 'universal'],
  ['openai-api', 'universal'],
  ['gpt-6-astra', 'universal'],
  ['gpt-6-sol', 'universal'],
  ['gpt-6-luna', 'universal'],
  ['gpt-5.6-sol', 'universal'],
  ['gpt-5.6-terra', 'universal'],
  ['gpt-5.6-luna', 'universal'],
  ['claude', 'claude-code'],
  ['anthropic', 'claude-code'],
  ['anthropic-api', 'claude-code'],
  ['claude-opus', 'claude-code'],
  ['claude-sonnet', 'claude-code'],
  ['claude-haiku', 'claude-code'],
  ['xai', 'grok'],
  ['aiderdesk', 'aider-desk'],
  ['autohand', 'autohand-code'],
  ['codearts', 'codearts-agent'],
  ['ibm-bob', 'bob'],
  ['roo-code', 'roo'],
  ['qwen', 'qwen-code'],
  ['tabnine', 'tabnine-cli'],
  ['kiro', 'kiro-cli'],
  ['iflow', 'iflow-cli'],
  ['minimax', 'minimax-code'],
  ['mistral', 'mistral-vibe'],
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
    installMethod: null,
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
    if (arg === '--install-method') options.installMethod = args[++index] ?? null;
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
  servicemap install-skill [--survey] [--agent codex|claude|grok|all] [--targets <ids>] [--install-method copy|symlink]
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

const visibleUniversalLimit = 12;
const additionalAgentWindowSize = 8;
const dim = (value) => `\x1b[2m${value}\x1b[22m`;
const green = (value) => `\x1b[32m${value}\x1b[39m`;
const cyan = (value) => `\x1b[36m${value}\x1b[39m`;
let stableSourceStatus = '';

function timelineStep(text) {
  console.log(`${green('◇')}  ${text}`);
  console.log(dim('│'));
}

function timelineActive(text) {
  console.log(`${green('◆')}  ${text}`);
  console.log(dim('│'));
}

function timelineLine(text = '') {
  console.log(`${dim('│')}  ${text}`);
}

function renderSurvey(selected, cursor) {
  console.clear();
  timelineStep(cyan('servicemap'));
  timelineStep(`Source: ${repositoryUrl}`);
  timelineStep(`Stable source: ${stableSourceRoot()}`);
  if (stableSourceStatus) {
    timelineStep(stableSourceStatus);
  }
  timelineActive('Which agents do you want to install Servicemap to?');
  timelineLine('Universal (.agents/skills) — always included');
  for (const agent of universalAgents.slice(0, visibleUniversalLimit)) {
    timelineLine(`• ${agent}`);
  }
  const hiddenUniversalCount = universalAgents.length - visibleUniversalLimit;
  if (hiddenUniversalCount > 0) {
    timelineLine(`...and ${hiddenUniversalCount} more`);
  }
  timelineLine('');
  timelineLine('Additional agents');
  timelineLine('Use ↑/↓, Space to select, Enter to install.');
  timelineLine('');

  const halfWindow = Math.floor(additionalAgentWindowSize / 2);
  let start = Math.max(0, cursor - halfWindow);
  start = Math.min(start, Math.max(0, targetCatalog.length - additionalAgentWindowSize));
  const end = Math.min(targetCatalog.length, start + additionalAgentWindowSize);
  const beforeCount = start;
  const afterCount = targetCatalog.length - end;

  targetCatalog.slice(start, end).forEach((target, offset) => {
    const index = start + offset;
    const pointer = index === cursor ? '>' : ' ';
    const checked = selected.has(target.id) ? 'x' : ' ';
    timelineLine(`${pointer} [${checked}] ${target.label} ${dim(`(${target.root()})`)}`);
  });

  if (beforeCount > 0 || afterCount > 0) {
    const before = beforeCount > 0 ? `↑ ${beforeCount} more` : '';
    const after = afterCount > 0 ? `↓ ${afterCount} more` : '';
    timelineLine(dim([before, after].filter(Boolean).join('  ')));
  }

  if (selected.size > 0) {
    const selectedLabels = targetCatalog
      .filter((target) => selected.has(target.id))
      .map((target) => target.label);
    const preview = selectedLabels.slice(0, 3).join(', ');
    const remainder = selectedLabels.length > 3 ? ` +${selectedLabels.length - 3} more` : '';
    timelineLine('');
    timelineLine(`Selected: ${preview}${remainder}`);
  }
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
      if (key.name === 'up') cursor = Math.max(0, cursor - 1);
      if (key.name === 'down') cursor = Math.min(targetCatalog.length - 1, cursor + 1);
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

function runSilent(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: 'ignore',
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

function wait(ms) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

async function withSpinner(message, action, minimumMs = 1400) {
  const frames = ['◒', '◐', '◓', '◑'];
  let frame = 0;
  let dots = '';
  const startedAt = Date.now();
  const nextText = () => {
    const text = `${dim('│')}  ${frames[frame]} ${message}${dots}`;
    frame = (frame + 1) % frames.length;
    if (frame === 0) dots = dots.length >= 5 ? '' : `${dots}.`;
    return text;
  };

  if (!process.stdout.isTTY) {
    console.log(nextText());
    const result = await action();
    const remainingMs = minimumMs - (Date.now() - startedAt);
    if (remainingMs > 0) await wait(remainingMs);
    return result;
  }

  const writeFrame = () => {
    process.stdout.write(`\r\x1b[J${nextText()}`);
  };

  process.stdout.write('\x1b[?25l');
  writeFrame();
  const interval = setInterval(writeFrame, 120);

  try {
    const result = await action();
    const remainingMs = minimumMs - (Date.now() - startedAt);
    if (remainingMs > 0) await wait(remainingMs);
    return result;
  } finally {
    clearInterval(interval);
    process.stdout.write('\r\x1b[J\x1b[?25h');
  }
}

async function prepareStableSource(options) {
  const sourceRoot = stableSourceRoot();
  if (options.dryRun) {
    timelineStep(`Would prepare stable source at ${sourceRoot}`);
    return resolve(sourceRoot, 'servicemap');
  }

  timelineStep(`Source: ${repositoryUrl}`);
  await mkdir(dirname(sourceRoot), { recursive: true });

  try {
    if (existsSync(join(sourceRoot, '.git'))) {
      await withSpinner('Updating repository…', () => runSilent('git', ['pull', '--ff-only'], { cwd: sourceRoot }));
      stableSourceStatus = 'Repository updated';
      timelineStep('Repository updated');
    } else {
      await rm(sourceRoot, { recursive: true, force: true });
      await withSpinner('Cloning repository…', () => runSilent('git', ['clone', '--depth', '1', repositoryUrl, sourceRoot]));
      stableSourceStatus = 'Repository cloned';
      timelineStep('Repository cloned');
    }
  } catch (_error) {
    await rm(sourceRoot, { recursive: true, force: true });
    await cp(packageRoot, sourceRoot, { recursive: true });
    stableSourceStatus = 'Repository unavailable; copied packaged source';
    timelineStep('Repository unavailable; copied packaged source');
  }

  return resolve(sourceRoot, 'servicemap');
}

async function installIntoRoot(root, source, method, options) {
  const destination = join(root, 'servicemap');
  if (options.dryRun) {
    const verb = method === 'symlink' ? 'link' : 'copy';
    console.log(`Would ${verb} Servicemap skill to ${destination}`);
    return;
  }

  await mkdir(root, { recursive: true });
  await rm(destination, { recursive: true, force: true });

  if (method === 'symlink') {
    await symlink(source, destination, 'dir');
    console.log(`Linked Servicemap skill to ${destination}`);
    return;
  }

  await cp(source, destination, { recursive: true });
  console.log(`Installed Servicemap skill to ${destination}`);
}

async function installSkill(options) {
  let source = resolve(packageRoot, 'servicemap');
  const method = options.installMethod ?? 'symlink';

  if (!existsSync(source)) {
    throw new Error(`Bundled skill folder not found: ${source}`);
  }

  if (!['copy', 'symlink'].includes(method)) {
    throw new Error(`Unknown install method "${method}". Use copy or symlink.`);
  }

  if (method === 'symlink') {
    source = await prepareStableSource(options);
    if (!existsSync(source) && !options.dryRun) {
      throw new Error(`Stable skill source not found: ${source}`);
    }
  }

  const selectedTargets = options.survey && !options.yes
    ? [{ id: 'universal', label: 'Universal', root: universalRoot }, ...await runTargetSurvey()]
    : targetsForOptions(options);
  const roots = skillRootsForTargets(options, selectedTargets);

  if (roots.length === 0) {
    console.log('No targets selected. Nothing was installed.');
    return;
  }

  for (const root of roots) {
    await installIntoRoot(root, source, method, options);
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
